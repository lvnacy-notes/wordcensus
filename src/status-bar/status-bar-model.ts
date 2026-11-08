/**
 * Turns a note's count into the status bar item's text and tooltip.
 * Imports nothing from Obsidian.
 */

import { buildSummary } from '../counting/summary';
import type { NoteCount, StatusBarContent } from '../types';

/**
 * Builds the item's text and tooltip. The text carries a `(region)` suffix
 * when the count covers only part of the note.
 *
 * @param count - The active note's count, or `null` when there is no note.
 * @returns The content to show, or `null` when there is no note to show.
 */
export function buildStatusContent(count: NoteCount | null): StatusBarContent | null {
	if (count === null) {
		return null;
	}
	const { detail, headline } = buildSummary(count);
	const inRegion = count.mode !== 'note' && count.headingFound;
	return { text: inRegion ? `${ headline } (region)` : headline, tooltip: detail };
}