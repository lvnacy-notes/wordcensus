/**
 * Counts the words in one note's region: the text between sentinel markers,
 * else under the configured heading, else the whole note.
 */

import { countWords } from './count';
import { extractRegion } from './region';
import type { NoteCount, WordCensusSettings } from '../types';

/**
 * Counts `text` using the counting options in `settings`. A non-blank
 * `headingOverride` replaces the configured heading for this note; it has
 * no effect when the note has sentinel markers.
 */
export function countNote(
	text: string,
	settings: WordCensusSettings,
	headingOverride: string | null = null
): NoteCount {
	const override = headingOverride?.trim() ?? '';
	const region = extractRegion(text, { heading: override === '' ? settings.heading : override });
	const words = countWords(region.text, settings);

	switch (region.mode) {
		case 'sentinel':
			return {
				heading: null,
				headingFound: true,
				mode: 'sentinel',
				pairs: region.pairs,
				words
			};
		case 'heading':
			return {
				heading: region.heading,
				headingFound: region.found,
				mode: 'heading',
				pairs: 0,
				words
			};
		case 'note':
			return {
				heading: null,
				headingFound: true,
				mode: 'note',
				pairs: 0,
				words
			};
	}
}