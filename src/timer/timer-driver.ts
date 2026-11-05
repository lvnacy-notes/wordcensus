/**
 * Runs the timer in real time. It ticks once a second while any run is
 * running and not at all otherwise, re-checks when the app returns to the
 * foreground, notifies the user when a countdown finishes, and saves after
 * every user action. Scheduling, the clock, foreground detection and
 * notices are passed in, so nothing here imports Obsidian.
 */

import {
	isRunning,
	pauseTimer,
	resetTimer,
	setCountdownDuration,
	startTimer,
	tickTimer
} from './timer';
import type {
	DriverEnvironment,
	SessionBinding,
	Store,
	TimerDriver,
	TimerMode,
	TimerState
} from '../types';

/******************************************************************************
 * Declared Variables and Constants
******************************************************************************/

const COUNTDOWN_FINISHED_MESSAGE = 'Word Census: countdown finished.';
const SAVE_FAILED_MESSAGE = 'Word Census: failed to save the timer.';
const TICK_MS = 1000;

/******************************************************************************
 * Functions
******************************************************************************/

export function createTimerDriver(store: Store, environment: DriverEnvironment): TimerDriver {
	const listeners = new Set<() => void>();
	let cancelTicking: (() => void) | null = null;

	const emit = (): void => {
		for (const listener of [...listeners]) {
			listener();
		}
	};

	const saveQuietly = (): void => {
		store.save().catch(() => environment.notify(SAVE_FAILED_MESSAGE));
	};

	const syncTicking = (): void => {
		const { countdown, session, stopwatch } = store.timer;
		const needed = [stopwatch, countdown, session].some(isRunning);
		if (needed && cancelTicking === null) {
			cancelTicking = environment.schedule(check, TICK_MS);
		} else if (!needed && cancelTicking !== null) {
			cancelTicking();
			cancelTicking = null;
		}
	};

	const commit = (next: TimerState): void => {
		if (next === store.timer) {
			return;
		}
		store.replaceTimer(next);
		syncTicking();
		saveQuietly();
		emit();
	};

	function check(): void {
		const before = store.timer;
		const after = tickTimer(before, environment.now());
		if (after !== before) {
			environment.notify(COUNTDOWN_FINISHED_MESSAGE);
			commit(after);
			return;
		}
		emit();
	}

	return {
		begin(): void {
			environment.onForeground(check);
			syncTicking();
			check();
		},
		end(): void {
			cancelTicking?.();
			cancelTicking = null;
			listeners.clear();
		},
		pause(): void {
			commit(pauseTimer(store.timer, environment.now()));
		},
		reset(): void {
			commit(resetTimer(store.timer));
		},
		selectMode(mode: TimerMode): void {
			commit({ ...store.timer, mode });
		},
		setCountdownDuration(durationMs: number): void {
			commit(setCountdownDuration(store.timer, durationMs));
		},
		start(binding?: SessionBinding): void {
			commit(startTimer(store.timer, environment.now(), binding));
		},
		subscribe(listener: () => void): () => void {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		}
	};
}