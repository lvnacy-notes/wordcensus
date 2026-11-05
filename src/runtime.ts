/**
 * Wires the plugin's features together. `main.ts` only starts and stops it.
 */

import { type Plugin, Notice } from 'obsidian';
import { buildInvokeCommand as buildOpenPanelCommand } from './commands/open-panel';
import { readNote, watchNotes } from './obsidian/note-source';
import { createPanelController } from './panel/panel-controller';
import { WordCensusSettingTab } from './obsidian/SettingsTab';
import { createStore } from './settings/store';
import type { PanelController, Runtime } from './types';
import { createTimerDriver } from './timer/timer-driver';
import { VIEW_TYPE, WordCensusView } from './obsidian/View';
import type {
	DriverEnvironment,
	Store,
	TimerDriver
} from './types';

function buildController(
	plugin: Plugin,
	store: Store,
	driver: TimerDriver
): PanelController {
	return createPanelController({
		driver,
		now: Date.now,
		readNote: (path) => readNote(plugin.app, store, path),
		store,
		watchNotes: (handler) => watchNotes(plugin.app, handler)
	});
}

function buildDriverEnvironment(plugin: Plugin): DriverEnvironment {
	return {
		notify: (message) => {
			new Notice(message);
		},
		now: Date.now,
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

export async function startRuntime(plugin: Plugin): Promise<Runtime> {
	const store = createStore(
		{ load: () => plugin.loadData(), save: (data) => plugin.saveData(data) },
		Date.now
	);
	await store.load();

	const driver = createTimerDriver(store, buildDriverEnvironment(plugin));
	driver.begin();

	plugin.registerView(
		VIEW_TYPE,
		(leaf) => new WordCensusView(leaf, buildController(plugin, store, driver))
	);
	plugin.addCommand(buildOpenPanelCommand(plugin.app));
	plugin.addSettingTab(new WordCensusSettingTab(
		plugin.app,
		plugin,
		store
	));

	return {
		stop: () => {
			driver.end();
			return store.save();
		}
	};
}