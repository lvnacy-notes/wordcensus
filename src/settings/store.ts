/**
 * Holds the plugin's current settings and timer, and loads and saves them
 * through the persistence and clock it is given. Imports nothing from
 * Obsidian.
 */

import {
	DEFAULT_SETTINGS,
	buildSaveData,
	normalizeSettings,
	timerFromData
} from './settings';
import { createTimer } from '../timer/timer';
import type {
	Persistence,
	Store,
	TimerState,
	WordCensusSettings
} from '../types';

export function createStore(persistence: Persistence, now: () => number): Store {
	let settings: WordCensusSettings = { ...DEFAULT_SETTINGS };
	let timer: TimerState = createTimer();
	const listeners = new Set<() => void>();

	const save = (): Promise<void> => persistence.save(buildSaveData(settings, timer, now()));

	return {
		get settings(): WordCensusSettings {
			return settings;
		},
		get timer(): TimerState {
			return timer;
		},
		replaceTimer(next: TimerState): void {
			timer = next;
		},
		async load(): Promise<void> {
			const raw = await persistence.load();
			settings = normalizeSettings(raw);
			timer = timerFromData(raw, settings);
		},
		save,
		subscribe(listener: () => void): () => void {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		async updateSettings(change: Partial<WordCensusSettings>): Promise<void> {
			settings = normalizeSettings({ ...settings, ...change });
			for (const listener of [...listeners]) {
				listener();
			}
			await save();
		}
	};
}