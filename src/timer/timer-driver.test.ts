import {
	describe,
	expect,
	it
} from 'vitest';
import { createStore } from '../settings/store';
import { freezeTimer, isCountdownFinished } from './timer';
import { createTimerDriver } from './timer-driver';
import type { Store, TimerDriver } from '../types';
import { fakeEnvironment, fakePersistence } from '../test/fakes';
import type { FakeEnvironment } from '../test/test-types';

const ONE_MINUTE = 60_000;

interface Harness {
	driver: TimerDriver;
	environment: FakeEnvironment;
	saved: unknown[];
	store: Store;
}

async function buildHarness(initial: unknown = undefined): Promise<Harness> {
	const { persistence, saved } = fakePersistence(initial);
	const environment = fakeEnvironment();
	const store = createStore(persistence, () => environment.time);
	await store.load();
	const driver = createTimerDriver(store, environment);
	driver.begin();
	return {
		driver,
		environment,
		saved,
		store
	};
}

describe('createTimerDriver', () => {
	describe('ticking', () => {
		it('ticks only while a run is running', async () => {
			const { driver, environment } = await buildHarness();

			driver.start();
			driver.pause();

			expect(environment.scheduled).toBe(1);
			expect(environment.cancelled).toBe(1);
		});

		it('keeps ticking when the selected mode changes away from a running run', async () => {
			const { driver, environment } = await buildHarness();
			driver.start();

			driver.selectMode('countdown');

			expect(environment.cancelled).toBe(0);
		});

		it('tells subscribers about every tick, and stops once they unsubscribe', async () => {
			const { driver, environment } = await buildHarness();
			let calls = 0;
			const unsubscribe = driver.subscribe(() => {
				calls += 1;
			});
			driver.start();
			const afterStart = calls;

			environment.tick();
			environment.tick();
			unsubscribe();
			environment.tick();

			expect(calls - afterStart).toBe(2);
		});
	});

	describe('countdown reaching zero', () => {
		it('stops the countdown, notifies once and stops ticking', async () => {
			const {
				driver,
				environment,
				store
			} = await buildHarness();
			driver.setCountdownDuration(ONE_MINUTE);
			driver.selectMode('countdown');
			driver.start();

			environment.time += ONE_MINUTE;
			environment.tick();
			environment.tick();

			expect(isCountdownFinished(store.timer.countdown)).toBe(true);
			expect(environment.notices).toEqual(['Word Census: countdown finished.']);
			expect(environment.cancelled).toBe(1);
		});

		it('lands on zero when the app returns to the foreground long after the end', async () => {
			const {
				driver,
				environment,
				store
			} = await buildHarness();
			driver.setCountdownDuration(ONE_MINUTE);
			driver.selectMode('countdown');
			driver.start();

			environment.time += 10 * ONE_MINUTE;
			environment.returnToForeground();

			expect(store.timer.countdown.accumulatedMs).toBe(ONE_MINUTE);
			expect(environment.notices).toEqual(['Word Census: countdown finished.']);
		});
	});

	describe('saving', () => {
		it('saves the timer after a user action when the timer is being kept', async () => {
			const {
				driver,
				environment,
				saved,
				store
			} = await buildHarness({ keepTimerState: true });

			driver.start();

			expect(saved).toEqual([{ ...store.settings, timer: freezeTimer(store.timer, environment.time) }]);
		});

		it('saves the elapsed time of a running timer when the app goes to the background', async () => {
			const {
				driver,
				environment,
				saved
			} = await buildHarness({ keepTimerState: true });
			driver.start();

			environment.time += 5000;
			environment.goToBackground();

			const lastSave = saved[saved.length - 1] as { timer: { stopwatch: { accumulatedMs: number; startedAt: number | null } } };
			expect(lastSave.timer.stopwatch).toEqual({ accumulatedMs: 5000, startedAt: null });
		});

		it('tells the user when saving fails', async () => {
			const {
				driver,
				environment,
				store
			} = await buildHarness();
			store.save = () => Promise.reject(new Error('disk full'));

			driver.start();
			await Promise.resolve();

			expect(environment.notices).toEqual(['Word Census: failed to save the timer.']);
		});
	});

	describe('a note being moved or deleted', () => {
		const NOTE = { baselineWords: 100, path: 'Drafts/Draft.md' };

		it('follows the session\'s note when its folder is renamed, and saves', async () => {
			const {
				driver,
				saved,
				store
			} = await buildHarness({ keepTimerState: true });
			driver.selectMode('session');
			driver.start(NOTE);
			const savesBefore = saved.length;

			driver.rebind('Drafts', 'Novel');

			expect(store.timer.session.binding).toEqual({ baselineWords: 100, path: 'Novel/Draft.md' });
			expect(saved.length).toBe(savesBefore + 1);
		});

		it('does nothing, and saves nothing, when another note is moved', async () => {
			const {
				driver,
				saved
			} = await buildHarness({ keepTimerState: true });
			driver.selectMode('session');
			driver.start(NOTE);
			const savesBefore = saved.length;

			driver.rebind('Other.md', 'Moved.md');

			expect(saved.length).toBe(savesBefore);
		});

		it('ends the session when its note is deleted: paused, unbound, figures kept, user told', async () => {
			const {
				driver,
				environment,
				store
			} = await buildHarness();
			driver.selectMode('session');
			driver.start(NOTE);
			environment.time += 2 * ONE_MINUTE;

			driver.endSession('Drafts/Draft.md', 160);

			expect(store.timer.session).toEqual({
				accumulatedMs: 2 * ONE_MINUTE,
				binding: null,
				result: { path: 'Drafts/Draft.md', wordsPerMinute: 30, wordsWritten: 60 },
				startedAt: null
			});
			expect(environment.notices).toEqual([
				'Word Census: the session\'s note was deleted, so the session has ended.'
			]);
			expect(environment.cancelled).toBe(1);
		});

		it('tells subscribers when the session ends', async () => {
			const { driver } = await buildHarness();
			driver.selectMode('session');
			driver.start(NOTE);
			let calls = 0;
			driver.subscribe(() => {
				calls += 1;
			});

			driver.endSession('Drafts', null);

			expect(calls).toBe(1);
		});

		it('says nothing when the deleted note is not the session\'s', async () => {
			const { driver, environment } = await buildHarness();
			driver.selectMode('session');
			driver.start(NOTE);

			driver.endSession('Other.md', 160);

			expect(environment.notices).toEqual([]);
		});
	});

	describe('end', () => {
		it('stops ticking and drops subscribers', async () => {
			const { driver, environment } = await buildHarness();
			let calls = 0;
			driver.start();
			driver.subscribe(() => {
				calls += 1;
			});

			driver.end();
			driver.pause();

			expect(environment.cancelled).toBe(1);
			expect(calls).toBe(0);
		});
	});
});