import {
	afterEach,
	describe,
	expect,
	it
} from 'vitest';
import { createPanelController } from './panel-controller';
import { createStore } from '../settings/store';
import { createTimerDriver } from '../timer/timer-driver';
import {
	fakeEnvironment,
	fakePersistence
} from '../test/fakes';
import type { FakeEnvironment } from '../test/test-types';
import type {
	NoteCount,
	NoteInfo,
	PanelController,
	TimerDriver
} from '../types';

interface Watcher {
	handler: () => void;
	stopped: boolean;
}

interface Setup {
	controller: PanelController;
	environment: FakeEnvironment;
	host: HTMLElement;
	notes: Map<string, NoteInfo>;
	state: SetupState;
	store: ReturnType<typeof createStore>;
	watchers: Watcher[];
}

interface SetupState {
	activePath: string | null;
	/** While set, note reads capture their value now but finish only when this resolves. */
	gate: Promise<void> | null;
	/** Timer subscriptions currently held. */
	subscribers: number;
}

const hosts: HTMLElement[] = [];

function buildNote(path: string, words: number): NoteInfo {
	const count: NoteCount = {
		heading: null,
		headingFound: true,
		mode: 'note',
		pairs: 0,
		words
	};
	return {
		count,
		path,
		title: path.replace('.md', '')
	};
}

async function flush(): Promise<void> {
	for (let turn = 0; turn < 10; turn += 1) {
		await Promise.resolve();
	}
}

async function buildSetup(): Promise<Setup> {
	const environment = fakeEnvironment();
	const { persistence } = fakePersistence(undefined);
	const store = createStore(persistence, environment.now);
	await store.load();
	const base = createTimerDriver(store, environment);
	base.begin();
	const state: SetupState = {
		activePath: 'novel.md',
		gate: null,
		subscribers: 0
	};
	const driver: TimerDriver = {
		...base,
		subscribe: (listener) => {
			state.subscribers += 1;
			const unsubscribe = base.subscribe(listener);
			return () => {
				state.subscribers -= 1;
				unsubscribe();
			};
		}
	};

	const notes = new Map<string, NoteInfo>([['novel.md', buildNote('novel.md', 100)]]);
	const watchers: Watcher[] = [];
	const controller = createPanelController({
		driver,
		now: environment.now,
		readNote: async (path) => {
			const target = path ?? state.activePath;
			const note = target === null ? null : notes.get(target) ?? null;
			await state.gate;
			return note;
		},
		store,
		watchNotes: (handler) => {
			const watcher: Watcher = { handler, stopped: false };
			watchers.push(watcher);
			return () => {
				watcher.stopped = true;
			};
		}
	});

	const host = createDiv();
	document.body.appendChild(host);
	hosts.push(host);
	return {
		controller,
		environment,
		host,
		notes,
		state,
		store,
		watchers
	};
}

function text(host: HTMLElement, selector: string): string | null {
	return host.querySelector(selector)?.textContent ?? null;
}

function click(host: HTMLElement, selector: string, index = 0): void {
	host.querySelectorAll<HTMLButtonElement>(selector)[index]?.click();
}

afterEach(() => {
	for (const host of hosts.splice(0)) {
		host.remove();
	}
});

describe('createPanelController', () => {
	it('shows the active note when opened', async () => {
		const { controller, host } = await buildSetup();

		controller.open(host);
		await flush();

		expect(text(host, '.wordcensus-summary-headline')).toBe('100 words');
	});

	it('follows the note as it changes', async () => {
		const {
			controller,
			host,
			notes,
			watchers
		} = await buildSetup();
		controller.open(host);
		await flush();

		notes.set('novel.md', buildNote('novel.md', 130));
		watchers[0]?.handler();
		await flush();

		expect(text(host, '.wordcensus-summary-headline')).toBe('130 words');
	});

	it('redraws on every timer tick', async () => {
		const { controller, environment, host } = await buildSetup();
		controller.open(host);
		await flush();
		click(host, '.wordcensus-toggle');
		await flush();

		environment.time += 5000;
		environment.tick();

		expect(text(host, '.wordcensus-row-value')).toBe('0:05');
	});

	describe('lifecycle', () => {
		it('releases the timer and note subscriptions when closed', async () => {
			const {
				controller,
				host,
				state,
				watchers
			} = await buildSetup();
			controller.open(host);
			await flush();
			const heldWhileOpen = state.subscribers;

			controller.close();

			expect(heldWhileOpen).toBe(1);
			expect(state.subscribers).toBe(0);
			expect(watchers[0]?.stopped).toBe(true);
			expect(host.querySelector('.wordcensus-panel')).toBeNull();
		});

		it('leaves exactly one live subscription after closing and reopening', async () => {
			const {
				controller,
				host,
				state,
				watchers
			} = await buildSetup();

			controller.open(host);
			controller.close();
			controller.open(host);
			await flush();

			expect(state.subscribers).toBe(1);
			expect(watchers.filter((watcher) => !watcher.stopped)).toHaveLength(1);
			expect(host.querySelectorAll('.wordcensus-panel')).toHaveLength(1);
		});

		it('replaces the panel when opened twice without closing', async () => {
			const {
				controller,
				host,
				state,
				watchers
			} = await buildSetup();

			controller.open(host);
			controller.open(host);
			await flush();

			expect(state.subscribers).toBe(1);
			expect(watchers.filter((watcher) => !watcher.stopped)).toHaveLength(1);
			expect(host.querySelectorAll('.wordcensus-panel')).toHaveLength(1);
		});

		it('ignores a note read that finishes after the panel was closed and reopened', async () => {
			const {
				controller,
				host,
				notes,
				state
			} = await buildSetup();
			let release: () => void = () => undefined;
			state.gate = new Promise<void>((resolve) => {
				release = resolve;
			});
			controller.open(host);
			controller.close();
			state.gate = null;
			notes.set('novel.md', buildNote('novel.md', 200));
			controller.open(host);
			await flush();

			release();
			await flush();

			expect(text(host, '.wordcensus-summary-headline')).toBe('200 words');
		});
	});

	describe('actions', () => {
		it('starts and pauses the selected timer', async () => {
			const { controller, host, store } = await buildSetup();
			controller.open(host);
			await flush();

			click(host, '.wordcensus-toggle');
			await flush();
			const { startedAt } = store.timer.stopwatch;
			click(host, '.wordcensus-toggle');
			await flush();

			expect(startedAt).toBeTruthy();
			expect(store.timer.stopwatch.startedAt).toBeNull();
		});

		it('switches mode from the pill', async () => {
			const { controller, host, store } = await buildSetup();
			controller.open(host);
			await flush();

			click(host, '.wordcensus-mode', 1);
			await flush();

			expect(store.timer.mode).toBe('countdown');
		});

		it('resets the selected timer', async () => {
			const {
				controller,
				environment,
				host,
				store
			} = await buildSetup();
			controller.open(host);
			await flush();
			click(host, '.wordcensus-toggle');
			await flush();
			environment.time += 5000;

			click(host, '.wordcensus-reset');
			await flush();

			expect(store.timer.stopwatch).toEqual({ accumulatedMs: 0, startedAt: null });
		});

		it('sets the countdown length in minutes', async () => {
			const { controller, host, store } = await buildSetup();
			controller.open(host);
			click(host, '.wordcensus-mode', 1);
			await flush();
			const input = host.querySelector<HTMLInputElement>('.wordcensus-duration-input');

			if (input !== null) {
				input.value = '10';
				input.dispatchEvent(new Event('change'));
			}

			expect(store.timer.countdown.durationMs).toBe(600_000);
		});
	});

	describe('session', () => {
		it('binds with the count at the moment of starting, even if the panel has not caught up', async () => {
			const {
				controller,
				host,
				notes,
				store
			} = await buildSetup();
			controller.open(host);
			await flush();
			click(host, '.wordcensus-mode', 2);
			notes.set('novel.md', buildNote('novel.md', 130));

			click(host, '.wordcensus-toggle');
			await flush();

			expect(store.timer.session.binding).toEqual({ baselineWords: 130, path: 'novel.md' });
		});

		it('forgets the bound note when reset', async () => {
			const { controller, host } = await buildSetup();
			controller.open(host);
			await flush();
			click(host, '.wordcensus-mode', 2);
			click(host, '.wordcensus-toggle');
			await flush();

			click(host, '.wordcensus-reset');
			await flush();

			const values = Array.from(host.querySelectorAll('.wordcensus-row-value')).map((node) => node.textContent);
			expect(values).toContain('Not bound');
		});

		it('binds to the active note, then measures words against it', async () => {
			const {
				controller,
				environment,
				host,
				notes,
				state,
				store
			} = await buildSetup();
			notes.set('other.md', buildNote('other.md', 5));
			controller.open(host);
			await flush();
			click(host, '.wordcensus-mode', 2);
			await flush();

			click(host, '.wordcensus-toggle');
			await flush();
			state.activePath = 'other.md';
			notes.set('novel.md', buildNote('novel.md', 160));
			environment.time += 60_000;
			environment.tick();
			click(host, '.wordcensus-mode', 0);
			click(host, '.wordcensus-mode', 2);
			controller.open(host);
			await flush();

			expect(store.timer.session.binding).toEqual({ baselineWords: 100, path: 'novel.md' });
			const values = Array.from(host.querySelectorAll('.wordcensus-row-value')).map((node) => node.textContent);
			expect(values).toContain('+60');
		});
	});
});