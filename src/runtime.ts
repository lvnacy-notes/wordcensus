/**
 * Wires the plugin's features together. `main.ts` only starts and stops it.
 */

import {
	Notice,
	Platform,
	type Plugin
} from 'obsidian';
import { buildInvokeCommand as buildOpenPanelCommand } from './commands/open-panel';
import { readNote } from './obsidian/note-source';
import { BLOCK_LANGUAGE, buildProcessor } from './obsidian/processor';
import { WordCensusSettingTab } from './obsidian/SettingsTab';
import { buildStatusBar } from './obsidian/status-bar';
import { VIEW_TYPE, WordCensusView } from './obsidian/View';
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

/** The path of the session's note, as a list for a watcher: empty when there is none. */
function boundPaths(store: Store): string[] {
	const { binding } = store.timer.session;
	return binding === null ? [] : [binding.path];
}

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
		// The panel shows the active note and the session's note, so those are
		// the two whose properties matter.
		watchNotes: (handler) => watcher.watch(handler, {
			active: true,
			paths: () => boundPaths(store)
		})
	});
}

function buildDriverEnvironment(plugin: Plugin): DriverEnvironment {
	return {
		notify: (message) => {
			new Notice(message);
		},
		now: Date.now,
		onBackground: (handler) => {
			plugin.registerDomEvent(document, 'visibilitychange', () => {
				if (document.visibilityState === 'hidden') {
					handler();
				}
			});
		},
		onForeground: (handler) => {
			plugin.registerDomEvent(document, 'visibilitychange', () => {
				if (document.visibilityState === 'visible') {
					handler();
				}
			});
		},
		schedule: (handler, intervalMs) => {
			const id = window.setInterval(handler, intervalMs);
			plugin.registerInterval(id);
			return () => window.clearInterval(id);
		}
	};
}

/** Adds the status bar item on desktop; mobile has no status bar. */
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

export async function startRuntime(plugin: Plugin): Promise<Runtime> {
	const store = createStore(
		{ load: () => plugin.loadData(), save: (data) => plugin.saveData(data) },
		Date.now
	);
	await store.load();

	const driver = createTimerDriver(store, buildDriverEnvironment(plugin));
	driver.begin();

	// One watcher serves the panel, the status bar and every block.
	const watcher = createNoteWatcher(buildWatcherSources(plugin.app, store));
	// Remembers the session's note's count, which can't be read once it is deleted.
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

	plugin.registerView(
		VIEW_TYPE,
		(leaf) => new WordCensusView(
			leaf,
			buildController(
				store,
				driver,
				watcher,
				readObserved
			)
		)
	);
	plugin.registerMarkdownCodeBlockProcessor(
		BLOCK_LANGUAGE,
		buildProcessor(
			plugin.app,
			store,
			watcher
		)
	);
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