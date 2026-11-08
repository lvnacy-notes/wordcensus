/**
 * Counts the words in one note's region: the text between sentinel markers,
 * else under the configured heading, else the whole note.
 */

import { countWords } from './count';
import { extractHeadingRegion, extractRegion } from './region';
import type { NoteCount, WordCensusSettings } from '../types';

/**
 * Counts the words under `heading`, regardless of any markers or configured
 * heading in the note. A heading that is not found gives zero words with
 * `headingFound: false`.
 *
 * @param text - The note text.
 * @param settings - The plugin settings supplying the counting options.
 * @param heading - The heading to count under.
 * @returns The count, in `heading` mode.
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
 * `headingOverride` replaces the configured heading for this note; it has no
 * effect when the note has sentinel markers.
 *
 * @param text - The note text.
 * @param settings - The plugin settings supplying the heading and counting options.
 * @param headingOverride - A per-note heading, or `null` to use the configured one.
 * @returns The count, in `sentinel`, `heading`, or `note` mode.
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