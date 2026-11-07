/**
 * One shared watcher over the vault. The panel, the status bar and every
 * `wordcount` block listen through it, so Obsidian is listened to once however
 * many of them are open, and a property change in a note nobody is showing
 * wakes nobody. The events themselves arrive through `WatcherSources`; it
 * imports nothing from Obsidian.
 *
 * It listens to Obsidian only while something is subscribed: the editing,
 * active-note, property and setting events while there is a watcher, and the
 * move and delete events while there is a watcher or a move or delete handler.
 */

import type {
	Debounced,
	NoteWatcher,
	WatchOptions,
	WatcherSources
} from '../types';

/******************************************************************************
 * Interfaces and Types
******************************************************************************/

interface Subscription {
	handler: () => void;
	options: WatchOptions | undefined;
}

/******************************************************************************
 * Declared Variables and Constants
******************************************************************************/

const EDIT_DEBOUNCE_MS = 500;

/******************************************************************************
 * Functions
******************************************************************************/

export function createNoteWatcher(sources: WatcherSources): NoteWatcher {
	const subscriptions = new Set<Subscription>();
	const deleteHandlers = new Set<{ handler: (path: string) => void }>();
	const moveHandlers = new Set<{ handler: (oldPath: string, newPath: string) => void }>();
	let stopNotes: (() => void) | null = null;
	let stopFiles: (() => void) | null = null;

	// Every notification loop walks a copy, so a handler may unsubscribe itself.
	const notifyAll = (): void => {
		for (const subscription of [...subscriptions]) {
			subscription.handler();
		}
	};

	const wants = (options: WatchOptions | undefined, path: string): boolean => {
		if (options === undefined) {
			return true;
		}
		if (options.active === true && path === sources.activePath()) {
			return true;
		}
		return options.paths?.().includes(path) ?? false;
	};

	const notifyMetadata = (path: string): void => {
		for (const subscription of [...subscriptions]) {
			if (wants(subscription.options, path)) {
				subscription.handler();
			}
		}
	};

	const listenToNotes = (): (() => void) => {
		const edits: Debounced = sources.debounce(notifyAll, EDIT_DEBOUNCE_MS);
		const stops = [
			sources.onActive(notifyAll),
			sources.onEdit(edits),
			sources.onMetadata(notifyMetadata),
			sources.onSettings(notifyAll)
		];
		return () => {
			for (const stop of stops) {
				stop();
			}
			edits.cancel();
		};
	};

	// Handlers run before the watchers, so a watcher that reads the timer after
	// a move or delete sees the timer already updated.
	const listenToFiles = (): (() => void) => {
		const stops = [
			sources.onMove((oldPath, newPath) => {
				for (const { handler } of [...moveHandlers]) {
					handler(oldPath, newPath);
				}
				notifyAll();
			}),
			sources.onDelete((path) => {
				for (const { handler } of [...deleteHandlers]) {
					handler(path);
				}
				notifyAll();
			})
		];
		return () => {
			for (const stop of stops) {
				stop();
			}
		};
	};

	const sync = (): void => {
		const watching = subscriptions.size > 0;
		const filing = watching || deleteHandlers.size > 0 || moveHandlers.size > 0;
		if (watching && stopNotes === null) {
			stopNotes = listenToNotes();
		} else if (!watching && stopNotes !== null) {
			stopNotes();
			stopNotes = null;
		}
		if (filing && stopFiles === null) {
			stopFiles = listenToFiles();
		} else if (!filing && stopFiles !== null) {
			stopFiles();
			stopFiles = null;
		}
	};

	const register = <T extends object>(entries: Set<T>, entry: T): (() => void) => {
		entries.add(entry);
		sync();
		return () => {
			entries.delete(entry);
			sync();
		};
	};

	return {
		dispose(): void {
			subscriptions.clear();
			deleteHandlers.clear();
			moveHandlers.clear();
			sync();
		},
		onDelete: (handler) => register(deleteHandlers, { handler }),
		onMove: (handler) => register(moveHandlers, { handler }),
		watch: (handler, options) => register(subscriptions, { handler, options })
	};
}
