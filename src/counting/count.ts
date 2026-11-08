/**
 * Pure word counting; imports nothing from Obsidian.
 *
 * `countWords` returns the number of words in a region's text after removing
 * Markdown machinery: frontmatter, comments, link URLs, list markers,
 * footnote references, block ids, HTML tags, and so on.
 *
 * A word is a run of non-whitespace containing at least one letter or number,
 * so "well-known" and "don't" count once each. Scripts written without spaces
 * between words (Chinese, Japanese, Thai, ...) are segmented with
 * `Intl.Segmenter`, or counted as one word per character where it is
 * unavailable.
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

/** The kind of a text segment: prose, fenced code, or a `wordcount` block. */
type SegmentKind = 'prose' | 'code' | 'wordcount';

/** A run of text of one kind. */
interface TextSegment {
	kind: SegmentKind;
	text: string;
}

/******************************************************************************
 * Declared Variables and Constants
******************************************************************************/

/** The counting options used for any option not passed to `countWords`. */
export const DEFAULT_COUNT_OPTIONS: Readonly<CountOptions> = Object.freeze({
	includeCodeBlocks: false,
	includeFootnotes: true,
	includeEmbeds: false
});

/** A single letter or number. */
const LETTER_OR_NUMBER = /[\p{L}\p{N}]/u;

/** Character-class body for scripts written without spaces between words; excludes Hangul. */
const NON_SPACED_SCRIPTS = [
	'\\p{Script=Han}',
	'\\p{Script=Hiragana}',
	'\\p{Script=Katakana}',
	'\\p{Script=Thai}',
	'\\p{Script=Lao}',
	'\\p{Script=Khmer}',
	'\\p{Script=Myanmar}'
].join('');

/** A single character from a non-spaced script. */
const NON_SPACED = new RegExp(`[${ NON_SPACED_SCRIPTS }]`, 'u');

/** Splits a chunk into single non-spaced characters and runs of everything else. */
const NON_SPACED_SPLIT = new RegExp(`[${ NON_SPACED_SCRIPTS }]|[^${ NON_SPACED_SCRIPTS }]+`, 'gu');

/** A link reference definition line (`[id]: url`), excluding footnote definitions. */
const LINK_REFERENCE_DEFINITION = /^[ \t]{0,3}\[(?!\^)[^\]\n]+\]:[ \t]*\S.*$/gm;

/** The first line of a footnote definition. Group 1 is its text. */
const FOOTNOTE_DEFINITION = /^[ \t]{0,3}\[\^[^\]\s]+\]:[ \t]*(.*)$/;

/** A line indented by four spaces or a tab, continuing a footnote definition. */
const FOOTNOTE_CONTINUATION = /^(?: {4}|\t)\S/;

/** An inline footnote (`^[text]`). Group 1 is its text. */
const INLINE_FOOTNOTE = /\^\[([^\]\n]*)\]/g;

/** A footnote reference (`[^id]`). */
const FOOTNOTE_REFERENCE = /\[\^[^\]\s]+\]/g;

/** A wikilink embed (`![[target]]`). Group 1 is the inner text. */
const EMBED_WIKILINK = /!\[\[([^\]\n]*)\]\]/g;

/** An image embed (`![alt](url)`). Group 1 is the alt text. */
const EMBED_IMAGE = /!\[([^\]\n]*)\]\((?:<[^>\n]*>|[^)\n]*)\)/g;

/** A wikilink (`[[target|alias]]`). Group 1 is the inner text. */
const WIKILINK = /\[\[([^\]\n]*)\]\]/g;

/** An inline Markdown link (`[label](url)`). Group 1 is the label. */
const MARKDOWN_LINK = /\[([^\]\n]*)\]\((?:<[^>\n]*>|[^)\n]*)\)/g;

/** A reference-style link (`[label][ref]`). Group 1 is the label. */
const REFERENCE_LINK = /\[([^\]\n]+)\]\[[^\]\n]*\]/g;

/** An autolink (`<https://...>`). */
const AUTOLINK = /<(?:https?|ftp|mailto):[^>\s]*>/gi;

/** A bare `http`, `ftp`, or `www` URL. */
const BARE_URL = /\b(?:https?:\/\/|ftp:\/\/|www\.)\S+/gi;

/** An HTML opening or closing tag. */
const HTML_TAG = /<\/?[A-Za-z][^>\n]*>/g;

/** Leading blockquote markers on a line. */
const BLOCKQUOTE = /^[ \t]*(?:>[ \t]*)+/gm;

/** A leading callout marker (`[!type]`) with an optional fold token. */
const CALLOUT = /^[ \t]*\[![^\]\n]*\][+-]?[ \t]*/gm;

/** A leading bullet or number, with an optional task checkbox. */
const LIST_MARKER = /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+(?:\[[^\]\n]\][ \t]+)?/gm;

/** A trailing block id (`^id`). */
const BLOCK_ID = /(?:^|[ \t])\^[A-Za-z0-9-]+[ \t]*$/gm;

/** A table column pipe. */
const TABLE_PIPE = /\|/g;

/** The memoized platform segmenter; `null` when unavailable, `undefined` until first looked up. */
let cachedSegmenter: WordSegmenter | null | undefined;

/******************************************************************************
 * Functions
******************************************************************************/

/**
 * Counts the words in one whitespace-delimited chunk.
 *
 * @param chunk - The chunk of non-whitespace text.
 * @param segmenter - The segmenter for non-spaced scripts, or `null` for the per-character fallback.
 * @returns The number of words in the chunk.
 */
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
	// Fallback: one word per non-spaced character, and one per run of
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
 * @param text - The region text to count.
 * @param options - Counting options; unspecified options use `DEFAULT_COUNT_OPTIONS`.
 * @param segmenter - The word segmenter. Defaults to the platform's `Intl.Segmenter`; `null` forces the per-character fallback for non-spaced scripts.
 * @returns The number of words.
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
		// `wordcount` blocks are never counted.
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
 * Gets the platform's word segmenter, memoized.
 *
 * @returns The segmenter, or `null` where `Intl.Segmenter` is unavailable.
 */
function getDefaultSegmenter(): WordSegmenter | null {
	if (cachedSegmenter === undefined) {
		cachedSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
			? new Intl.Segmenter(undefined, { granularity: 'word' })
			: null;
	}
	return cachedSegmenter;
}

/**
 * Tells whether a line continues a footnote definition: it is indented, or it
 * is blank and the next non-blank line is indented.
 *
 * @param lines - The lines of the text.
 * @param index - The index of the line to test.
 * @returns `true` if the line continues the footnote.
 */
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
 * Removes footnote definitions and their indented continuation lines. When
 * `includeFootnotes` is set, their text is kept without the `[^id]:` marker.
 *
 * @param text - The prose text.
 * @param includeFootnotes - Whether to keep footnote text.
 * @returns The text with footnote definitions processed.
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
 * Splits text into prose and fenced-code segments. A fence closes on a line of
 * the same character at least as long as the opening one; an unclosed fence
 * runs to the end of the text. Fence lines are dropped, and fences may be
 * indented at any depth. A fence whose language is `wordcount` yields a
 * `wordcount` segment.
 *
 * @param text - The text, with LF line endings.
 * @returns The segments in order.
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

/**
 * Removes leading frontmatter.
 *
 * @param text - The text, with LF line endings.
 * @returns The text without frontmatter.
 */
function stripFrontmatter(text: string): string {
	return text.replace(FRONTMATTER, '');
}

/**
 * Removes Markdown machinery from a prose segment, leaving words.
 *
 * @param text - The prose text.
 * @param options - The resolved counting options.
 * @returns The text with Markdown syntax removed or unwrapped.
 */
function stripProse(text: string, options: CountOptions): string {
	const { includeFootnotes, includeEmbeds } = options;

	let result = text
		.replace(HTML_COMMENT, ' ')
		.replace(OBSIDIAN_COMMENT, ' ');

	result = processFootnoteDefinitions(result, includeFootnotes)
		.replace(LINK_REFERENCE_DEFINITION, ' ')
		.replace(INLINE_FOOTNOTE, (_match, inner: string) => includeFootnotes ? ` ${ inner } ` : ' ')
		.replace(FOOTNOTE_REFERENCE, ' ');

	// Embeds are stripped before links are unwrapped.
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
 * Gets the text a wikilink displays: its alias if it has one, otherwise its
 * target, with heading and block separators treated as word breaks.
 *
 * @param inner - The text between the wikilink brackets.
 * @returns The displayed text.
 */
function wikilinkText(inner: string): string {
	const pipe = inner.indexOf('|');
	if (pipe >= 0) {
		return inner.slice(pipe + 1);
	}
	return inner.replace(/[#^]/g, ' ');
}