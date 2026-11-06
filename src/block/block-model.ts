/**
 * Pure logic for a `wordcount` code block: reading its parameters and
 * counting the note it sits in.
 */

import {
	countHeading,
	countNote
} from '../counting/note-count';
import type {
	BlockOptions,
	NoteCount,
	NoteText,
	WordCensusSettings
} from '../types';

/******************************************************************************
 * Declared Variables and Constants
******************************************************************************/

const HEADING_LINE = /^\s*heading\s*:(.*)$/i;
const SURROUNDING_QUOTES = /^(["'])(.*)\1$/;

/******************************************************************************
 * Functions
******************************************************************************/

/**
 * Counts the note for a block. A block with a `heading` counts under that
 * heading in every case; any other block counts the note's own region, as
 * the sidebar panel does.
 */
export function countBlock(
	note: NoteText,
	options: BlockOptions,
	settings: WordCensusSettings
): NoteCount {
	return options.heading === null
		? countNote(
			note.text,
			settings,
			note.headingOverride
		)
		: countHeading(
			note.text,
			settings,
			options.heading
		);
}

/**
 * Reads the block body. The only parameter is a `heading:` line, matched
 * case-insensitively; its value is trimmed and may be wrapped in quotes.
 * The first `heading:` line with a value wins, and every other line is
 * ignored.
 */
export function parseBlockSource(source: string): BlockOptions {
	for (const line of source.split(/\r\n|\r|\n/)) {
		const match = HEADING_LINE.exec(line);
		if (match === null) {
			continue;
		}
		const value = (match[1] ?? '').trim().replace(SURROUNDING_QUOTES, '$2').trim();
		if (value !== '') {
			return { heading: value };
		}
	}
	return { heading: null };
}