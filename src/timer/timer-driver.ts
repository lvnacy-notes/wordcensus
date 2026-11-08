/**
 * Runs the timer in real time. It ticks once a second while any run is
 * running and not at all otherwise, re-checks when the app returns to the
 * foreground, notifies the user when a countdown finishes, and saves after
 * every user action and whenever the app goes to the background. Scheduling,
 * the clock, foreground and background detection, and notices are passed in;
 * it imports nothing from Obsidian.
 */

import {
	endSession,
	isRunning,
	pauseTimer,
	rebindSession,
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

/** The notice shown when a countdown finishes. */
const COUNTDOWN_FINISHED_MESSAGE = 'Word Census: countdown finished.';

/** The notice shown when the timer cannot be saved. */
const SAVE_FAILED_MESSAGE = 'Word Census: failed to save the timer.';

/** The notice shown when a session ends because its note was deleted. */
const SESSION_ENDED_MESSAGE = 'Word Census: the session\'s note was deleted, so the session has ended.';

/** The interval between ticks, in milliseconds. */
const TICK_MS = 1000;

/******************************************************************************
 * Functions
******************************************************************************/

/**
 * Creates the driver for the store's timer. Call `begin` to start ticking and
 * saving, and `end` to stop and drop all listeners.
 *
 * @param store - The store holding the timer.
 * @param environment - Scheduling, the clock, foreground and background hooks, and notices.
 * @returns The timer driver.
 */
export function createTimerDriver(store: Store, environment: DriverEnvironment): TimerDriver {
	const listeners = new Set<() => void>();
	let cancelTicking: (() => void) | null = null;

	/** Notifies every listener. */
	const emit = (): void => {
		for (const listener of [...listeners]) {
			listener();
		}
	};

	/** Saves the store, notifying the user on failure. */
	const saveQuietly = (): void => {
		store.save().catch(() => environment.notify(SAVE_FAILED_MESSAGE));
	};

	/** Starts ticking while any run is running, and stops otherwise. */
	const syncTicking = (): void => {
		const {
			countdown,
			session,
			stopwatch
		} = store.timer;
		const needed = [
			stopwatch,
			countdown,
			session
		].some(isRunning);
		if (needed && cancelTicking === null) {
			cancelTicking = environment.schedule(check, TICK_MS);
		} else if (!needed && cancelTicking !== null) {
			cancelTicking();
			cancelTicking = null;
		}
	};

	/** Adopts a changed timer: updates ticking, saves, and notifies. Ignores an unchanged timer. */
	const commit = (next: TimerState): void => {
		if (next === store.timer) {
			return;
		}
		store.replaceTimer(next);
		syncTicking();
		saveQuietly();
		emit();
	};

	/** Advances the timer to the current time, notifying the user if a countdown finished. */
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
		/** Saves on background, re-checks on foreground, and starts ticking if a run is running. */
		begin(): void {
			environment.onBackground(saveQuietly);
			environment.onForeground(check);
			syncTicking();
			check();
		},
		/** Stops ticking and drops all listeners. */
		end(): void {
			cancelTicking?.();
			cancelTicking = null;
			listeners.clear();
		},
		/** Ends the session if its note is `path` or inside it, notifying the user. */
		endSession(path: string, currentWords: number | null): void {
			const before = store.timer;
			const after = endSession(
				before,
				path,
				environment.now(),
				currentWords
			);
			if (after !== before) {
				environment.notify(SESSION_ENDED_MESSAGE);
			}
			commit(after);
		},
		/** Pauses the selected mode. */
		pause(): void {
			commit(pauseTimer(store.timer, environment.now()));
		},
		/** Follows the session's note from `oldPath` to `newPath`. */
		rebind(oldPath: string, newPath: string): void {
			commit(rebindSession(store.timer, oldPath, newPath));
		},
		/** Resets the selected mode. */
		reset(): void {
			commit(resetTimer(store.timer));
		},
		/** Selects a mode without stopping or resetting anything. */
		selectMode(mode: TimerMode): void {
			commit({ ...store.timer, mode });
		},
		/** Sets the countdown's duration, in milliseconds. */
		setCountdownDuration(durationMs: number): void {
			commit(setCountdownDuration(store.timer, durationMs));
		},
		/** Starts or resumes the selected mode, binding a session to `binding`. */
		start(binding?: SessionBinding): void {
			commit(startTimer(store.timer, environment.now(), binding));
		},
		/** Calls `listener` after each change; returns a function that unsubscribes it. */
		subscribe(listener: () => void): () => void {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		}
	};
}