/**
 * Turns a note's count into the status bar item's text and tooltip.
 * Imports nothing from Obsidian.
 */

import { buildSummary } from '../counting/summary';
import type { NoteCount, StatusBarContent } from '../types';

/** The item's text and tooltip, or null when there is no note to show. */
export function buildStatusContent(count: NoteCount | null): StatusBarContent | null {
	if (count === null) {
		return null;
	}
	const { detail, headline } = buildSummary(count);
	const inRegion = count.mode !== 'note' && count.headingFound;
	return {
		text: inRegion ? `${ headline } (region)` : headline,
		tooltip: detail
	};
}