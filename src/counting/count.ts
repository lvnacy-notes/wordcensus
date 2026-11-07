/**
 * Pure word counting. Imports nothing from Obsidian.
 *
 * `countWords` takes the text of a region (see region.ts) and returns how
 * many words it contains, after removing everything that is Markdown
 * machinery rather than prose: frontmatter, comments, link URLs, list
 * markers, footnote references, block ids, HTML tags, and so on.
 *
 * Counting follows word-processor conventions: a word is a run of
 * non-whitespace containing at least one letter or number, so "well-known"
 * and "don't" are one word each. Scripts that are not written with spaces
 * between words (Chinese, Japanese, Thai, ...) are handed to
 * `Intl.Segmenter`. Where `Intl.Segmenter` does not exist, those scripts
 * fall back to one word per character.
 */

import {
	FENCE_OPEN,
	FRONTMATTER,
	HTML_COMMENT,
	OBSIDIAN_COMMENT
} from './markdown-patterns';
import type { CountOptions, WordSegmenter } from '../types';

/******************************************************************************
 * Interfaces and Types
******************************************************************************/

type SegmentKind = 'prose' | 'code' | 'wordcount';

interface TextSegment {
	kind: SegmentKind;
	text: string;
}

export const DEFAULT_COUNT_OPTIONS: Readonly<CountOptions> = Object.freeze({
	includeCodeBlocks: false,
	includeFootnotes: true,
	includeEmbeds: false
});

/******************************************************************************
 * Declared Variables and Constants
******************************************************************************/

const LETTER_OR_NUMBER = /[\p{L}\p{N}]/u;

// Scripts written without spaces between words. Hangul is not in this list.
const NON_SPACED_SCRIPTS = [
	'\\p{Script=Han}',
	'\\p{Script=Hiragana}',
	'\\p{Script=Katakana}',
	'\\p{Script=Thai}',
	'\\p{Script=Lao}',
	'\\p{Script=Khmer}',
	'\\p{Script=Myanmar}'
].join('');
const NON_SPACED = new RegExp(`[${ NON_SPACED_SCRIPTS }]`, 'u');
const NON_SPACED_SPLIT = new RegExp(`[${ NON_SPACED_SCRIPTS }]|[^${ NON_SPACED_SCRIPTS }]+`, 'gu');

const LINK_REFERENCE_DEFINITION =/^[ \t]{0,3}\[(?!\^)[^\]\n]+\]:[ \t]*\S.*$/gm;
const FOOTNOTE_DEFINITION = /^[ \t]{0,3}\[\^[^\]\s]+\]:[ \t]*(.*)$/;
const FOOTNOTE_CONTINUATION = /^(?: {4}|\t)\S/;
const INLINE_FOOTNOTE = /\^\[([^\]\n]*)\]/g;
const FOOTNOTE_REFERENCE = /\[\^[^\]\s]+\]/g;
const EMBED_WIKILINK = /!\[\[([^\]\n]*)\]\]/g;
const EMBED_IMAGE = /!\[([^\]\n]*)\]\((?:<[^>\n]*>|[^)\n]*)\)/g;
const WIKILINK = /\[\[([^\]\n]*)\]\]/g;
const MARKDOWN_LINK = /\[([^\]\n]*)\]\((?:<[^>\n]*>|[^)\n]*)\)/g;
const REFERENCE_LINK = /\[([^\]\n]+)\]\[[^\]\n]*\]/g;
const AUTOLINK = /<(?:https?|ftp|mailto):[^>\s]*>/gi;
const BARE_URL = /\b(?:https?:\/\/|ftp:\/\/|www\.)\S+/gi;
const HTML_TAG = /<\/?[A-Za-z][^>\n]*>/g;
const BLOCKQUOTE = /^[ \t]*(?:>[ \t]*)+/gm;
const CALLOUT = /^[ \t]*\[![^\]\n]*\][+-]?[ \t]*/gm;
const LIST_MARKER = /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[^\]\n]\][ \t]+)?/gm;
const BLOCK_ID = /(?:^|[ \t])\^[A-Za-z0-9-]+[ \t]*$/gm;
const TABLE_PIPE = /\|/g;

let cachedSegmenter: WordSegmenter | null | undefined;

/******************************************************************************
 * Functions
******************************************************************************/

/** Counts the words in one whitespace-delimited chunk. */
function countChunk(chunk: string, segmenter: WordSegmenter | null): number {
	if (!LETTER_OR_NUMBER.test(chunk)) {
		return 0;
	}
	if (!NON_SPACED.test(chunk)) {
		return 1;
	}
	if (segmenter) {
		let words = 0;
		for (const segment of segmenter.segment(chunk)) {
			if (segment.isWordLike) {
				words++;
			}
		}
		return words;
	}
	// No segmenter: one word per non-spaced character, and one per run of
	// anything else that contains a letter or number.
	let words = 0;
	for (const part of chunk.match(NON_SPACED_SPLIT) ?? []) {
		if (NON_SPACED.test(part) || LETTER_OR_NUMBER.test(part)) {
			words++;
		}
	}
	return words;
}

/**
 * Counts the words in `text`.
 *
 * `segmenter` defaults to the platform's `Intl.Segmenter`. Pass `null` to
 * force the per-character fallback for non-spaced scripts (used by tests
 * and by runtimes without `Intl.Segmenter`).
 */
export function countWords(
	text: string,
	options: Partial<CountOptions> = {},
	segmenter: WordSegmenter | null = getDefaultSegmenter()
): number {
	const resolved: CountOptions = { ...DEFAULT_COUNT_OPTIONS, ...options };
	const normalized = stripFrontmatter(text.replace(/\r\n?/g, '\n'));

	const parts: string[] = [];
	for (const segment of splitFences(normalized)) {
		if (segment.kind === 'prose') {
			parts.push(stripProse(segment.text, resolved));
		} else if (segment.kind === 'code' && resolved.includeCodeBlocks) {
			parts.push(segment.text);
		}
		// `wordcount` blocks are this plugin's own output and are never
		// counted, whatever includeCodeBlocks says.
	}

	let total = 0;
	for (const chunk of parts.join('\n').split(/\s+/)) {
		if (chunk !== '') {
			total += countChunk(chunk, segmenter);
		}
	}
	return total;
}

/**
 * The platform's word segmenter, or null where `Intl.Segmenter` is missing
 * (older mobile WebViews).
 */
function getDefaultSegmenter(): WordSegmenter | null {
	if (cachedSegmenter === undefined) {
		cachedSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
			? new Intl.Segmenter(undefined, { granularity: 'word' })
			: null;
	}
	return cachedSegmenter;
}

function isFootnoteContinuation(lines: string[], index: number): boolean {
	if (FOOTNOTE_CONTINUATION.test(lines[index])) {
		return true;
	}
	if (lines[index].trim() !== '') {
		return false;
	}
	let next = index + 1;
	while (next < lines.length && lines[next].trim() === '') {
		next++;
	}
	return next < lines.length && FOOTNOTE_CONTINUATION.test(lines[next]);
}

/**
 * Removes (or keeps, minus the `[^id]:` marker) footnote definitions,
 * including their indented continuation lines.
 */
function processFootnoteDefinitions(text: string, includeFootnotes: boolean): string {
	const lines = text.split('\n');
	const kept: string[] = [];
	let i = 0;
	while (i < lines.length) {
		const match = FOOTNOTE_DEFINITION.exec(lines[i]);
		if (!match) {
			kept.push(lines[i]);
			i++;
			continue;
		}
		const block = [match[1]];
		i++;
		while (i < lines.length && isFootnoteContinuation(lines, i)) {
			block.push(lines[i]);
			i++;
		}
		if (includeFootnotes) {
			kept.push(...block);
		}
	}
	return kept.join('\n');
}

/**
 * Splits text into prose and fenced-code segments. A fence closes on a line
 * of the same character at least as long as the opening one; an unclosed
 * fence runs to the end of the text. Fence lines themselves are dropped.
 * Fences may be indented at any depth, including inside list items.
 */
function splitFences(text: string): TextSegment[] {
	const lines = text.split('\n');
	const segments: TextSegment[] = [];
	let prose: string[] = [];
	let i = 0;

	const flushProse = (): void => {
		if (prose.length > 0) {
			segments.push({ kind: 'prose', text: prose.join('\n') });
			prose = [];
		}
	};

	while (i < lines.length) {
		const line = lines[i];
		const open = FENCE_OPEN.exec(line);
		const fence = open?.[1];
		const info = open?.[2] ?? '';
		const isFence = fence !== undefined && !(fence.startsWith('`') && info.includes('`'));

		if (!isFence) {
			prose.push(line);
			i++;
			continue;
		}

		flushProse();
		const fenceChar = fence.charAt(0);
		const language = info.trim().split(/\s+/)[0].toLowerCase();
		const body: string[] = [];
		i++;
		while (i < lines.length) {
			const trimmed = lines[i].trim();
			const closes = trimmed.length >= fence.length && trimmed === fenceChar.repeat(trimmed.length);
			if (closes) {
				i++;
				break;
			}
			body.push(lines[i]);
			i++;
		}
		segments.push({
			kind: language === 'wordcount' ? 'wordcount' : 'code',
			text: body.join('\n')
		});
	}
	flushProse();
	return segments;
}

function stripFrontmatter(text: string): string {
	return text.replace(FRONTMATTER, '');
}

/** Removes Markdown machinery from a prose segment, leaving words. */
function stripProse(text: string, options: CountOptions): string {
	const { includeFootnotes, includeEmbeds } = options;

	let result = text
		.replace(HTML_COMMENT, ' ')
		.replace(OBSIDIAN_COMMENT, ' ');

	result = processFootnoteDefinitions(result, includeFootnotes)
		.replace(LINK_REFERENCE_DEFINITION, ' ')
		.replace(INLINE_FOOTNOTE, (_match, inner: string) => includeFootnotes ? ` ${ inner } ` : ' ')
		.replace(FOOTNOTE_REFERENCE, ' ');

	// Embeds are replaced before links.
	result = result
		.replace(EMBED_WIKILINK, (_match, inner: string) => includeEmbeds ? ` ${ wikilinkText(inner) } ` : ' ')
		.replace(EMBED_IMAGE, (_match, alt: string) => includeEmbeds ? ` ${ alt } ` : ' ')
		.replace(WIKILINK, (_match, inner: string) => ` ${ wikilinkText(inner) } `)
		.replace(MARKDOWN_LINK, (_match, label: string) => ` ${ label } `)
		.replace(REFERENCE_LINK, (_match, label: string) => ` ${ label } `)
		.replace(AUTOLINK, ' ')
		.replace(BARE_URL, ' ')
		.replace(HTML_TAG, ' ');

	return result
		.replace(BLOCKQUOTE, '')
		.replace(CALLOUT, '')
		.replace(LIST_MARKER, '')
		.replace(BLOCK_ID, '')
		.replace(TABLE_PIPE, ' ');
}

/**
 * The text a wikilink displays: its alias if it has one, otherwise its
 * target, with heading and block separators treated as word breaks.
 */
function wikilinkText(inner: string): string {
	const pipe = inner.indexOf('|');
	if (pipe >= 0) {
		return inner.slice(pipe + 1);
	}
	return inner.replace(/[#^]/g, ' ');
}