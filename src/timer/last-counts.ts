/**
 * Remembers the last count seen for the note the session is bound to;
 * imports nothing from Obsidian.
 *
 * The count is whatever the panel or the status bar last read, so it is only
 * as recent as their last refresh. `recall` gives `null` when neither has
 * shown that note since the session bound to it.
 */

import type { LastCounts, NoteInfo } from '../types';

/**
 * Creates an empty record of the session note's last count.
 *
 * @param boundPath - Returns the path of the session's note, or `null` when there is none.
 * @returns The record, with `observe` and `recall`.
 */
export function createLastCounts(boundPath: () => string | null): LastCounts {
	let remembered: { path: string; words: number } | null = null;

	/** Remembers `note`'s count when it is the session's note. */
	const observe = (note: NoteInfo | null): NoteInfo | null => {
		if (note !== null && note.path === boundPath()) {
			remembered = { path: note.path, words: note.count.words };
		}
		return note;
	};

	/** Gives the remembered count when it belongs to `path`. */
	const recall = (path: string): number | null => {
		return remembered !== null && remembered.path === path ? remembered.words : null;
	};

	return { observe, recall };
}