/**
 * Pure settings logic. Imports nothing from Obsidian. The settings tab that
 * edits these values is `SettingsTab.ts`.
 *
 * Saved data is untrusted: it may be missing, hand-edited, from an older
 * version, or the wrong shape entirely. `normalizeSettings` turns any value
 * into a complete, valid settings object and never throws.
 *
 * The saved file holds the settings as top-level fields and, only when
 * "keep timer state" is on, a `timer` field. `timerFromData` and
 * `buildSaveData` are the two halves of that: reading it back and writing
 * it out.
 */

import { DEFAULT_COUNT_OPTIONS } from '../counting/count';
import { isRecord } from '../guards';
import {
	DEFAULT_COUNTDOWN_MS,
	MAX_COUNTDOWN_MS,
	MINUTE_MS,
	createTimer,
	freezeTimer,
	restoreTimer,
	setCountdownDuration
} from '../timer/timer';
import type {
	SavedData,
	TimerState,
	WordCensusSettings
} from '../types';

/******************************************************************************
 * Declared Variables and Constants
******************************************************************************/

export const DEFAULT_SETTINGS: Readonly<WordCensusSettings> = Object.freeze({
	...DEFAULT_COUNT_OPTIONS,
	defaultCountdownMinutes: DEFAULT_COUNTDOWN_MS / MINUTE_MS,
	heading: '',
	keepTimerState: false,
	showStatusBar: true
});

export const MAX_COUNTDOWN_MINUTES = MAX_COUNTDOWN_MS / MINUTE_MS;
export const MIN_COUNTDOWN_MINUTES = 1;

/******************************************************************************
 * Functions
******************************************************************************/

function booleanOr(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

/**
 * The data to save. The timer is included, frozen so that anything running
 * is saved paused, only when the user has chosen to keep it. Turning that
 * setting off therefore drops any previously saved timer on the next save.
 */
export function buildSaveData(settings: WordCensusSettings, timer: TimerState, now: number): SavedData {
	return settings.keepTimerState
		? { ...settings, timer: freezeTimer(timer, now) }
		: { ...settings };
}

/** A new timer whose countdown has the length chosen in settings. */
function freshTimer(settings: WordCensusSettings): TimerState {
	return setCountdownDuration(createTimer(), settings.defaultCountdownMinutes * MINUTE_MS);
}

/**
 * Turns saved data of unknown shape into valid settings. A field with the
 * wrong type falls back to its default, the countdown length is rounded and
 * clamped, the heading is trimmed, and unknown fields are dropped. Always
 * returns a new object, never the defaults themselves.
 */
export function normalizeSettings(raw: unknown): WordCensusSettings {
	const stored = isRecord(raw) ? raw : {};
	const minutes = stored.defaultCountdownMinutes;
	const validMinutes = typeof minutes === 'number' && Number.isFinite(minutes);
	return {
		defaultCountdownMinutes: validMinutes
			? Math.min(MAX_COUNTDOWN_MINUTES, Math.max(MIN_COUNTDOWN_MINUTES, Math.round(minutes)))
			: DEFAULT_SETTINGS.defaultCountdownMinutes,
		heading: typeof stored.heading === 'string' ? stored.heading.trim() : DEFAULT_SETTINGS.heading,
		includeCodeBlocks: booleanOr(stored.includeCodeBlocks, DEFAULT_SETTINGS.includeCodeBlocks),
		includeEmbeds: booleanOr(stored.includeEmbeds, DEFAULT_SETTINGS.includeEmbeds),
		includeFootnotes: booleanOr(stored.includeFootnotes, DEFAULT_SETTINGS.includeFootnotes),
		keepTimerState: booleanOr(stored.keepTimerState, DEFAULT_SETTINGS.keepTimerState),
		showStatusBar: booleanOr(stored.showStatusBar, DEFAULT_SETTINGS.showStatusBar)
	};
}

/**
 * The timer to start with. A new one when the user is not keeping timer
 * state, or when nothing usable was saved; otherwise the saved one, brought
 * back paused and normalized.
 */
export function timerFromData(raw: unknown, settings: WordCensusSettings): TimerState {
	const stored = isRecord(raw) ? raw.timer : undefined;
	if (!settings.keepTimerState || !isRecord(stored)) {
		return freshTimer(settings);
	}
	return restoreTimer(stored);
}