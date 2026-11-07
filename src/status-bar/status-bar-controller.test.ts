import {
	describe,
	expect,
	it
} from 'vitest';
import { createStatusBarController } from './status-bar-controller';
import { createStore } from '../settings/store';
import { fakePersistence } from '../test/fakes';
import type { NoteInfo, StatusBarDisplay } from '../types';

const NOTE: NoteInfo = {
	count: {
		heading: null,
		headingFound: true,
		mode: 'note',
		pairs: 0,
		words: 7
	},
	path: 'a.md',
	title: 'a'
};

async function buildHarness(initial: unknown = undefined) {
	const { persistence } = fakePersistence(initial);
	const store = createStore(persistence, () => 0);
	await store.load();
	const shown: (string | null)[] = [];
	const display: StatusBarDisplay = {
		hide: () => {
			shown.push(null);
		},
		show: (text) => {
			shown.push(text);
		}
	};
	let note: NoteInfo | null = NOTE;
	let changed: () => void = () => undefined;
	let watching = 0;
	const controller = createStatusBarController({
		display,
		readNote: () => Promise.resolve(note),
		store,
		// Like the real watcher, this also tells the controller when a setting changes.
		watchNotes: (handler) => {
			changed = handler;
			watching += 1;
			const unsubscribe = store.subscribe(handler);
			return () => {
				unsubscribe();
				watching -= 1;
			};
		}
	});
	return {
		change: () => changed(),
		controller,
		setNote: (next: NoteInfo | null) => {
			note = next;
		},
		shown,
		store,
		watching: () => watching
	};
}

async function settle(): Promise<void> {
	await new Promise((resolve) => window.setTimeout(resolve, 0));
}

describe('createStatusBarController', () => {
	it('shows the active note\'s count and follows note changes', async () => {
		const harness = await buildHarness();
		harness.controller.start();
		await settle();
		harness.setNote(null);
		harness.change();
		await settle();

		expect(harness.shown).toEqual([
			null,
			'7 words',
			null
		]);
	});

	it('hides when the setting is turned off and returns when it is turned on', async () => {
		const harness = await buildHarness();
		harness.controller.start();
		await settle();

		await harness.store.updateSettings({ showStatusBar: false });
		await harness.store.updateSettings({ showStatusBar: true });
		await settle();

		expect(harness.shown.slice(-3)).toEqual([
			'7 words',
			null,
			'7 words'
		]);
	});

	it('ignores a read that finishes after stopping', async () => {
		const harness = await buildHarness();
		harness.controller.start();
		harness.controller.stop();
		await settle();

		expect(harness.shown).not.toContain('7 words');
		expect(harness.watching()).toBe(0);
	});
});