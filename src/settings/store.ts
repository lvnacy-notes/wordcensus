/**
 * The plugin's state holder: the current settings and timer, and how they
 * are loaded and saved. No Obsidian imports. Persistence and the clock are
 * passed in, so everything here is unit-testable and nothing reaches for
 * Obsidian directly.
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
		async updateSettings(change: Partial<WordCensusSettings>): Promise<void> {
			settings = normalizeSettings({ ...settings, ...change });
			await save();
		}
	};
}