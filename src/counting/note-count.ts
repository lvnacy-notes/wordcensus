/**
 * Counts the words in one note's region: the text between sentinel markers,
 * else under the configured heading, else the whole note.
 */

import { countWords } from './count';
import { extractHeadingRegion, extractRegion } from './region';
import type { NoteCount, WordCensusSettings } from '../types';

/**
 * Counts the words under `heading`, whatever markers or configured heading
 * the note has. A heading that cannot be found gives zero words with
 * `headingFound: false`.
 */
export function countHeading(
	text: string,
	settings: WordCensusSettings,
	heading: string
): NoteCount {
	const region = extractHeadingRegion(text, heading);
	return {
		heading: region?.heading ?? heading.trim(),
		headingFound: region !== null,
		mode: 'heading',
		pairs: 0,
		words: countWords(region?.text ?? '', settings)
	};
}

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