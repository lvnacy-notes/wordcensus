import {
	describe,
	expect,
	it
} from 'vitest';
import { createNoteWatcher } from './note-watcher';
import type { Debounced, WatcherSources } from '../types';

type SourceName = 'active' | 'delete' | 'edit' | 'metadata' | 'move' | 'settings';
type Handler = (...args: string[]) => void;

interface Harness {
	cancelled(): number;
	emit(name: SourceName, ...args: string[]): void;
	/** Runs the edit notification a debounced call left waiting. */
	flushEdit(): void;
	/** How many handlers are listening to each Obsidian event. */
	listening(name: SourceName): number;
	setActivePath(path: string | null): void;
	sources: WatcherSources;
}

function buildHarness(): Harness {
	const handlers: Record<SourceName, Handler[]> = {
		active: [],
		delete: [],
		edit: [],
		metadata: [],
		move: [],
		settings: []
	};
	let activePath: string | null = null;
	let cancelled = 0;
	let waiting: (() => void) | null = null;

	const listen = (name: SourceName) => (handler: Handler): (() => void) => {
		handlers[name].push(handler);
		return () => {
			handlers[name] = handlers[name].filter((candidate) => candidate !== handler);
		};
	};

	const sources: WatcherSources = {
		activePath: () => activePath,
		debounce: (handler): Debounced => Object.assign(
			() => {
				waiting = handler;
			},
			{
				cancel: () => {
					cancelled += 1;
					waiting = null;
				}
			}
		),
		onActive: listen('active'),
		onDelete: listen('delete'),
		onEdit: listen('edit'),
		onMetadata: listen('metadata'),
		onMove: listen('move'),
		onSettings: listen('settings')
	};

	return {
		cancelled: () => cancelled,
		emit: (name, ...args) => {
			for (const handler of [...handlers[name]]) {
				handler(...args);
			}
		},
		flushEdit: () => {
			const run = waiting;
			waiting = null;
			run?.();
		},
		listening: (name) => handlers[name].length,
		setActivePath: (path) => {
			activePath = path;
		},
		sources
	};
}

/** A handler that counts its calls. */
function counter(): { calls: () => number; handler: () => void } {
	let calls = 0;
	return {
		calls: () => calls,
		handler: () => {
			calls += 1;
		}
	};
}

const ALL_SOURCES: SourceName[] = [
	'active',
	'delete',
	'edit',
	'metadata',
	'move',
	'settings'
];

describe('createNoteWatcher', () => {
	describe('listening to Obsidian', () => {
		it('listens to nothing until something subscribes', () => {
			const harness = buildHarness();

			createNoteWatcher(harness.sources);

			for (const name of ALL_SOURCES) {
				expect(harness.listening(name)).toBe(0);
			}
		});

		it('listens once however many watchers there are, and stops after the last', () => {
			const harness = buildHarness();
			const watcher = createNoteWatcher(harness.sources);
			const stops = [
				watcher.watch(() => undefined),
				watcher.watch(() => undefined),
				watcher.watch(() => undefined)
			];

			const whileWatching = ALL_SOURCES.map((name) => harness.listening(name));
			for (const stop of stops) {
				stop();
			}

			expect(whileWatching).toEqual([
				1,
				1,
				1,
				1,
				1,
				1
			]);
			for (const name of ALL_SOURCES) {
				expect(harness.listening(name)).toBe(0);
			}
		});

		it('listens only to moves and deletions for a handler that is not watching notes', () => {
			const harness = buildHarness();
			const watcher = createNoteWatcher(harness.sources);

			watcher.onMove(() => undefined);
			watcher.onDelete(() => undefined);

			expect(harness.listening('move')).toBe(1);
			expect(harness.listening('delete')).toBe(1);
			expect(harness.listening('active')).toBe(0);
			expect(harness.listening('edit')).toBe(0);
			expect(harness.listening('metadata')).toBe(0);
			expect(harness.listening('settings')).toBe(0);
		});

		it('stops listening to moves and deletions once their handlers stop', () => {
			const harness = buildHarness();
			const watcher = createNoteWatcher(harness.sources);
			const stopMove = watcher.onMove(() => undefined);
			const stopDelete = watcher.onDelete(() => undefined);

			stopMove();
			stopDelete();

			expect(harness.listening('move')).toBe(0);
			expect(harness.listening('delete')).toBe(0);
		});

		it('cancels an edit notification still waiting when the last watcher stops', () => {
			const harness = buildHarness();
			const watcher = createNoteWatcher(harness.sources);
			const { calls, handler } = counter();
			const stop = watcher.watch(handler);
			harness.emit('edit');

			stop();
			harness.flushEdit();

			expect(harness.cancelled()).toBe(1);
			expect(calls()).toBe(0);
		});

		it('stops listening to everything when disposed', () => {
			const harness = buildHarness();
			const watcher = createNoteWatcher(harness.sources);
			const { calls, handler } = counter();
			watcher.watch(handler);
			watcher.onMove(() => undefined);
			watcher.onDelete(() => undefined);

			watcher.dispose();
			harness.emit('active');

			for (const name of ALL_SOURCES) {
				expect(harness.listening(name)).toBe(0);
			}
			expect(calls()).toBe(0);
		});

		it('listens again to a watcher that subscribes after the last one stopped', () => {
			const harness = buildHarness();
			const watcher = createNoteWatcher(harness.sources);
			watcher.watch(() => undefined)();
			const { calls, handler } = counter();

			watcher.watch(handler);
			harness.emit('active');

			expect(calls()).toBe(1);
			expect(harness.listening('active')).toBe(1);
		});
	});

	describe('telling watchers', () => {
		it('tells every watcher when the active note changes', () => {
			const harness = buildHarness();
			const watcher = createNoteWatcher(harness.sources);
			const first = counter();
			const second = counter();
			watcher.watch(first.handler);
			watcher.watch(second.handler, { paths: () => ['elsewhere.md'] });

			harness.emit('active');

			expect(first.calls()).toBe(1);
			expect(second.calls()).toBe(1);
		});

		it('tells every watcher about a setting change straight away', () => {
			const harness = buildHarness();
			const watcher = createNoteWatcher(harness.sources);
			const { calls, handler } = counter();
			watcher.watch(handler, { paths: () => [] });

			harness.emit('settings');

			expect(calls()).toBe(1);
		});

		it('merges a burst of edits into one notification', () => {
			const harness = buildHarness();
			const watcher = createNoteWatcher(harness.sources);
			const { calls, handler } = counter();
			watcher.watch(handler);

			harness.emit('edit');
			harness.emit('edit');
			harness.emit('edit');
			const beforeTheDelay = calls();
			harness.flushEdit();

			expect(beforeTheDelay).toBe(0);
			expect(calls()).toBe(1);
		});

		it('stops telling a watcher that has stopped', () => {
			const harness = buildHarness();
			const watcher = createNoteWatcher(harness.sources);
			const stopped = counter();
			const staying = counter();
			const stop = watcher.watch(stopped.handler);
			watcher.watch(staying.handler);

			stop();
			harness.emit('active');

			expect(stopped.calls()).toBe(0);
			expect(staying.calls()).toBe(1);
		});

		it('lets a watcher stop itself while being told', () => {
			const harness = buildHarness();
			const watcher = createNoteWatcher(harness.sources);
			const later = counter();
			const stopSelf = watcher.watch(() => {
				stopSelf();
			});
			watcher.watch(later.handler);

			harness.emit('active');

			expect(later.calls()).toBe(1);
		});
	});

	describe('property changes', () => {
		it('tells a watcher with no options about every note', () => {
			const harness = buildHarness();
			const watcher = createNoteWatcher(harness.sources);
			const { calls, handler } = counter();
			watcher.watch(handler);

			harness.emit('metadata', 'a.md');
			harness.emit('metadata', 'b.md');

			expect(calls()).toBe(2);
		});

		it('tells a watcher of the active note only about the active note', () => {
			const harness = buildHarness();
			const watcher = createNoteWatcher(harness.sources);
			const { calls, handler } = counter();
			watcher.watch(handler, { active: true });
			harness.setActivePath('a.md');

			harness.emit('metadata', 'b.md');
			const afterOther = calls();
			harness.emit('metadata', 'a.md');

			expect(afterOther).toBe(0);
			expect(calls()).toBe(1);
		});

		it('follows the active note as it changes', () => {
			const harness = buildHarness();
			const watcher = createNoteWatcher(harness.sources);
			const { calls, handler } = counter();
			watcher.watch(handler, { active: true });
			harness.setActivePath('a.md');
			harness.emit('metadata', 'b.md');

			harness.setActivePath('b.md');
			harness.emit('metadata', 'b.md');

			expect(calls()).toBe(1);
		});

		it('tells a watcher of listed paths only about those', () => {
			const harness = buildHarness();
			const watcher = createNoteWatcher(harness.sources);
			const { calls, handler } = counter();
			watcher.watch(handler, { paths: () => ['x.md'] });
			harness.setActivePath('a.md');

			harness.emit('metadata', 'a.md');
			harness.emit('metadata', 'y.md');
			const afterOthers = calls();
			harness.emit('metadata', 'x.md');

			expect(afterOthers).toBe(0);
			expect(calls()).toBe(1);
		});

		it('reads the listed paths again for every event', () => {
			const harness = buildHarness();
			const watcher = createNoteWatcher(harness.sources);
			const { calls, handler } = counter();
			let listed = ['x.md'];
			watcher.watch(handler, { paths: () => listed });
			harness.emit('metadata', 'y.md');

			listed = ['y.md'];
			harness.emit('metadata', 'y.md');

			expect(calls()).toBe(1);
		});

		it('tells a watcher of both the active note and listed paths about either', () => {
			const harness = buildHarness();
			const watcher = createNoteWatcher(harness.sources);
			const { calls, handler } = counter();
			watcher.watch(handler, { active: true, paths: () => ['bound.md'] });
			harness.setActivePath('a.md');

			harness.emit('metadata', 'a.md');
			harness.emit('metadata', 'bound.md');
			harness.emit('metadata', 'other.md');

			expect(calls()).toBe(2);
		});

		it('tells a watcher with empty options about no note', () => {
			const harness = buildHarness();
			const watcher = createNoteWatcher(harness.sources);
			const { calls, handler } = counter();
			watcher.watch(handler, {});
			harness.setActivePath('a.md');

			harness.emit('metadata', 'a.md');

			expect(calls()).toBe(0);
		});
	});

	describe('moves and deletions', () => {
		it('passes a move to its handlers, then tells the watchers', () => {
			const harness = buildHarness();
			const watcher = createNoteWatcher(harness.sources);
			const order: string[] = [];
			watcher.onMove((oldPath, newPath) => {
				order.push(`moved ${ oldPath } to ${ newPath }`);
			});
			watcher.watch(() => {
				order.push('watcher');
			}, { paths: () => [] });

			harness.emit('move', 'a.md', 'b.md');

			expect(order).toEqual(['moved a.md to b.md', 'watcher']);
		});

		it('passes a deletion to its handlers, then tells the watchers', () => {
			const harness = buildHarness();
			const watcher = createNoteWatcher(harness.sources);
			const order: string[] = [];
			watcher.onDelete((path) => {
				order.push(`deleted ${ path }`);
			});
			watcher.watch(() => {
				order.push('watcher');
			}, { paths: () => [] });

			harness.emit('delete', 'a.md');

			expect(order).toEqual(['deleted a.md', 'watcher']);
		});

		it('passes moves and deletions to its handlers with no watcher at all', () => {
			const harness = buildHarness();
			const watcher = createNoteWatcher(harness.sources);
			const moves: string[] = [];
			const deletions: string[] = [];
			watcher.onMove((oldPath, newPath) => {
				moves.push(`${ oldPath }>${ newPath }`);
			});
			watcher.onDelete((path) => {
				deletions.push(path);
			});

			harness.emit('move', 'a.md', 'b.md');
			harness.emit('delete', 'c.md');

			expect(moves).toEqual(['a.md>b.md']);
			expect(deletions).toEqual(['c.md']);
		});

		it('stops passing moves to a handler that has stopped', () => {
			const harness = buildHarness();
			const watcher = createNoteWatcher(harness.sources);
			const moves: string[] = [];
			const stop = watcher.onMove((oldPath) => {
				moves.push(oldPath);
			});
			watcher.onMove(() => undefined);

			stop();
			harness.emit('move', 'a.md', 'b.md');

			expect(moves).toEqual([]);
		});
	});
});
