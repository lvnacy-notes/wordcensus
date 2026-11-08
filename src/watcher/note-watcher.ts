/**
 * One shared watcher over the vault, through which the panel, the status bar,
 * and every `wordcount` block listen to Obsidian. Obsidian is listened to once
 * however many subscribers there are, and a property change wakes only the
 * subscribers that watch that note. Events arrive through `WatcherSources`;
 * the module imports nothing from Obsidian.
 *
 * It listens only while something is subscribed: editing, active-note,
 * property, and setting events while there is a watcher, and move and delete
 * events while there is a watcher or a move or delete handler.
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

/** A watcher's handler and the notes whose property changes it cares about. */
interface Subscription {
	handler: () => void;
	options: WatchOptions | undefined;
}

/******************************************************************************
 * Declared Variables and Constants
******************************************************************************/

/** The pause after the last edit before subscribers are notified, in milliseconds. */
const EDIT_DEBOUNCE_MS = 500;

/******************************************************************************
 * Functions
******************************************************************************/

/**
 * Creates the shared note watcher.
 *
 * @param sources - The Obsidian events the watcher listens to.
 * @returns The watcher, with `watch`, `onMove`, `onDelete`, and `dispose`.
 */
export function createNoteWatcher(sources: WatcherSources): NoteWatcher {
	const subscriptions = new Set<Subscription>();
	const deleteHandlers = new Set<{ handler: (path: string) => void }>();
	const moveHandlers = new Set<{ handler: (oldPath: string, newPath: string) => void }>();
	let stopNotes: (() => void) | null = null;
	let stopFiles: (() => void) | null = null;

	/** Notifies every subscriber; a handler may unsubscribe itself meanwhile. */
	const notifyAll = (): void => {
		for (const subscription of [...subscriptions]) {
			subscription.handler();
		}
	};

	/** Tells whether a subscription wants property changes for `path`. */
	const wants = (options: WatchOptions | undefined, path: string): boolean => {
		if (options === undefined) {
			return true;
		}
		if (options.active === true && path === sources.activePath()) {
			return true;
		}
		return options.paths?.().includes(path) ?? false;
	};

	/** Notifies the subscribers that want property changes for `path`. */
	const notifyMetadata = (path: string): void => {
		for (const subscription of [...subscriptions]) {
			if (wants(subscription.options, path)) {
				subscription.handler();
			}
		}
	};

	/** Listens to editing, active-note, property, and setting events; returns a function that stops. */
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

	/** Listens to move and delete events, running handlers before notifying subscribers; returns a function that stops. */
	const listenToFiles = (): (() => void) => {
		const stopMove = sources.onMove((oldPath, newPath) => {
			for (const { handler } of [...moveHandlers]) {
				handler(oldPath, newPath);
			}
			notifyAll();
		});
		const stopDelete = sources.onDelete((path) => {
			for (const { handler } of [...deleteHandlers]) {
				handler(path);
			}
			notifyAll();
		});
		return () => {
			stopMove();
			stopDelete();
		};
	};

	/** Starts or stops listening so that it matches what is subscribed. */
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

	/** Adds an entry and syncs; returns a function that removes it. */
	const register = <T extends object>(entries: Set<T>, entry: T): (() => void) => {
		entries.add(entry);
		sync();
		return () => {
			entries.delete(entry);
			sync();
		};
	};

	return {
		/** Drops every subscriber and stops listening. */
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