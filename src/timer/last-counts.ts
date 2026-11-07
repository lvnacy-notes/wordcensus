/**
 * Remembers the last count seen for the note the session is bound to, so
 * that when the note is deleted, and can no longer be read, the session can
 * still keep its final figures. Imports nothing from Obsidian.
 *
 * The count is whatever the panel or the status bar last read, so it is only
 * as recent as their last refresh. It is null when neither has shown that
 * note since the session bound to it.
 */

import type { NoteInfo } from '../types';

/******************************************************************************
 * Interfaces and Types
******************************************************************************/

export interface LastCounts {
	/** Notes the count of `note` if it is the session's note, and returns `note` unchanged. */
	observe(note: NoteInfo | null): NoteInfo | null;
	/** The last count seen for the note at `path`, or null if none was seen. */
	recall(path: string): number | null;
}

/******************************************************************************
 * Functions
******************************************************************************/

/** `boundPath` returns the path of the session's note, or null when there is none. */
export function createLastCounts(boundPath: () => string | null): LastCounts {
	let remembered: { path: string; words: number } | null = null;
	return {
		observe(note: NoteInfo | null): NoteInfo | null {
			if (note !== null && note.path === boundPath()) {
				remembered = { path: note.path, words: note.count.words };
			}
			return note;
		},
		recall(path: string): number | null {
			return remembered !== null && remembered.path === path ? remembered.words : null;
		}
	};
}
