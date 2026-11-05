import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SETTINGS,
	MAX_COUNTDOWN_MINUTES,
	MIN_COUNTDOWN_MINUTES,
	buildSaveData,
	normalizeSettings,
	timerFromData
} from './settings';
import { MALFORMED_SETTINGS, buildSettings } from '../test/fakes';
import { createTimer, startTimer } from '../timer/timer';

const MINUTE = 60 * 1000;
const T0 = 1_000_000;

describe('buildSaveData', () => {
	it('saves the settings without a timer when keeping timer state is off', () => {
		const settings = buildSettings({ keepTimerState: false });
		const timer = startTimer(createTimer(), T0);

		const result = buildSaveData(settings, timer, T0 + 5000);

		expect('timer' in result).toBe(false);
		expect(result).toEqual(settings);
	});

	it('saves the timer paused, with its running time folded in, when keeping timer state is on', () => {
		const settings = buildSettings({ keepTimerState: true });
		const timer = startTimer(createTimer(), T0);

		const result = buildSaveData(settings, timer, T0 + 5000);

		expect(result.timer?.stopwatch).toEqual({ accumulatedMs: 5000, startedAt: null });
		expect(result.keepTimerState).toBe(true);
	});
});

describe('normalizeSettings', () => {
	it('returns the defaults when there is no saved data', () => {
		const raw = undefined;

		const result = normalizeSettings(raw);

		expect(result).toEqual(DEFAULT_SETTINGS);
	});

	it('returns a new object, so a caller cannot mutate the defaults', () => {
		const raw = undefined;

		const result = normalizeSettings(raw);

		expect(result === DEFAULT_SETTINGS).toBe(false);
	});

	it('keeps valid saved values', () => {
		const settings = buildSettings({
			defaultCountdownMinutes: 45,
			heading: 'Draft',
			includeCodeBlocks: true,
			includeEmbeds: true,
			includeFootnotes: false,
			keepTimerState: true,
			showStatusBar: false
		});

		const result = normalizeSettings(JSON.parse(JSON.stringify(settings)));

		expect(result).toEqual(settings);
	});

	it('falls back to the default for every field of the wrong type', () => {
		const raw = MALFORMED_SETTINGS;

		const result = normalizeSettings(raw);

		expect(result).toEqual(DEFAULT_SETTINGS);
	});

	it('trims whitespace around the heading', () => {
		const raw = { heading: '  Chapter 3  ' };

		const result = normalizeSettings(raw);

		expect(result.heading).toBe('Chapter 3');
	});

	it('rounds a fractional countdown length', () => {
		const raw = { defaultCountdownMinutes: 12.6 };

		const result = normalizeSettings(raw);

		expect(result.defaultCountdownMinutes).toBe(13);
	});

	it('clamps a countdown length above the maximum', () => {
		const raw = { defaultCountdownMinutes: MAX_COUNTDOWN_MINUTES * 10 };

		const result = normalizeSettings(raw);

		expect(result.defaultCountdownMinutes).toBe(MAX_COUNTDOWN_MINUTES);
	});

	it('clamps a countdown length below the minimum', () => {
		const raw = { defaultCountdownMinutes: -5 };

		const result = normalizeSettings(raw);

		expect(result.defaultCountdownMinutes).toBe(MIN_COUNTDOWN_MINUTES);
	});

	it('falls back to the default for a countdown length that is not finite', () => {
		const raw = { defaultCountdownMinutes: Number.POSITIVE_INFINITY };

		const result = normalizeSettings(raw);

		expect(result.defaultCountdownMinutes).toBe(DEFAULT_SETTINGS.defaultCountdownMinutes);
	});

	it('drops unknown fields left over from an older version', () => {
		const raw = { ...DEFAULT_SETTINGS, legacyTheme: 'dark' };

		const result = normalizeSettings(raw);

		expect(result).toEqual(DEFAULT_SETTINGS);
	});
});

describe('timerFromData', () => {
	it('starts a new timer, ignoring a saved one, when keeping timer state is off', () => {
		const settings = buildSettings({ keepTimerState: false });
		const raw = { timer: { stopwatch: { accumulatedMs: 5000, startedAt: null } } };

		const result = timerFromData(raw, settings);

		expect(result.stopwatch.accumulatedMs).toBe(0);
	});

	it('gives a new timer the countdown length from settings', () => {
		const settings = buildSettings({ defaultCountdownMinutes: 10 });
		const raw = undefined;

		const result = timerFromData(raw, settings);

		expect(result.countdown.durationMs).toBe(10 * MINUTE);
	});

	it('starts a new timer when keeping timer state is on but nothing was saved', () => {
		const settings = buildSettings({ keepTimerState: true, defaultCountdownMinutes: 10 });
		const raw = {};

		const result = timerFromData(raw, settings);

		expect(result.stopwatch.accumulatedMs).toBe(0);
		expect(result.countdown.durationMs).toBe(10 * MINUTE);
	});

	it('restores the saved timer, paused, when keeping timer state is on', () => {
		const settings = buildSettings({ keepTimerState: true });
		const raw = { timer: { stopwatch: { accumulatedMs: 5000, startedAt: T0 } } };

		const result = timerFromData(raw, settings);

		expect(result.stopwatch).toEqual({ accumulatedMs: 5000, startedAt: null });
	});
});