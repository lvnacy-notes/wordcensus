/** Pure logic for a `wordcount` code block: parsing its source and counting its note. */

import { countHeading, countNote } from '../counting/note-count';
import type {
	BlockOptions,
	NoteCount,
	NoteText,
	WordCensusSettings
} from '../types';

/******************************************************************************
 * Declared Variables and Constants
******************************************************************************/

/** Matches a `heading:` line and captures its raw value. */
const HEADING_LINE = /^\s*heading\s*:(.*)$/i;

/** Matches a value wrapped in a matching pair of single or double quotes. */
const SURROUNDING_QUOTES = /^(["'])(.*)\1$/;

/******************************************************************************
 * Functions
******************************************************************************/

/**
 * Counts the note for a block. A block with a `heading` counts under that
 * heading; any other block counts the note's own region, like the panel.
 *
 * @param note - The note text and its heading override.
 * @param options - The block's parsed options.
 * @param settings - The plugin settings.
 * @returns The count for the block.
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
 * Parses a block body. The only parameter is a `heading:` line, matched
 * case-insensitively, trimmed, and optionally wrapped in quotes. The first
 * `heading:` line with a value wins; all other lines are ignored.
 *
 * @param source - The raw block body.
 * @returns The parsed options, with a `null` heading when none is given.
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