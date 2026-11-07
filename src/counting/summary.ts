/**
 * Turns a note's count into the headline and detail line shown by the
 * sidebar panel, a `wordcount` block and the status bar. Imports nothing from
 * Obsidian.
 */

import type { NoteCount, PanelSummary } from '../types';

/** The headline and detail line for a count, or for no note when `count` is null. */
export function buildSummary(count: NoteCount | null): PanelSummary {
	if (count === null) {
		return { detail: '', headline: 'No note open' };
	}
	switch (count.mode) {
		case 'sentinel':
			return {
				detail: `Between markers (${ count.pairs } ${ count.pairs === 1 ? 'region' : 'regions' })`,
				headline: formatWords(count.words)
			};
		case 'heading':
			return count.headingFound
				? { detail: `Under “${ count.heading }”`, headline: formatWords(count.words) }
				: { detail: `No heading “${ count.heading }” in this note`, headline: 'Heading not found' };
		case 'note':
			return { detail: 'Whole note', headline: formatWords(count.words) };
	}
}

function formatWords(words: number): string {
	return `${ words } ${ words === 1 ? 'word' : 'words' }`;
}