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

/**
 * Creates the store, starting with the default settings and a new timer until
 * `load` is called.
 *
 * @param persistence - Loads and saves the plugin's data.
 * @param now - Returns the current time in milliseconds.
 * @returns The store.
 */
export function createStore(persistence: Persistence, now: () => number): Store {
	let settings: WordCensusSettings = { ...DEFAULT_SETTINGS };
	let timer: TimerState = createTimer();
	const listeners = new Set<() => void>();

	/** Saves the current settings and, when kept, the timer. */
	const save = (): Promise<void> => persistence.save(buildSaveData(
		settings,
		timer,
		now()
	));

	return {
		/** The current settings. */
		get settings(): WordCensusSettings {
			return settings;
		},
		/** The current timer. */
		get timer(): TimerState {
			return timer;
		},
		/** Replaces the timer without saving. */
		replaceTimer(next: TimerState): void {
			timer = next;
		},
		/** Loads the saved data, normalizing the settings and restoring the timer. */
		async load(): Promise<void> {
			const raw = await persistence.load();
			settings = normalizeSettings(raw);
			timer = timerFromData(raw, settings);
		},
		save,
		/** Calls `listener` after each settings change; returns a function that unsubscribes it. */
		subscribe(listener: () => void): () => void {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		/** Applies a settings change, normalizing the result, notifying listeners, and saving. */
		async updateSettings(change: Partial<WordCensusSettings>): Promise<void> {
			settings = normalizeSettings({ ...settings, ...change });
			for (const listener of [...listeners]) {
				listener();
			}
			await save();
		}
	};
}