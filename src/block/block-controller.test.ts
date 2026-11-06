import {
	afterEach,
	describe,
	expect,
	it
} from 'vitest';
import { createBlockController } from './block-controller';
import { createStore } from '../settings/store';
import {
	buildSettings,
	fakePersistence
} from '../test/fakes';
import type {
	BlockController,
	BlockOptions,
	NoteText
} from '../types';

interface Setup {
	controller: BlockController;
	host: HTMLElement;
	state: SetupState;
	watchers: Watcher[];
}

interface SetupState {
	/** While set, reads capture the note now but finish only when this resolves. */
	gate: Promise<void> | null;
	note: NoteText | null;
}

interface Watcher {
	handler: () => void;
	stopped: boolean;
}

const hosts: HTMLElement[] = [];

const TEXT = [
	'Intro words here.',
	'',
	'# Chapter 3',
	'one two three'
].join('\n');

function buildNote(content = TEXT): NoteText {
	return {
		headingOverride: null,
		path: 'novel.md',
		text: content,
		title: 'novel'
	};
}

async function flush(): Promise<void> {
	for (let turn = 0; turn < 10; turn += 1) {
		await Promise.resolve();
	}
}

async function buildSetup(options: BlockOptions = { heading: null }): Promise<Setup> {
	const { persistence } = fakePersistence(buildSettings());
	const store = createStore(persistence, () => 0);
	await store.load();

	const state: SetupState = {
		gate: null,
		note: buildNote()
	};
	const watchers: Watcher[] = [];
	const controller = createBlockController({
		options,
		readText: async () => {
			const { note } = state;
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
		host,
		state,
		watchers
	};
}

function text(host: HTMLElement, selector: string): string | null {
	return host.querySelector(selector)?.textContent ?? null;
}

afterEach(() => {
	for (const host of hosts.splice(0)) {
		host.remove();
	}
});

describe('createBlockController', () => {
	it('shows the note\'s count', async () => {
		const { controller, host } = await buildSetup();

		controller.open(host);
		await flush();

		expect(text(host, '.wordcensus-block-count')).toBe('8 words');
		expect(text(host, '.wordcensus-block-detail')).toBe('Whole note');
	});

	it('shows the count under the block\'s heading', async () => {
		const { controller, host } = await buildSetup({ heading: 'Chapter 3' });

		controller.open(host);
		await flush();

		expect(text(host, '.wordcensus-block-count')).toBe('3 words');
		expect(text(host, '.wordcensus-block-detail')).toBe('Under “Chapter 3”');
	});

	it('says so when the heading is not in the note', async () => {
		const { controller, host } = await buildSetup({ heading: 'Nowhere' });

		controller.open(host);
		await flush();

		expect(text(host, '.wordcensus-block-count')).toBe('Heading not found');
	});

	it('says so when the note cannot be read', async () => {
		const {
			controller,
			host,
			state
		} = await buildSetup();
		state.note = null;

		controller.open(host);
		await flush();

		expect(text(host, '.wordcensus-block-count')).toBe('Word count unavailable');
		expect(text(host, '.wordcensus-block-detail')).toBe('');
	});

	it('follows the note as it changes', async () => {
		const {
			controller,
			host,
			state,
			watchers
		} = await buildSetup();
		controller.open(host);
		await flush();

		state.note = buildNote('one two');
		watchers[0]?.handler();
		await flush();

		expect(text(host, '.wordcensus-block-count')).toBe('2 words');
	});

	describe('lifecycle', () => {
		it('stops watching and removes the count when closed', async () => {
			const {
				controller,
				host,
				watchers
			} = await buildSetup();
			controller.open(host);
			await flush();

			controller.close();

			expect(watchers[0]?.stopped).toBe(true);
			expect(host.querySelector('.wordcensus-block')).toBeNull();
		});

		it('leaves exactly one watcher and one count after closing and reopening', async () => {
			const {
				controller,
				host,
				watchers
			} = await buildSetup();

			controller.open(host);
			controller.close();
			controller.open(host);
			await flush();

			expect(watchers.filter((watcher) => !watcher.stopped)).toHaveLength(1);
			expect(host.querySelectorAll('.wordcensus-block')).toHaveLength(1);
		});

		it('replaces the count when opened twice without closing', async () => {
			const {
				controller,
				host,
				watchers
			} = await buildSetup();

			controller.open(host);
			controller.open(host);
			await flush();

			expect(watchers.filter((watcher) => !watcher.stopped)).toHaveLength(1);
			expect(host.querySelectorAll('.wordcensus-block')).toHaveLength(1);
		});

		it('ignores a read that finishes after the block was closed and reopened', async () => {
			const {
				controller,
				host,
				state
			} = await buildSetup();
			let release: () => void = () => undefined;
			state.gate = new Promise<void>((resolve) => {
				release = resolve;
			});
			controller.open(host);
			controller.close();
			state.gate = null;
			state.note = buildNote('one two three four');
			controller.open(host);
			await flush();

			release();
			await flush();

			expect(text(host, '.wordcensus-block-count')).toBe('4 words');
		});
	});
});