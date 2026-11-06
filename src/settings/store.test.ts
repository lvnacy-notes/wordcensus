import {
	describe,
	expect,
	it
} from 'vitest';
import { DEFAULT_SETTINGS, MAX_COUNTDOWN_MINUTES } from './settings';
import { createStore } from './store';
import { createTimer, startTimer } from '../timer/timer';
import { MALFORMED_SETTINGS, fakePersistence } from '../test/fakes';

const T0 = 1_000_000;

describe('createStore', () => {
	describe('load', () => {
		it('normalizes the saved settings and restores the saved timer together', async () => {
			const { persistence } = fakePersistence({
				keepTimerState: true,
				heading: ' Draft ',
				timer: { stopwatch: { accumulatedMs: 5000, startedAt: T0 } }
			});
			const store = createStore(persistence, () => T0);

			await store.load();

			expect(store.settings.heading).toBe('Draft');
			expect(store.timer.stopwatch).toEqual({ accumulatedMs: 5000, startedAt: null });
		});

		it('loads the defaults when the saved data is malformed', async () => {
			const { persistence } = fakePersistence(MALFORMED_SETTINGS);
			const store = createStore(persistence, () => T0);

			await store.load();

			expect(store.settings).toEqual(DEFAULT_SETTINGS);
		});
	});

	describe('save', () => {
		it('writes the settings without a timer when keeping timer state is off', async () => {
			const { persistence, saved } = fakePersistence({ heading: 'Draft' });
			const store = createStore(persistence, () => T0);
			await store.load();

			await store.save();

			expect(saved).toEqual([{ ...DEFAULT_SETTINGS, heading: 'Draft' }]);
		});

		it('writes the timer too when keeping timer state is on', async () => {
			const { persistence, saved } = fakePersistence({
				keepTimerState: true,
				timer: { stopwatch: { accumulatedMs: 5000, startedAt: null } }
			});
			const store = createStore(persistence, () => T0);
			await store.load();

			await store.save();

			expect(saved).toEqual([{ ...store.settings, timer: store.timer }]);
		});
	});

	describe('replaceTimer', () => {
		it('swaps the timer in without saving', () => {
			const { persistence, saved } = fakePersistence(undefined);
			const store = createStore(persistence, () => T0);
			const running = startTimer(createTimer(), T0);

			store.replaceTimer(running);

			expect(store.timer).toBe(running);
			expect(saved).toEqual([]);
		});
	});

	describe('subscribe', () => {
		it('tells listeners about settings changes until they unsubscribe', async () => {
			const { persistence } = fakePersistence(undefined);
			const store = createStore(persistence, () => T0);
			let calls = 0;
			const unsubscribe = store.subscribe(() => {
				calls += 1;
			});

			await store.updateSettings({ heading: 'Draft' });
			unsubscribe();
			await store.updateSettings({ heading: 'Other' });

			expect(calls).toBe(1);
		});
	});

	describe('updateSettings', () => {
		it('normalizes the change, keeps it, and saves the result', async () => {
			const { persistence, saved } = fakePersistence(undefined);
			const store = createStore(persistence, () => T0);

			await store.updateSettings({ heading: '  Chapter 3  ', defaultCountdownMinutes: 99999 });

			expect(store.settings.heading).toBe('Chapter 3');
			expect(store.settings.defaultCountdownMinutes).toBe(MAX_COUNTDOWN_MINUTES);
			expect(saved).toEqual([store.settings]);
		});

		it('keeps the other settings when one changes', async () => {
			const { persistence } = fakePersistence({ includeEmbeds: true });
			const store = createStore(persistence, () => T0);
			await store.load();

			await store.updateSettings({ heading: 'Draft' });

			expect(store.settings.includeEmbeds).toBe(true);
			expect(store.settings.heading).toBe('Draft');
		});
	});
});