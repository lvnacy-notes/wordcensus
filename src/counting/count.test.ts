import {
	describe,
	expect,
	it
} from 'vitest';
import { countWords } from './count';
import type { WordSegmenter } from '../types';

const LETTER = /\p{L}/u;

/** Treats every letter as its own word, so non-spaced-script tests are deterministic. */
const characterSegmenter: WordSegmenter = {
	segment(input: string): Iterable<{ isWordLike?: boolean }> {
		return Array.from(input).map((character) => ({ isWordLike: LETTER.test(character) }));
	}
};

describe('countWords', () => {
	describe('plain text', () => {
		it('counts nothing in whitespace-only text', () => {
			const text = '  \n\t \n';

			const result = countWords(text);

			expect(result).toBe(0);
		});

		it('counts words separated by any kind of whitespace', () => {
			const text = 'hello \n\n  world\tagain ';

			const result = countWords(text);

			expect(result).toBe(3);
		});

		it('does not count tokens that contain no letter or number', () => {
			const text = 'one — two ... three';

			const result = countWords(text);

			expect(result).toBe(3);
		});

		it('counts a hyphenated word or a contraction as one word', () => {
			const text = "a well-known fact don't";

			const result = countWords(text);

			expect(result).toBe(4);
		});

		it('counts numbers and accented letters as words', () => {
			const text = 'in 2026 café';

			const result = countWords(text);

			expect(result).toBe(3);
		});

		it('counts Korean by spaces rather than by character', () => {
			const text = '안녕 하세요';

			const result = countWords(text);

			expect(result).toBe(2);
		});
	});

	describe('scripts written without spaces', () => {
		it('segments them with the given segmenter and counts spaced words by whitespace', () => {
			const text = 'hello 世界';

			const result = countWords(text, {}, characterSegmenter);

			expect(result).toBe(3);
		});

		it('falls back to one word per character when there is no segmenter', () => {
			const text = '你好世界';

			const result = countWords(text, {}, null);

			expect(result).toBe(4);
		});

		it('counts a run of spaced letters as one word inside a mixed chunk without a segmenter', () => {
			const text = 'hello世界';

			const result = countWords(text, {}, null);

			expect(result).toBe(3);
		});
	});

	describe('frontmatter', () => {
		it('excludes frontmatter at the start of the text', () => {
			const text = '---\ntitle: A B C\n---\nbody words';

			const result = countWords(text);

			expect(result).toBe(2);
		});

		it('excludes empty frontmatter', () => {
			const text = '---\n---\nbody';

			const result = countWords(text);

			expect(result).toBe(1);
		});

		it('excludes frontmatter written with CRLF line endings', () => {
			const text = '---\r\ntitle: x\r\n---\r\nbody';

			const result = countWords(text);

			expect(result).toBe(1);
		});

		it('does not treat an unclosed leading rule as frontmatter', () => {
			const text = '---\nhello';

			const result = countWords(text);

			expect(result).toBe(1);
		});
	});

	describe('comments', () => {
		it('excludes a multi-line HTML comment', () => {
			const text = 'a\n<!--\nhidden\nwords\n-->\nb';

			const result = countWords(text);

			expect(result).toBe(2);
		});

		it('runs an unterminated HTML comment to the end of the text', () => {
			const text = 'a <!-- b c';

			const result = countWords(text);

			expect(result).toBe(1);
		});

		it('excludes Obsidian comments', () => {
			const text = 'a %% b c %% d';

			const result = countWords(text);

			expect(result).toBe(2);
		});
	});

	describe('code blocks', () => {
		const text = 'before\n```js\nconst x = 1;\n```\nafter';

		it('excludes fenced code by default', () => {
			const result = countWords(text);

			expect(result).toBe(2);
		});

		it('counts fenced code when includeCodeBlocks is set', () => {
			const result = countWords(text, { includeCodeBlocks: true });

			expect(result).toBe(5);
		});

		it('closes a fence only with a fence at least as long as the opening one', () => {
			const longFence = '````\n```\nx\n```\n````\nafter';

			const result = countWords(longFence);

			expect(result).toBe(1);
		});

		it('runs an unclosed fence to the end of the text', () => {
			const unclosed = 'a\n```\nb c';

			const result = countWords(unclosed);

			expect(result).toBe(1);
		});

		it('does not mistake inline triple backticks for a fence', () => {
			const inline = '```foo``` bar';

			const result = countWords(inline);

			expect(result).toBe(2);
		});

		it('never counts wordcount blocks, even when code blocks are included', () => {
			const block = 'a\n```wordcount\nheading: Chapter 3\n```\nb';

			const result = countWords(block, { includeCodeBlocks: true });

			expect(result).toBe(2);
		});
	});

	describe('footnotes', () => {
		it('counts a footnote definition without its marker by default', () => {
			const text = 'text[^1] more\n\n[^1]: A note here.';

			const result = countWords(text);

			expect(result).toBe(5);
		});

		it('excludes footnote definitions when includeFootnotes is off', () => {
			const text = 'text[^1] more\n\n[^1]: A note here.';

			const result = countWords(text, { includeFootnotes: false });

			expect(result).toBe(2);
		});

		it('drops an indented continuation line together with its definition', () => {
			const text = 'x[^a]\n\n[^a]: first\n    second line\n\nafter';

			const result = countWords(text, { includeFootnotes: false });

			expect(result).toBe(2);
		});

		it('drops a continuation paragraph that follows a blank line', () => {
			const text = 'x[^a]\n\n[^a]: first\n\n    second para\n\nafter';

			const result = countWords(text, { includeFootnotes: false });

			expect(result).toBe(2);
		});

		it('counts the text of an inline footnote by default', () => {
			const text = 'word^[inline note] end';

			const result = countWords(text);

			expect(result).toBe(4);
		});

		it('excludes the text of an inline footnote when includeFootnotes is off', () => {
			const text = 'word^[inline note] end';

			const result = countWords(text, { includeFootnotes: false });

			expect(result).toBe(2);
		});

		it('never counts a footnote reference', () => {
			const text = 'claim[^12] stands';

			const result = countWords(text);

			expect(result).toBe(2);
		});
	});

	describe('embeds', () => {
		it('excludes a wikilink embed by default', () => {
			const text = 'see ![[image.png]] here';

			const result = countWords(text);

			expect(result).toBe(2);
		});

		it('counts the target of a wikilink embed when includeEmbeds is set', () => {
			const text = 'see ![[image.png]] here';

			const result = countWords(text, { includeEmbeds: true });

			expect(result).toBe(3);
		});

		it('excludes the alt text of a Markdown image by default', () => {
			const text = '![alt text](pic.png) end';

			const result = countWords(text);

			expect(result).toBe(1);
		});

		it('counts the alt text of a Markdown image when includeEmbeds is set', () => {
			const text = '![alt text](pic.png) end';

			const result = countWords(text, { includeEmbeds: true });

			expect(result).toBe(3);
		});
	});

	describe('links', () => {
		it('counts the text of a Markdown link and drops its URL', () => {
			const text = '[display text](https://example.com/a/b) after';

			const result = countWords(text);

			expect(result).toBe(3);
		});

		it('handles an angle-bracket destination containing a space', () => {
			const text = '[label](<my file.md>) after';

			const result = countWords(text);

			expect(result).toBe(2);
		});

		it('drops autolinks', () => {
			const text = '<https://example.com> x';

			const result = countWords(text);

			expect(result).toBe(1);
		});

		it('drops bare URLs', () => {
			const text = 'visit https://example.com/path now';

			const result = countWords(text);

			expect(result).toBe(2);
		});

		it('counts the alias of an aliased wikilink instead of its target', () => {
			const text = '[[Note|shown text]] end';

			const result = countWords(text);

			expect(result).toBe(3);
		});

		it('splits a heading link into the target and the heading', () => {
			const text = '[[Note#Heading]]';

			const result = countWords(text);

			expect(result).toBe(2);
		});

		it('counts the text of a reference-style link and drops its definition', () => {
			const text = '[text here][ref]\n\n[ref]: https://x.com';

			const result = countWords(text);

			expect(result).toBe(2);
		});
	});

	describe('Markdown syntax', () => {
		it('ignores bullet and numbered list markers', () => {
			const text = '- one\n1. two\n2) three';

			const result = countWords(text);

			expect(result).toBe(3);
		});

		it('ignores task checkboxes', () => {
			const text = '- [ ] todo item\n- [x] done item';

			const result = countWords(text);

			expect(result).toBe(4);
		});

		it('ignores callout markers but counts the title and body', () => {
			const text = '> [!note] Title here\n> body';

			const result = countWords(text);

			expect(result).toBe(3);
		});

		it('ignores block ids', () => {
			const text = 'A sentence here ^abc123';

			const result = countWords(text);

			expect(result).toBe(3);
		});

		it('ignores HTML tags but counts their text', () => {
			const text = '<br> text <b>bold</b>';

			const result = countWords(text);

			expect(result).toBe(2);
		});

		it('counts table cells that have no space around the pipes', () => {
			const text = '|a|b|';

			const result = countWords(text);

			expect(result).toBe(2);
		});
	});

	describe('a realistic note', () => {
		it('counts only the prose', () => {
			const text = [
				'---',
				'title: Notes',
				'tags: [a, b]',
				'---',
				'# Heading',
				'',
				'Intro with a [link](https://example.com) and a [[Other note|wiki alias]].',
				'',
				'- first item',
				'- [x] done item',
				'',
				'<!-- hidden -->',
				'',
				'```js',
				'const hidden = true;',
				'```',
				'',
				'Closing words.[^1]',
				'',
				'[^1]: Footnote text.'
			].join('\n');

			const result = countWords(text);

			expect(result).toBe(17);
		});
	});
});