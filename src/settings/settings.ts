/**
 * Pure settings logic; imports nothing from Obsidian.
 *
 * Saved data is untrusted: it may be missing, hand-edited, from an older
 * version, or the wrong shape. `normalizeSettings` turns any value into a
 * complete, valid settings object and never throws.
 *
 * The saved file holds the settings as top-level fields and, only when "keep
 * timer state" is on, a `timer` field. `buildSaveData` writes the file and
 * `timerFromData` reads the timer back.
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

/** The settings used for any value that is missing or invalid. */
export const DEFAULT_SETTINGS: Readonly<WordCensusSettings> = Object.freeze({
	...DEFAULT_COUNT_OPTIONS,
	defaultCountdownMinutes: DEFAULT_COUNTDOWN_MS / MINUTE_MS,
	heading: '',
	keepTimerState: false,
	showStatusBar: true
});

/** The longest allowed default countdown, in minutes. */
export const MAX_COUNTDOWN_MINUTES = MAX_COUNTDOWN_MS / MINUTE_MS;

/** The shortest allowed default countdown, in minutes. */
export const MIN_COUNTDOWN_MINUTES = 1;

/******************************************************************************
 * Functions
******************************************************************************/

/**
 * Reads a boolean from an unknown value.
 *
 * @param value - The value to read.
 * @param fallback - The result when `value` is not a boolean.
 * @returns `value` if it is a boolean, otherwise `fallback`.
 */
function booleanOr(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

/**
 * Builds the data to save. The timer is included, frozen so that anything
 * running is saved paused, only when the user has chosen to keep it. Turning
 * that setting off drops any previously saved timer on the next save.
 *
 * @param settings - The current settings.
 * @param timer - The current timer.
 * @param now - The current time in milliseconds.
 * @returns The data to persist.
 */
export function buildSaveData(
	settings: WordCensusSettings,
	timer: TimerState,
	now: number
): SavedData {
	return settings.keepTimerState
		? { ...settings, timer: freezeTimer(timer, now) }
		: { ...settings };
}

/**
 * Creates a new timer whose countdown has the length chosen in settings.
 *
 * @param settings - The current settings.
 * @returns The new timer.
 */
function freshTimer(settings: WordCensusSettings): TimerState {
	return setCountdownDuration(createTimer(), settings.defaultCountdownMinutes * MINUTE_MS);
}

/**
 * Turns saved data of unknown shape into valid settings. A field with the
 * wrong type falls back to its default, the countdown length is rounded and
 * clamped, the heading is trimmed, and unknown fields are dropped.
 *
 * @param raw - The saved data, of any shape.
 * @returns A new settings object; never the defaults themselves.
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
 * Gets the timer to start with: a new one when the user is not keeping timer
 * state or nothing usable was saved, otherwise the saved one, brought back
 * paused and normalized.
 *
 * @param raw - The saved data, of any shape.
 * @param settings - The normalized settings.
 * @returns The starting timer.
 */
export function timerFromData(raw: unknown, settings: WordCensusSettings): TimerState {
	const stored = isRecord(raw) ? raw.timer : undefined;
	if (!settings.keepTimerState || !isRecord(stored)) {
		return freshTimer(settings);
	}
	return restoreTimer(stored);
}