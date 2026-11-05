import {
	describe,
	expect,
	it
} from 'vitest';
import {
	DEFAULT_COUNTDOWN_MS,
	MAX_COUNTDOWN_MS,
	MIN_COUNTDOWN_MS,
	createTimer,
	elapsedMs,
	formatDuration,
	freezeTimer,
	isCountdownFinished,
	pauseTimer,
	remainingMs,
	resetTimer,
	restoreTimer,
	sessionStats,
	setCountdownDuration,
	startTimer,
	tickTimer
} from './timer';
import type {
	CountdownRun,
	Run,
	SessionBinding,
	TimerMode,
	TimerState
} from '../types';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const T0 = 1_000_000;
const NOTE: SessionBinding = { path: 'Draft.md', baselineWords: 100 };

/** A fresh timer with the given mode selected. */
function selecting(mode: TimerMode): TimerState {
	return { ...createTimer(), mode };
}

/** A countdown of the given length, selected and started at T0. */
function runningCountdown(durationMs: number): TimerState {
	const base = setCountdownDuration(selecting('countdown'), durationMs);
	return startTimer(base, T0);
}

describe('elapsedMs', () => {
	it('returns the accumulated time when the run is not running', () => {
		const run: Run = { accumulatedMs: 5 * SECOND, startedAt: null };

		const result = elapsedMs(run, T0);

		expect(result).toBe(5 * SECOND);
	});

	it('adds the time since the current stretch began while running', () => {
		const run: Run = { accumulatedMs: 5 * SECOND, startedAt: T0 };

		const result = elapsedMs(run, T0 + 3 * SECOND);

		expect(result).toBe(8 * SECOND);
	});

	it('never counts negative time when the clock moves backwards', () => {
		const run: Run = { accumulatedMs: 5 * SECOND, startedAt: T0 };

		const result = elapsedMs(run, T0 - 10 * SECOND);

		expect(result).toBe(5 * SECOND);
	});
});

describe('remainingMs', () => {
	it('counts down from the duration', () => {
		const countdown: CountdownRun = { accumulatedMs: 0, startedAt: T0, durationMs: 10 * SECOND };

		const result = remainingMs(countdown, T0 + 4 * SECOND);

		expect(result).toBe(6 * SECOND);
	});

	it('never goes below zero', () => {
		const countdown: CountdownRun = { accumulatedMs: 0, startedAt: T0, durationMs: 10 * SECOND };

		const result = remainingMs(countdown, T0 + 30 * SECOND);

		expect(result).toBe(0);
	});
});

describe('isCountdownFinished', () => {
	it('is false while the countdown is running, even past zero', () => {
		const countdown: CountdownRun = { accumulatedMs: 0, startedAt: T0, durationMs: 10 * SECOND };

		const result = isCountdownFinished(countdown);

		expect(result).toBe(false);
	});

	it('is false when it was paused with time left', () => {
		const countdown: CountdownRun = { accumulatedMs: 4 * SECOND, startedAt: null, durationMs: 10 * SECOND };

		const result = isCountdownFinished(countdown);

		expect(result).toBe(false);
	});

	it('is true once it has stopped at its duration', () => {
		const countdown: CountdownRun = { accumulatedMs: 10 * SECOND, startedAt: null, durationMs: 10 * SECOND };

		const result = isCountdownFinished(countdown);

		expect(result).toBe(true);
	});
});

describe('startTimer', () => {
	it('starts the selected mode from idle and leaves the others alone', () => {
		const state = selecting('stopwatch');

		const result = startTimer(state, T0);

		expect(result.stopwatch).toEqual({ accumulatedMs: 0, startedAt: T0 });
		expect(result.countdown).toBe(state.countdown);
		expect(result.session).toBe(state.session);
	});

	it('returns the same state when the selected mode is already running', () => {
		const running = startTimer(selecting('stopwatch'), T0);

		const result = startTimer(running, T0 + 5 * SECOND);

		expect(result).toBe(running);
	});

	it('resumes a paused run and keeps the time it had accumulated', () => {
		const paused = pauseTimer(startTimer(selecting('stopwatch'), T0), T0 + 5 * SECOND);

		const result = startTimer(paused, T0 + MINUTE);

		expect(result.stopwatch).toEqual({ accumulatedMs: 5 * SECOND, startedAt: T0 + MINUTE });
	});

	it('starts a countdown that has time left', () => {
		const state = selecting('countdown');

		const result = startTimer(state, T0);

		expect(result.countdown.startedAt).toBe(T0);
	});

	it('does not start a finished countdown until it is reset', () => {
		const finished = tickTimer(runningCountdown(10 * SECOND), T0 + 10 * SECOND);

		const result = startTimer(finished, T0 + MINUTE);

		expect(result).toBe(finished);
	});

	it('binds a session to the note it starts in', () => {
		const state = selecting('session');

		const result = startTimer(state, T0, NOTE);

		expect(result.session.binding).toEqual(NOTE);
		expect(result.session.startedAt).toBe(T0);
	});

	it('keeps the existing binding when a session is resumed', () => {
		const paused = pauseTimer(startTimer(selecting('session'), T0, NOTE), T0 + SECOND);
		const other: SessionBinding = { path: 'Other.md', baselineWords: 7 };

		const result = startTimer(paused, T0 + MINUTE, other);

		expect(result.session.binding).toEqual(NOTE);
	});

	it('runs a session unbound when there is no note to bind to', () => {
		const state = selecting('session');

		const result = startTimer(state, T0);

		expect(result.session.binding).toBe(null);
		expect(result.session.startedAt).toBe(T0);
	});
});

describe('pauseTimer', () => {
	it('folds the running time into the total and stops', () => {
		const running = startTimer(selecting('stopwatch'), T0);

		const result = pauseTimer(running, T0 + 5 * SECOND);

		expect(result.stopwatch).toEqual({ accumulatedMs: 5 * SECOND, startedAt: null });
	});

	it('returns the same state when the selected mode is not running', () => {
		const idle = selecting('stopwatch');

		const result = pauseTimer(idle, T0);

		expect(result).toBe(idle);
	});

	it('pauses only the selected mode', () => {
		const running = startTimer(selecting('stopwatch'), T0);

		const result = pauseTimer({ ...running, mode: 'session' }, T0 + 5 * SECOND);

		expect(result.stopwatch.startedAt).toBe(T0);
	});

	it('stops a countdown that has run past zero at its duration instead of overshooting', () => {
		const running = runningCountdown(10 * SECOND);

		const result = pauseTimer(running, T0 + 30 * SECOND);

		expect(result.countdown).toEqual({ accumulatedMs: 10 * SECOND, startedAt: null, durationMs: 10 * SECOND });
	});
});

describe('tickTimer', () => {
	it('returns the same state when the countdown still has time left', () => {
		const running = runningCountdown(10 * SECOND);

		const result = tickTimer(running, T0 + 4 * SECOND);

		expect(result).toBe(running);
	});

	it('returns the same state when no countdown is running', () => {
		const idle = createTimer();

		const result = tickTimer(idle, T0);

		expect(result).toBe(idle);
	});

	it('stops the countdown exactly at zero and flags it finished', () => {
		const running = runningCountdown(10 * SECOND);

		const result = tickTimer(running, T0 + 10 * SECOND);

		expect(result.countdown.startedAt).toBe(null);
		expect(isCountdownFinished(result.countdown)).toBe(true);
	});

	it('lands a late tick on the duration rather than past it', () => {
		const running = runningCountdown(10 * SECOND);

		const result = tickTimer(running, T0 + 10 * MINUTE);

		expect(result.countdown.accumulatedMs).toBe(10 * SECOND);
	});

	it('finishes the countdown even when another mode is selected', () => {
		const running = runningCountdown(10 * SECOND);

		const result = tickTimer({ ...running, mode: 'stopwatch' }, T0 + 10 * SECOND);

		expect(isCountdownFinished(result.countdown)).toBe(true);
	});
});

describe('resetTimer', () => {
	it('clears the stopwatch', () => {
		const running = startTimer(selecting('stopwatch'), T0);

		const result = resetTimer(running);

		expect(result.stopwatch).toEqual({ accumulatedMs: 0, startedAt: null });
	});

	it('clears the countdown but keeps its duration', () => {
		const running = runningCountdown(10 * SECOND);

		const result = resetTimer(running);

		expect(result.countdown).toEqual({ accumulatedMs: 0, startedAt: null, durationMs: 10 * SECOND });
	});

	it('clears the session and forgets its note', () => {
		const running = startTimer(selecting('session'), T0, NOTE);

		const result = resetTimer(running);

		expect(result.session).toEqual({ accumulatedMs: 0, startedAt: null, binding: null });
	});

	it('resets only the selected mode', () => {
		const running = startTimer(selecting('stopwatch'), T0);

		const result = resetTimer({ ...running, mode: 'countdown' });

		expect(result.stopwatch.startedAt).toBe(T0);
	});
});

describe('setCountdownDuration', () => {
	it('sets the duration and restarts the countdown from the new value', () => {
		const paused = pauseTimer(runningCountdown(10 * SECOND), T0 + 4 * SECOND);

		const result = setCountdownDuration(paused, 5 * MINUTE);

		expect(result.countdown).toEqual({ accumulatedMs: 0, startedAt: null, durationMs: 5 * MINUTE });
	});

	it('ignores a change while the countdown is running', () => {
		const running = runningCountdown(10 * SECOND);

		const result = setCountdownDuration(running, 5 * MINUTE);

		expect(result).toBe(running);
	});

	it('clamps a duration above the maximum', () => {
		const state = selecting('countdown');

		const result = setCountdownDuration(state, MAX_COUNTDOWN_MS * 2);

		expect(result.countdown.durationMs).toBe(MAX_COUNTDOWN_MS);
	});

	it('clamps a duration below the minimum', () => {
		const state = selecting('countdown');

		const result = setCountdownDuration(state, 0);

		expect(result.countdown.durationMs).toBe(MIN_COUNTDOWN_MS);
	});

	it('ignores a value that is not a finite number', () => {
		const state = selecting('countdown');

		const result = setCountdownDuration(state, Number.NaN);

		expect(result).toBe(state);
	});
});

describe('sessionStats', () => {
	it('reports words written since the session started and the writing rate', () => {
		const running = startTimer(selecting('session'), T0, NOTE);

		const result = sessionStats(running, T0 + 2 * MINUTE, 130);

		expect(result).toEqual({ elapsedMs: 2 * MINUTE, wordsWritten: 30, wordsPerMinute: 15 });
	});

	it('excludes paused time from the writing rate', () => {
		const running = startTimer(selecting('session'), T0, NOTE);
		const paused = pauseTimer(running, T0 + MINUTE);
		const resumed = startTimer(paused, T0 + 11 * MINUTE);

		const result = sessionStats(resumed, T0 + 12 * MINUTE, 110);

		expect(result.elapsedMs).toBe(2 * MINUTE);
		expect(result.wordsPerMinute).toBe(5);
	});

	it('reports a net loss of words but never a negative rate', () => {
		const running = startTimer(selecting('session'), T0, NOTE);

		const result = sessionStats(running, T0 + MINUTE, 95);

		expect(result.wordsWritten).toBe(-5);
		expect(result.wordsPerMinute).toBe(0);
	});

	it('reports a zero rate before any time has passed', () => {
		const running = startTimer(selecting('session'), T0, NOTE);

		const result = sessionStats(running, T0, 110);

		expect(result.wordsWritten).toBe(10);
		expect(result.wordsPerMinute).toBe(0);
	});

	it('reports no words or rate for a session with no note', () => {
		const running = startTimer(selecting('session'), T0);

		const result = sessionStats(running, T0 + MINUTE, 500);

		expect(result).toEqual({ elapsedMs: MINUTE, wordsWritten: null, wordsPerMinute: null });
	});
});

describe('freezeTimer', () => {
	it('pauses every running mode, folding in its time, and keeps the mode and binding', () => {
		const stopwatchRunning = startTimer(selecting('stopwatch'), T0);
		const bothRunning = startTimer({ ...stopwatchRunning, mode: 'session' }, T0 + SECOND, NOTE);

		const result = freezeTimer(bothRunning, T0 + 5 * SECOND);

		expect(result.stopwatch).toEqual({ accumulatedMs: 5 * SECOND, startedAt: null });
		expect(result.session).toEqual({ accumulatedMs: 4 * SECOND, startedAt: null, binding: NOTE });
		expect(result.mode).toBe('session');
	});

	it('settles a countdown that ran out while the app was in the background', () => {
		const running = runningCountdown(10 * SECOND);

		const result = freezeTimer(running, T0 + 10 * MINUTE);

		expect(result.countdown.accumulatedMs).toBe(10 * SECOND);
		expect(isCountdownFinished(result.countdown)).toBe(true);
	});
});

describe('restoreTimer', () => {
	it('round-trips a frozen timer through JSON', () => {
		const running = startTimer(selecting('session'), T0, NOTE);
		const frozen = freezeTimer(running, T0 + 3 * MINUTE);

		const result = restoreTimer(JSON.parse(JSON.stringify(frozen)));

		expect(result).toEqual(frozen);
	});

	it('returns a fresh timer when there is no saved data', () => {
		const data = undefined;

		const result = restoreTimer(data);

		expect(result).toEqual(createTimer());
	});

	it('keeps a valid saved mode', () => {
		const data = { mode: 'countdown' };

		const result = restoreTimer(data);

		expect(result.mode).toBe('countdown');
	});

	it('falls back to the stopwatch for an unknown mode', () => {
		const data = { mode: 'metronome' };

		const result = restoreTimer(data);

		expect(result.mode).toBe('stopwatch');
	});

	it('replaces a malformed elapsed time with zero', () => {
		const data = {
			stopwatch: { accumulatedMs: 'soon' },
			countdown: { accumulatedMs: -5 },
			session: { accumulatedMs: Number.POSITIVE_INFINITY }
		};

		const result = restoreTimer(data);

		expect(result.stopwatch.accumulatedMs).toBe(0);
		expect(result.countdown.accumulatedMs).toBe(0);
		expect(result.session.accumulatedMs).toBe(0);
	});

	it('brings every run back paused and discards a stored start time', () => {
		const data = { stopwatch: { accumulatedMs: 5 * SECOND, startedAt: T0 } };

		const result = restoreTimer(data);

		expect(result.stopwatch).toEqual({ accumulatedMs: 5 * SECOND, startedAt: null });
	});

	it('limits a restored countdown to its duration', () => {
		const data = { countdown: { durationMs: 10 * SECOND, accumulatedMs: 99 * MINUTE } };

		const result = restoreTimer(data);

		expect(result.countdown.accumulatedMs).toBe(10 * SECOND);
	});

	it('falls back to the default duration when the saved one is unusable', () => {
		const data = { countdown: { durationMs: 'long' } };

		const result = restoreTimer(data);

		expect(result.countdown.durationMs).toBe(DEFAULT_COUNTDOWN_MS);
	});

	it('restores a valid session binding', () => {
		const data = { session: { binding: NOTE } };

		const result = restoreTimer(data);

		expect(result.session.binding).toEqual(NOTE);
	});

	it('drops a binding whose path is not a string', () => {
		const data = { session: { binding: { path: 5, baselineWords: 10 } } };

		const result = restoreTimer(data);

		expect(result.session.binding).toBe(null);
	});

	it('drops a binding with an empty path', () => {
		const data = { session: { binding: { path: '', baselineWords: 10 } } };

		const result = restoreTimer(data);

		expect(result.session.binding).toBe(null);
	});

	it('drops a binding with a malformed word count', () => {
		const data = { session: { binding: { path: 'Draft.md', baselineWords: 'many' } } };

		const result = restoreTimer(data);

		expect(result.session.binding).toBe(null);
	});

	it('drops unknown fields left over from an older version', () => {
		const data = { ...createTimer(), legacyLapTimes: [1, 2, 3] };

		const result = restoreTimer(data);

		expect(result).toEqual(createTimer());
	});
});

describe('formatDuration', () => {
	it('formats minutes and seconds', () => {
		const result = formatDuration(65 * SECOND);

		expect(result).toBe('1:05');
	});

	it('adds hours from one hour up', () => {
		const result = formatDuration(3661 * SECOND);

		expect(result).toBe('1:01:01');
	});

	it('rounds partial seconds down by default', () => {
		const result = formatDuration(1999);

		expect(result).toBe('0:01');
	});

	it('rounds partial seconds up when asked', () => {
		const result = formatDuration(1001, 'ceil');

		expect(result).toBe('0:02');
	});

	it('shows zero for a negative value', () => {
		const result = formatDuration(-5 * SECOND);

		expect(result).toBe('0:00');
	});

	it('shows zero for a value that is not finite', () => {
		const result = formatDuration(Number.NaN);

		expect(result).toBe('0:00');
	});
});