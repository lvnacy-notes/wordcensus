/** Wires the plugin's features together. `main.ts` only starts and stops it. */

import {
	Notice,
	Platform,
	type Plugin
} from 'obsidian';
import { buildInvokeCommand as buildOpenPanelCommand } from './commands/open-panel';
import { VIEW_TYPE } from './obsidian/activateView';
import { readNote } from './obsidian/note-source';
import { BLOCK_LANGUAGE, buildProcessor } from './obsidian/processor';
import { WordCensusSettingTab } from './obsidian/SettingsTab';
import { buildStatusBar } from './obsidian/status-bar';
import { WordCensusView } from './obsidian/View';
import { buildWatcherSources } from './obsidian/watcher-sources';
import { createPanelController } from './panel/panel-controller';
import { createStore } from './settings/store';
import { createLastCounts } from './timer/last-counts';
import { createTimerDriver } from './timer/timer-driver';
import type {
	DriverEnvironment,
	NoteInfo,
	NoteWatcher,
	PanelController,
	Runtime,
	StatusBarController,
	Store,
	TimerDriver
} from './types';
import { createNoteWatcher } from './watcher/note-watcher';

/**
 * Lists the path of the session's note for a watcher.
 *
 * @param store - The settings and timer store.
 * @returns A one-item list, or an empty list when the session has no note.
 */
function boundPaths(store: Store): string[] {
	const { binding } = store.timer.session;
	return binding === null ? [] : [binding.path];
}

/**
 * Builds the sidebar panel controller.
 *
 * @param store - The settings and timer store.
 * @param driver - The timer driver.
 * @param watcher - The shared note watcher.
 * @param read - Counts the note at a path, or the active note when omitted.
 * @returns The panel controller.
 */
function buildController(
	store: Store,
	driver: TimerDriver,
	watcher: NoteWatcher,
	read: (path?: string) => Promise<NoteInfo | null>
): PanelController {
	return createPanelController({
		driver,
		now: Date.now,
		readNote: read,
		store,
		// Watches the active note and the session's note.
		watchNotes: (handler) => watcher.watch(handler, { active: true, paths: () => boundPaths(store) })
	});
}

/**
 * Builds the timer driver's environment from Obsidian and the browser.
 *
 * @param plugin - The plugin that owns the registered events and intervals.
 * @returns The notice, clock, visibility, and scheduling hooks.
 */
function buildDriverEnvironment(plugin: Plugin): DriverEnvironment {
	return {
		notify: (message) => {
			new Notice(message);
		},
		now: Date.now,
		onBackground: (handler) => {
			plugin.registerDomEvent(
				document,
				'visibilitychange',
				() => {
					if (document.visibilityState === 'hidden') {
						handler();
					}
				}
			);
		},
		onForeground: (handler) => {
			plugin.registerDomEvent(
				document,
				'visibilitychange',
				() => {
					if (document.visibilityState === 'visible') {
						handler();
					}
				}
			);
		},
		schedule: (handler, intervalMs) => {
			const id = window.setInterval(handler, intervalMs);
			plugin.registerInterval(id);
			return () => window.clearInterval(id);
		}
	};
}

/**
 * Starts the plugin: loads saved data, starts the timer, and registers the
 * panel view, `wordcount` block processor, command, status bar item, and
 * settings tab.
 *
 * @param plugin - The plugin to register features with.
 * @returns The running plugin, which `stop` shuts down and saves.
 */
export async function startRuntime(plugin: Plugin): Promise<Runtime> {
	const store = createStore({ load: () => plugin.loadData(), save: (data) => plugin.saveData(data) }, Date.now);
	await store.load();

	const driver = createTimerDriver(store, buildDriverEnvironment(plugin));
	driver.begin();

	// One watcher serves the panel, the status bar, and every block.
	const watcher = createNoteWatcher(buildWatcherSources(plugin.app, store));
	// Remembers the session note's last count.
	const lastCounts = createLastCounts(() => store.timer.session.binding?.path ?? null);
	const readObserved = async (path?: string): Promise<NoteInfo | null> => lastCounts.observe(
		await readNote(
			plugin.app,
			store,
			path
		)
	);
	watcher.onMove((oldPath, newPath) => {
		driver.rebind(oldPath, newPath);
	});
	watcher.onDelete((path) => {
		const { binding } = store.timer.session;
		driver.endSession(path, binding === null ? null : lastCounts.recall(binding.path));
	});

	plugin.registerView(VIEW_TYPE, (leaf) => new WordCensusView(leaf, buildController(
		store,
		driver,
		watcher,
		readObserved
	)));
	plugin.registerMarkdownCodeBlockProcessor(BLOCK_LANGUAGE, buildProcessor(
		plugin.app,
		store,
		watcher
	));
	plugin.addCommand(buildOpenPanelCommand(plugin.app));
	const statusBar = startStatusBar(
		plugin,
		store,
		watcher,
		() => readObserved()
	);
	plugin.addSettingTab(new WordCensusSettingTab(
		plugin.app,
		plugin,
		store
	));

	return {
		stop: () => {
			driver.end();
			statusBar?.stop();
			watcher.dispose();
			return store.save();
		}
	};
}

/**
 * Adds the status bar item on desktop; mobile has no status bar.
 *
 * @param plugin - The plugin that owns the item.
 * @param store - The settings and timer store.
 * @param watcher - The shared note watcher.
 * @param readActiveNote - Counts the active note.
 * @returns The started controller, or `null` on mobile.
 */
function startStatusBar(
	plugin: Plugin,
	store: Store,
	watcher: NoteWatcher,
	readActiveNote: () => Promise<NoteInfo | null>
): StatusBarController | null {
	if (Platform.isMobile) {
		return null;
	}
	const statusBar = buildStatusBar(
		plugin,
		store,
		watcher,
		readActiveNote
	);
	statusBar.start();
	return statusBar;
}