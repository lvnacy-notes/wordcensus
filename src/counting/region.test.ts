import {
	describe,
	expect,
	it
} from 'vitest';
import {
	extractHeadingRegion,
	extractRegion,
	extractSentinelRegions
} from './region';

const START = '<!-- word count start -->';
const END = '<!-- word count end -->';

describe('extractSentinelRegions', () => {
	it('returns the text between a start and an end, and nothing outside them', () => {
		const text = `before\n${ START }\ninside\n${ END }\nafter`;

		const result = extractSentinelRegions(text);

		expect(result).toEqual(['\ninside\n']);
	});

	it('returns one region per pair, in order', () => {
		const text = `a ${ START } b ${ END } c ${ START } d ${ END } e`;

		const result = extractSentinelRegions(text);

		expect(result).toEqual(['\n b ', '\n d ']);
	});

	it('runs a start with no end to the end of the text', () => {
		const text = `x\n${ START }\ny z`;

		const result = extractSentinelRegions(text);

		expect(result).toEqual(['\ny z']);
	});

	it('ignores an end with no start', () => {
		const text = `a ${ END } b`;

		const result = extractSentinelRegions(text);

		expect(result).toEqual([]);
	});

	it('ignores a start inside an already-open region', () => {
		const text = `a ${ START } b ${ START } c ${ END } d`;

		const result = extractSentinelRegions(text);

		expect(result).toEqual([`\n b ${ START } c `]);
	});

	it('matches markers regardless of case and spacing', () => {
		const text = '<!--word count start-->a<!--WORD  COUNT END-->';

		const result = extractSentinelRegions(text);

		expect(result).toEqual(['\na']);
	});

	it('returns an empty region for a start immediately followed by an end', () => {
		const text = `${ START }${ END }`;

		const result = extractSentinelRegions(text);

		expect(result).toEqual(['\n']);
	});

	describe('markers that only look like markers', () => {
		it('ignores markers inside a fenced code block, and finds a real one after it', () => {
			const text = `\`\`\`\n${ START }\n\`\`\`\n${ START }\nreal\n${ END }`;

			const result = extractSentinelRegions(text);

			expect(result).toEqual(['\nreal\n']);
		});

		it('ignores markers inside inline code', () => {
			const text = `use \`${ START }\` as a marker`;

			const result = extractSentinelRegions(text);

			expect(result).toEqual([]);
		});

		it('ignores markers inside frontmatter', () => {
			const text = `---\nnote: ${ START }\n---\nbody`;

			const result = extractSentinelRegions(text);

			expect(result).toEqual([]);
		});
	});
});

describe('extractHeadingRegion', () => {
	it('returns the text under the heading up to the next heading of the same level', () => {
		const text = '## A\nx\n## B\ny';

		const result = extractHeadingRegion(text, 'A');

		expect(result?.text).toBe('\nx\n');
	});

	it('ends at a heading of a higher level', () => {
		const text = '## A\nx\n# B\ny';

		const result = extractHeadingRegion(text, 'A');

		expect(result?.text).toBe('\nx\n');
	});

	it('includes deeper headings and their text', () => {
		const text = '## A\nx\n### B\ny\n## C';

		const result = extractHeadingRegion(text, 'A');

		expect(result?.text).toBe('\nx\n### B\ny\n');
	});

	it('runs the last section to the end of the text', () => {
		const text = '## A\nbody';

		const result = extractHeadingRegion(text, 'A');

		expect(result?.text).toBe('\nbody');
	});

	it('matches case-insensitively with whitespace collapsed, and returns the heading as written', () => {
		const text = '## Chapter 3\nbody';

		const result = extractHeadingRegion(text, 'CHAPTER   3');

		expect(result).toEqual({ heading: 'Chapter 3', text: '\nbody' });
	});

	it('uses the first of two identical headings', () => {
		const text = '## Dup\nfirst\n## Dup\nsecond';

		const result = extractHeadingRegion(text, 'dup');

		expect(result?.text).toBe('\nfirst\n');
	});

	it('returns null when the heading does not exist', () => {
		const text = '## A\nbody';

		const result = extractHeadingRegion(text, 'Nope');

		expect(result).toBe(null);
	});

	it('returns null for a blank heading', () => {
		const text = '## A\nbody';

		const result = extractHeadingRegion(text, '   ');

		expect(result).toBe(null);
	});

	it('ignores a closing hash sequence', () => {
		const text = '## Title ##\nbody';

		const result = extractHeadingRegion(text, 'Title');

		expect(result?.text).toBe('\nbody');
	});

	it('keeps a trailing hash that is part of the title', () => {
		const text = '## C#\nbody';

		const result = extractHeadingRegion(text, 'c#');

		expect(result?.heading).toBe('C#');
	});

	it('keeps inline code in the heading text', () => {
		const text = '## Using `foo`\nbody';

		const result = extractHeadingRegion(text, 'using `foo`');

		expect(result?.heading).toBe('Using `foo`');
	});

	it('ends the region at an empty heading of the same level', () => {
		const text = '## A\nx\n##\ny';

		const result = extractHeadingRegion(text, 'A');

		expect(result?.text).toBe('\nx\n');
	});

	it('does not treat a line indented four spaces as a heading', () => {
		const text = '    ## A\nbody';

		const result = extractHeadingRegion(text, 'A');

		expect(result).toBe(null);
	});

	it('does not treat a tag as a heading', () => {
		const text = '## A\n#tag text\n## B';

		const result = extractHeadingRegion(text, 'A');

		expect(result?.text).toBe('\n#tag text\n');
	});

	describe('headings that only look like headings', () => {
		it('ignores a heading inside fenced code', () => {
			const text = '## A\n```\n# not heading\n```\nmore\n## B';

			const found = extractHeadingRegion(text, 'not heading');
			const section = extractHeadingRegion(text, 'A');

			expect(found).toBe(null);
			expect(section?.text).toBe('\n```\n# not heading\n```\nmore\n');
		});

		it('ignores a heading inside an HTML comment', () => {
			const text = '<!--\n## Hidden\n-->\n## Real\nx';

			const hidden = extractHeadingRegion(text, 'Hidden');
			const real = extractHeadingRegion(text, 'Real');

			expect(hidden).toBe(null);
			expect(real?.text).toBe('\nx');
		});

		it('ignores a heading inside an Obsidian comment', () => {
			const text = '%%\n## Hidden\n%%\n## Real\nx';

			const hidden = extractHeadingRegion(text, 'Hidden');
			const real = extractHeadingRegion(text, 'Real');

			expect(hidden).toBe(null);
			expect(real?.text).toBe('\nx');
		});

		it('ignores a heading-like line inside frontmatter', () => {
			const text = '---\n# comment\n---\n# Real\nx';

			const comment = extractHeadingRegion(text, 'comment');
			const real = extractHeadingRegion(text, 'Real');

			expect(comment).toBe(null);
			expect(real?.text).toBe('\nx');
		});
	});
});

describe('extractRegion', () => {
	it('returns the whole note, with newlines normalized, when no heading is configured', () => {
		const text = 'a\r\nb';

		const result = extractRegion(text);

		expect(result).toEqual({ mode: 'note', text: 'a\nb' });
	});

	it('treats a blank configured heading as not configured', () => {
		const text = '## A\nbody';

		const result = extractRegion(text, { heading: '   ' });

		expect(result).toEqual({ mode: 'note', text: '## A\nbody' });
	});

	it('joins several sentinel pairs and reports how many there were', () => {
		const text = `a ${ START } b ${ END } c ${ START } d ${ END } e`;

		const result = extractRegion(text);

		expect(result).toEqual({ mode: 'sentinel', text: '\n b \n d ', pairs: 2 });
	});

	it('prefers sentinels over a configured heading', () => {
		const text = `## A\nin A\n${ START }\ns\n${ END }`;

		const result = extractRegion(text, { heading: 'A' });

		expect(result).toEqual({ mode: 'sentinel', text: '\ns\n', pairs: 1 });
	});

	it('returns the section under a configured heading', () => {
		const text = '## A\nbody';

		const result = extractRegion(text, { heading: 'a' });

		expect(result).toEqual({ mode: 'heading', text: '\nbody', heading: 'A', found: true });
	});

	it('reports a missing heading instead of falling back to the whole note', () => {
		const text = '## A\nbody';

		const result = extractRegion(text, { heading: '  Nope ' });

		expect(result).toEqual({ mode: 'heading', text: '', heading: 'Nope', found: false });
	});

	it('falls through to the heading when the only marker is an unmatched end', () => {
		const text = `x ${ END }\n## A\nb`;

		const result = extractRegion(text, { heading: 'A' });

		expect(result).toEqual({ mode: 'heading', text: '\nb', heading: 'A', found: true });
	});
});