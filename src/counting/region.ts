/**
 * Pure region extraction; imports nothing from Obsidian.
 *
 * A region is the part of a note that is counted. It is defined by sentinel
 * comments (`<!-- word count start -->` / `<!-- word count end -->`) or by a
 * heading. `extractRegion` applies the precedence: sentinels, then a
 * configured heading, then the whole note.
 *
 * Scanning for sentinels and headings ignores frontmatter, fenced code,
 * inline code, and (for headings) comments.
 *
 * The text returned for a sentinel or heading region always begins with a
 * newline.
 */

import {
	FENCE_OPEN,
	FRONTMATTER,
	HTML_COMMENT,
	OBSIDIAN_COMMENT
} from './markdown-patterns';
import {
	HeadingRegion,
	RegionConfig,
	RegionResult
} from '../types';

/******************************************************************************
 * Interfaces and Types
******************************************************************************/

/** An ATX heading line located in a note. */
interface HeadingLine {
	/** Heading level, 1 to 6. */
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

/** An inline code span: a run of backticks closed by an equal run. */
const INLINE_CODE = /(`+)[^`\n]+\1/g;

/** A word count sentinel comment. Group 1 is `start` or `end`. */
const SENTINEL = /<!--\s*word\s+count\s+(start|end)\s*-->/gi;

/**
 * An ATX heading line with up to three spaces of indent. Group 1 is the
 * hashes; group 2 is the heading text.
 */
const ATX_HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/;

/******************************************************************************
 * Functions
******************************************************************************/

/**
 * Ensures region text begins with a newline.
 *
 * @param slice - The region text.
 * @returns `slice`, prefixed with a newline unless it already starts with one.
 */
function asRegionText(slice: string): string {
	return slice.startsWith('\n') ? slice : `\n${ slice }`;
}

/**
 * Replaces every character except newlines with a space, keeping offsets.
 *
 * @param text - The text to blank.
 * @returns Text of the same length with only newlines and spaces.
 */
function blank(text: string): string {
	return text.replace(/[^\n]/g, ' ');
}

/**
 * Strips an ATX closing sequence (`## Title ##` becomes `Title`).
 *
 * @param raw - The heading text as written.
 * @returns The trimmed heading text without a closing sequence.
 */
function cleanHeadingText(raw: string): string {
	const trimmed = raw.trim();
	if (/^#+$/.test(trimmed)) {
		return '';
	}
	return trimmed.replace(/[ \t]+#+$/, '');
}

/**
 * Extracts the text under a heading, up to the next heading of the same or a
 * higher level (`##` ends at the next `##` or `#`). Subheadings and their
 * titles are part of the region; the heading line itself is not.
 *
 * Matching is case-insensitive with whitespace collapsed, and the first match
 * wins.
 *
 * @param text - The note text.
 * @param heading - The heading to find.
 * @returns The heading's region, or `null` when there is no such heading.
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
 * Picks the region to count: sentinels, else the configured heading, else the
 * whole note. A configured heading that is not found yields an empty
 * heading-mode result with `found: false`; it does not fall back to the whole
 * note.
 *
 * @param text - The note text.
 * @param config - The region configuration, including the configured heading.
 * @returns The region's mode and text, with mode-specific details.
 */
export function extractRegion(text: string, config: RegionConfig = {}): RegionResult {
	const source = normalizeNewlines(text);

	const sentinelRegions = extractSentinelRegions(source);
	if (sentinelRegions.length > 0) {
		return {
			mode: 'sentinel',
			text: sentinelRegions.join(''),
			pairs: sentinelRegions.length
		};
	}

	const configured = config.heading?.trim() ?? '';
	if (configured !== '') {
		const region = extractHeadingRegion(source, configured);
		return region
			? {
				mode: 'heading',
				text: region.text,
				heading: region.heading,
				found: true
			}
			: {
				mode: 'heading',
				text: '',
				heading: configured,
				found: false
			};
	}

	return { mode: 'note', text: source };
}

/**
 * Extracts the text of every sentinel region in the note, in order.
 *
 * - A start with no end runs to the end of the text.
 * - An end with no start is ignored.
 * - A start inside an open region is ignored and stays in the region text.
 *
 * Markers are matched case-insensitively and tolerate extra whitespace.
 *
 * @param text - The note text.
 * @returns The region texts, empty when the note has no sentinels.
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
 * Finds all ATX headings outside frontmatter, code, and comments, in order.
 * Setext headings (underlined with `===` or `---`) are not recognised.
 *
 * @param text - The note text, with LF line endings.
 * @returns The headings with their levels, text, and line offsets.
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
		// Heading text comes from the original line, so inline code and
		// comments are kept.
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
 * Blanks out frontmatter, fenced code, and inline code. The result is the same
 * length as the input, so offsets found in it index the original.
 *
 * @param text - The note text, with LF line endings.
 * @returns The masked text.
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
 * Normalizes a heading for comparison: trimmed, whitespace collapsed,
 * case-folded.
 *
 * @param heading - The heading text.
 * @returns The normalized heading.
 */
function normalizeHeading(heading: string): string {
	return heading.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Converts CRLF and CR line endings to LF.
 *
 * @param text - The text to normalize.
 * @returns The text with LF line endings.
 */
function normalizeNewlines(text: string): string {
	return text.replace(/\r\n?/g, '\n');
}