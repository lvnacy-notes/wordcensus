/**
 * Pure region extraction. Imports nothing from Obsidian.
 *
 * A region is the part of a note that gets counted. It is defined either by
 * sentinel comments (`<!-- word count start -->` / `<!-- word count end -->`)
 * or by a heading. `extractRegion` applies the precedence rules: sentinels
 * win, then a configured heading, then the whole note.
 *
 * Scanning for sentinels and headings ignores anything that only looks like
 * one: frontmatter, fenced code, inline code and (for headings) comments.
 *
 * The text this module returns is for `countWords`. For sentinel and
 * heading regions it always begins with a newline, so the counter never
 * reads a first line of `---` as frontmatter.
 */

import {
	HeadingRegion,
	RegionConfig,
	RegionResult
} from '../types';

/******************************************************************************
 * Interfaces and Types
******************************************************************************/

interface HeadingLine {
	level: number;
	/** Heading text as written, closing sequence removed. */
	text: string;
	/** Offset of the first character of the heading line. */
	lineStart: number;
	/** Offset of the newline ending the heading line (or the text length). */
	lineEnd: number;
}

/******************************************************************************
 * Declared Variables and Constants
******************************************************************************/

// Frontmatter, fences, inline code and comments.
const FRONTMATTER = /^---[ \t]*\n(?:[\s\S]*?\n)?(?:---|\.\.\.)[ \t]*(?:\n|$)/;
const FENCE_OPEN = /^[ \t]*(`{3,}|~{3,})(.*)$/;
const INLINE_CODE = /(`+)[^`\n]+\1/g;
const HTML_COMMENT = /<!--[\s\S]*?(?:-->|$)/g;
const OBSIDIAN_COMMENT = /%%[\s\S]*?(?:%%|$)/g;

const SENTINEL = /<!--\s*word\s+count\s+(start|end)\s*-->/gi;
// Up to three spaces of indent; four or more is an indented code block.
const ATX_HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/;

/******************************************************************************
 * Functions
******************************************************************************/

/**
 * Guarantees the leading newline described at the top of this file.
 */
function asRegionText(slice: string): string {
	return slice.startsWith('\n') ? slice : `\n${ slice }`;
}

/** Replaces every character except newlines with a space, keeping offsets. */
function blank(text: string): string {
	return text.replace(/[^\n]/g, ' ');
}

/** Strips an ATX closing sequence (`## Title ##` -> `Title`). */
function cleanHeadingText(raw: string): string {
	const trimmed = raw.trim();
	if (/^#+$/.test(trimmed)) {
		return '';
	}
	return trimmed.replace(/[ \t]+#+$/, '');
}

/**
 * The text under a heading, up to the next heading of the same or a higher
 * level (so `##` ends at the next `##` or `#`). Subheadings, and their
 * titles, are part of the region; the heading line itself is not.
 *
 * Matching is case-insensitive with whitespace collapsed, and the first
 * match wins. Returns null when there is no such heading.
 */
export function extractHeadingRegion(text: string, heading: string): HeadingRegion | null {
	const wanted = normalizeHeading(heading);
	if (wanted === '') {
		return null;
	}

	const source = normalizeNewlines(text);
	const headings = findHeadings(source);
	const index = headings.findIndex((candidate) => normalizeHeading(candidate.text) === wanted);
	if (index < 0) {
		return null;
	}

	const selected = headings[index];
	const boundary = headings
		.slice(index + 1)
		.find((candidate) => candidate.level <= selected.level);
	const end = boundary ? boundary.lineStart : source.length;

	return {
		heading: selected.text,
		text: asRegionText(source.slice(selected.lineEnd, end))
	};
}

/**
 * Picks the region to count. Sentinels win; otherwise a configured heading;
 * otherwise the whole note.
 *
 * A configured heading that cannot be found yields an empty heading-mode
 * result with `found: false`; it does not fall back to the whole note.
 */
export function extractRegion(text: string, config: RegionConfig = {}): RegionResult {
	const source = normalizeNewlines(text);

	const sentinelRegions = extractSentinelRegions(source);
	if (sentinelRegions.length > 0) {
		return { mode: 'sentinel', text: sentinelRegions.join(''), pairs: sentinelRegions.length };
	}

	const configured = config.heading?.trim() ?? '';
	if (configured !== '') {
		const region = extractHeadingRegion(source, configured);
		return region
			? { mode: 'heading', text: region.text, heading: region.heading, found: true }
			: { mode: 'heading', text: '', heading: configured, found: false };
	}

	return { mode: 'note', text: source };
}

/**
 * The text of every sentinel region in the note, in order.
 *
 * - A start with no end runs to the end of the text.
 * - An end with no start is ignored.
 * - A start inside an open region is ignored (it stays in the region text;
 *   the counter drops it as an ordinary comment).
 *
 * Markers are matched case-insensitively and tolerate extra whitespace.
 */
export function extractSentinelRegions(text: string): string[] {
	const source = normalizeNewlines(text);
	const masked = maskCode(source);
	const regions: string[] = [];
	let openAt = -1;

	for (const match of masked.matchAll(SENTINEL)) {
		const index = match.index ?? 0;
		if (match[1].toLowerCase() === 'start') {
			if (openAt < 0) {
				openAt = index + match[0].length;
			}
		} else if (openAt >= 0) {
			regions.push(asRegionText(source.slice(openAt, index)));
			openAt = -1;
		}
	}
	if (openAt >= 0) {
		regions.push(asRegionText(source.slice(openAt)));
	}
	return regions;
}

/**
 * All ATX headings outside frontmatter, code and comments, in order.
 * Setext headings (underlined with `===` or `---`) are not recognised.
 */
function findHeadings(text: string): HeadingLine[] {
	const masked = maskCode(text)
		.replace(HTML_COMMENT, (comment) => blank(comment))
		.replace(OBSIDIAN_COMMENT, (comment) => blank(comment));

	const headings: HeadingLine[] = [];
	let offset = 0;
	for (const maskedLine of masked.split('\n')) {
		const lineStart = offset;
		const lineEnd = offset + maskedLine.length;
		offset = lineEnd + 1;

		if (!ATX_HEADING.test(maskedLine)) {
			continue;
		}
		// The heading text is taken from the original line, which keeps inline
		// code and comments.
		const original = ATX_HEADING.exec(text.slice(lineStart, lineEnd));
		if (!original) {
			continue;
		}
		headings.push({
			level: original[1].length,
			text: cleanHeadingText(original[2] ?? ''),
			lineStart,
			lineEnd
		});
	}
	return headings;
}

/**
 * Returns `text` with frontmatter, fenced code and inline code blanked out.
 * The result is exactly as long as the input, so offsets found in it can be
 * used to slice the original.
 */
function maskCode(text: string): string {
	const frontmatter = FRONTMATTER.exec(text);
	const head = frontmatter ? blank(frontmatter[0]) : '';
	const rest = frontmatter ? text.slice(frontmatter[0].length) : text;

	const masked: string[] = [];
	let fenceChar = '';
	let fenceLength = 0;

	for (const line of rest.split('\n')) {
		if (fenceLength > 0) {
			const trimmed = line.trim();
			if (trimmed.length >= fenceLength && trimmed === fenceChar.repeat(trimmed.length)) {
				fenceLength = 0;
			}
			masked.push(blank(line));
			continue;
		}

		const open = FENCE_OPEN.exec(line);
		const fence = open?.[1];
		const info = open?.[2] ?? '';
		if (fence !== undefined && !(fence.startsWith('`') && info.includes('`'))) {
			fenceChar = fence.charAt(0);
			fenceLength = fence.length;
			masked.push(blank(line));
			continue;
		}

		masked.push(line.replace(INLINE_CODE, (span) => blank(span)));
	}
	return head + masked.join('\n');
}

/**
 * The text of a heading as it is compared: trimmed, whitespace collapsed,
 * case-folded.
 */
function normalizeHeading(heading: string): string {
	return heading.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeNewlines(text: string): string {
	return text.replace(/\r\n?/g, '\n');
}