/**
 * Shared test support: a settings factory, the malformed-settings fixture
 * and an in-memory persistence.
 */

import { DEFAULT_SETTINGS } from '../settings/settings';
import type {
	Persistence,
	WordCensusSettings
} from '../types';
import type {
	FakeEnvironment,
	FakePersistence
} from './test-types';

/** Every saved settings field set to a value of the wrong type. */
export const MALFORMED_SETTINGS: Readonly<Record<string, unknown>> = Object.freeze({
	defaultCountdownMinutes: 'ten',
	heading: 42,
	includeCodeBlocks: 'yes',
	includeEmbeds: null,
	includeFootnotes: 1,
	keepTimerState: 'true',
	showStatusBar: []
});

/** Settings for a test: the real defaults with the given fields changed. */
export function buildSettings(overrides: Partial<WordCensusSettings> = {}): WordCensusSettings {
	return { ...DEFAULT_SETTINGS, ...overrides };
}

/** A driver environment with a clock, scheduler and foreground hook that tests drive by hand. */
export function fakeEnvironment(startTime = 1_000_000): FakeEnvironment {
	let tickHandler: (() => void) | null = null;
	let foregroundHandler: (() => void) | null = null;
	const environment: FakeEnvironment = {
		cancelled: 0,
		notices: [],
		notify: (message) => {
			environment.notices.push(message);
		},
		now: () => environment.time,
		onForeground: (handler) => {
			foregroundHandler = handler;
		},
		returnToForeground: () => foregroundHandler?.(),
		schedule: (handler) => {
			environment.scheduled += 1;
			tickHandler = handler;
			return () => {
				environment.cancelled += 1;
				tickHandler = null;
			};
		},
		scheduled: 0,
		tick: () => tickHandler?.(),
		time: startTime
	};
	return environment;
}

/** Persistence that returns `initial` when loaded and records everything saved. */
export function fakePersistence(initial: unknown): FakePersistence {
	const saved: unknown[] = [];
	const persistence: Persistence = {
		load: () => Promise.resolve(initial),
		save: (data) => {
			saved.push(data);
			return Promise.resolve();
		}
	};
	return { persistence, saved };
}