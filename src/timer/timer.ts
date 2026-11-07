/**
 * Pure timer state machine. Imports nothing from Obsidian and has no clock
 * of its own: every function that needs the time takes `now` (milliseconds,
 * as from `Date.now()`).
 *
 * Elapsed time is always computed from timestamps, never by counting
 * ticks.
 *
 * There are three modes (stopwatch, countdown, session). Each keeps its
 * own independent run; switching the selected mode never stops or resets
 * anything. `startTimer`, `pauseTimer` and `resetTimer` act on the
 * selected mode; `tickTimer` and `freezeTimer` act on all of them.
 *
 * Every function returns a new state and never mutates its input. The ones
 * that can be no-ops (`startTimer`, `pauseTimer`, `tickTimer`,
 * `setCountdownDuration`) return the very same object when nothing
 * changes.
 */

import { isRecord } from '../guards';
import type {
	CountdownRun,
	Run,
	SessionBinding,
	SessionResult,
	SessionRun,
	SessionStats,
	TimerMode,
	TimerState
} from '../types';

/******************************************************************************
 * Declared Variables and Constants
******************************************************************************/

export const MINUTE_MS = 60_000;
export const DEFAULT_COUNTDOWN_MS = 25 * MINUTE_MS;
export const MAX_COUNTDOWN_MS = 24 * 60 * MINUTE_MS;
export const MIN_COUNTDOWN_MS = 1000;
export const TIMER_MODES: readonly TimerMode[] = ['stopwatch', 'countdown', 'session'];

/******************************************************************************
 * Functions
******************************************************************************/

function begin<T extends Run>(run: T, now: number): T {
	return run.startedAt === null ? { ...run, startedAt: now } : run;
}

export function createTimer(): TimerState {
	return {
		mode: 'stopwatch',
		stopwatch: { accumulatedMs: 0, startedAt: null },
		countdown: { accumulatedMs: 0, startedAt: null, durationMs: DEFAULT_COUNTDOWN_MS },
		session: { accumulatedMs: 0, startedAt: null, binding: null, result: null }
	};
}

/**
 * Total running time. Time spent paused is never included, and a clock
 * that moves backwards (a system time change) never makes a run shorter.
 */
export function elapsedMs(run: Run, now: number): number {
	const { accumulatedMs, startedAt } = run;
	if (startedAt === null) {
		return accumulatedMs;
	}
	return accumulatedMs + Math.max(0, now - startedAt);
}

/**
 * Ends the session because its note was deleted. `path` is the note or the
 * folder that was deleted; a session bound to anything else is left alone.
 *
 * The session is paused, unbound, and keeps its figures as they stood:
 * elapsed time stays on its clock, and `result` records the words written
 * and the rate. `currentWords` is the note's last known count, or null if
 * there is none, in which case those two are null. Like a finished
 * countdown, an ended session ignores Start until it is reset.
 */
export function endSession(
	state: TimerState,
	path: string,
	now: number,
	currentWords: number | null
): TimerState {
	const { binding } = state.session;
	if (binding === null || !isWithin(binding.path, path)) {
		return state;
	}
	const stats = sessionStats(
		state,
		now,
		currentWords
	);
	return {
		...state,
		session: {
			accumulatedMs: stats.elapsedMs,
			startedAt: null,
			binding: null,
			result: {
				path: binding.path,
				wordsPerMinute: stats.wordsPerMinute,
				wordsWritten: stats.wordsWritten
			}
		}
	};
}

/**
 * Formats a duration for display: `m:ss`, or `h:mm:ss` from one hour up.
 * Partial seconds round down by default. `'ceil'` rounds them up, so a
 * countdown shows `0:00` only once it has finished.
 * Negative and non-finite values show as zero.
 */
export function formatDuration(ms: number, rounding: 'floor' | 'ceil' = 'floor'): string {
	const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
	const totalSeconds = rounding === 'ceil' ? Math.ceil(safe / 1000) : Math.floor(safe / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const pad = (value: number): string => String(value).padStart(2, '0');
	return hours > 0
		? `${ hours }:${ pad(minutes) }:${ pad(seconds) }`
		: `${ minutes }:${ pad(seconds) }`;
}

/**
 * Pauses every mode that is running, after settling a countdown that has
 * run out. This is what gets saved: whatever was running comes back
 * paused, so time the app spent closed is never silently counted.
 */
export function freezeTimer(state: TimerState, now: number): TimerState {
	const settled = tickTimer(state, now);
	return {
		...settled,
		stopwatch: halt(settled.stopwatch, now),
		countdown: halt(settled.countdown, now),
		session: halt(settled.session, now)
	};
}

function halt<T extends Run>(run: T, now: number): T {
	if (run.startedAt === null) {
		return run;
	}
	return { ...run, accumulatedMs: elapsedMs(run, now), startedAt: null };
}

/** True once a countdown has run out and been stopped at zero by `tickTimer`. */
export function isCountdownFinished(countdown: CountdownRun): boolean {
	return countdown.startedAt === null && countdown.accumulatedMs >= countdown.durationMs;
}

export function isRunning(run: Run): boolean {
	return run.startedAt !== null;
}

/** True once a session has ended because its note was deleted, until it is reset. */
export function isSessionEnded(session: SessionRun): boolean {
	return session.result !== null;
}

/** True when `path` is `parent` itself or is inside that folder. */
function isWithin(path: string, parent: string): boolean {
	return path === parent || path.startsWith(`${ parent }/`);
}

/** Clamps to the allowed range, or returns null for anything that is not a finite number. */
function normalizeDuration(value: unknown): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return null;
	}
	return Math.min(MAX_COUNTDOWN_MS, Math.max(MIN_COUNTDOWN_MS, value));
}

/** Pauses the selected mode, folding the running time into its total. */
export function pauseTimer(state: TimerState, now: number): TimerState {
	const settled = tickTimer(state, now);
	if (!isRunning(selectedRun(settled))) {
		return settled;
	}
	switch (settled.mode) {
		case 'stopwatch':
			return { ...settled, stopwatch: halt(settled.stopwatch, now) };
		case 'countdown':
			return { ...settled, countdown: halt(settled.countdown, now) };
		case 'session':
			return { ...settled, session: halt(settled.session, now) };
	}
}

export function remainingMs(countdown: CountdownRun, now: number): number {
	return Math.max(0, countdown.durationMs - elapsedMs(countdown, now));
}

/**
 * Follows the session's note when `oldPath`, a note or a folder, is moved
 * or renamed to `newPath`. A session bound to anything else is left alone.
 * The same object comes back when nothing changes.
 */
export function rebindSession(state: TimerState, oldPath: string, newPath: string): TimerState {
	const { binding } = state.session;
	if (binding === null || !isWithin(binding.path, oldPath)) {
		return state;
	}
	return {
		...state,
		session: {
			...state.session,
			binding: { ...binding, path: newPath + binding.path.slice(oldPath.length) }
		}
	};
}

/**
 * Clears the selected mode back to idle. A countdown keeps its duration;
 * a session forgets its note and any result.
 */
export function resetTimer(state: TimerState): TimerState {
	switch (state.mode) {
		case 'stopwatch':
			return { ...state, stopwatch: { accumulatedMs: 0, startedAt: null } };
		case 'countdown':
			return { ...state, countdown: { ...state.countdown, accumulatedMs: 0, startedAt: null } };
		case 'session':
			return { ...state, session: { accumulatedMs: 0, startedAt: null, binding: null, result: null } };
	}
}

function restoreBinding(value: unknown): SessionBinding | null {
	if (!isRecord(value)) {
		return null;
	}
	const { path, baselineWords } = value;
	const validPath = typeof path === 'string' && path !== '';
	const validWords = typeof baselineWords === 'number' && Number.isFinite(baselineWords) && baselineWords >= 0;
	return validPath && validWords ? { path, baselineWords } : null;
}

function restoreCountdown(value: unknown): CountdownRun {
	const stored = isRecord(value) ? value : {};
	const durationMs = normalizeDuration(stored.durationMs) ?? DEFAULT_COUNTDOWN_MS;
	const run = restoreRun(stored);
	return { ...run, accumulatedMs: Math.min(run.accumulatedMs, durationMs), durationMs };
}

function restoreResult(value: unknown): SessionResult | null {
	if (!isRecord(value)) {
		return null;
	}
	const {
		path,
		wordsPerMinute,
		wordsWritten
	} = value;
	if (typeof path !== 'string' || path === '') {
		return null;
	}
	const validRate = typeof wordsPerMinute === 'number' && Number.isFinite(wordsPerMinute) && wordsPerMinute >= 0;
	const validWords = typeof wordsWritten === 'number' && Number.isFinite(wordsWritten);
	return {
		path,
		wordsPerMinute: validRate ? wordsPerMinute : null,
		wordsWritten: validWords ? wordsWritten : null
	};
}

/** A run always comes back paused, whatever was stored. */
function restoreRun(value: unknown): Run {
	const stored = isRecord(value) ? value.accumulatedMs : undefined;
	const valid = typeof stored === 'number' && Number.isFinite(stored) && stored >= 0;
	return { accumulatedMs: valid ? stored : 0, startedAt: null };
}

function restoreSession(value: unknown): SessionRun {
	const stored = isRecord(value) ? value : {};
	// An ended session has no note, so a stored result wins over a stored binding.
	const result = restoreResult(stored.result);
	return {
		...restoreRun(stored),
		binding: result === null ? restoreBinding(stored.binding) : null,
		result
	};
}

/**
 * Rebuilds a timer from saved data of unknown shape. Anything missing,
 * malformed or left over from an older version is replaced with a safe
 * default, unknown fields are dropped, and every run comes back paused.
 * Never throws.
 */
export function restoreTimer(data: unknown): TimerState {
	const stored = isRecord(data) ? data : {};
	const mode = TIMER_MODES.find((candidate) => candidate === stored.mode) ?? 'stopwatch';
	return {
		mode,
		stopwatch: restoreRun(stored.stopwatch),
		countdown: restoreCountdown(stored.countdown),
		session: restoreSession(stored.session)
	};
}

/** The run belonging to the selected mode. */
export function selectedRun(state: TimerState): Run {
	switch (state.mode) {
		case 'stopwatch':
			return state.stopwatch;
		case 'countdown':
			return state.countdown;
		case 'session':
			return state.session;
	}
}

/**
 * Words written and the writing rate for the session.
 *
 * The rate uses running time only, so time spent paused never lowers it.
 * It is never negative, even when more text was removed than written.
 * `currentWords` is the bound note's region count right now, or null when
 * that count isn't available (the note hasn't been read yet, or was moved or
 * deleted). Without it there is nothing to measure against the baseline, so
 * the session reports no words or rate, as an unbound session does.
 */
export function sessionStats(
	state: TimerState,
	now: number,
	currentWords: number | null
): SessionStats {
	const { session } = state;
	const elapsed = elapsedMs(session, now);
	if (session.binding === null || currentWords === null) {
		return { elapsedMs: elapsed, wordsWritten: null, wordsPerMinute: null };
	}
	const wordsWritten = currentWords - session.binding.baselineWords;
	const minutes = elapsed / MINUTE_MS;
	const wordsPerMinute = minutes > 0 ? Math.max(0, wordsWritten) / minutes : 0;
	return { elapsedMs: elapsed, wordsWritten, wordsPerMinute };
}

/**
 * Sets the countdown's duration and restarts it from the new value. Only
 * allowed while the countdown is not running, and only for a finite
 * number; anything else leaves the state unchanged. Out-of-range values
 * are clamped.
 */
export function setCountdownDuration(state: TimerState, durationMs: number): TimerState {
	const duration = normalizeDuration(durationMs);
	if (duration === null || isRunning(state.countdown)) {
		return state;
	}
	return { ...state, countdown: { ...state.countdown, durationMs: duration, accumulatedMs: 0 } };
}

/**
 * Starts or resumes the selected mode.
 *
 * - Already running: unchanged.
 * - A finished countdown does nothing until it is reset, and neither does a
 *   session that ended because its note was deleted.
 * - A session binds to `binding` the first time it starts. Once bound it
 *   keeps that note, whatever is passed on resume. With no binding at all
 *   it runs unbound and reports no word statistics.
 */
export function startTimer(state: TimerState, now: number, binding?: SessionBinding): TimerState {
	if (isRunning(selectedRun(state))) {
		return state;
	}
	switch (state.mode) {
		case 'stopwatch':
			return { ...state, stopwatch: begin(state.stopwatch, now) };
		case 'countdown':
			return isCountdownFinished(state.countdown)
				? state
				: { ...state, countdown: begin(state.countdown, now) };
		case 'session':
			return isSessionEnded(state.session)
				? state
				: {
					...state,
					session: {
						...begin(state.session, now),
						binding: state.session.binding ?? binding ?? null
					}
				};
	}
}

/**
 * Stops a running countdown at zero. A late call still lands the
 * countdown exactly on its duration; it never overshoots.
 *
 * Applies to the countdown whichever mode is selected.
 */
export function tickTimer(state: TimerState, now: number): TimerState {
	const { countdown } = state;
	if (countdown.startedAt === null || elapsedMs(countdown, now) < countdown.durationMs) {
		return state;
	}
	return {
		...state,
		countdown: { ...countdown, accumulatedMs: countdown.durationMs, startedAt: null }
	};
}