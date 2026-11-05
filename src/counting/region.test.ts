import {
	describe,
	expect,
	it
} from 'vitest';
import { countWords } from './count';
import { extractRegion } from './region';

const START = '<!-- word count start -->';
const END = '<!-- word count end -->';

describe('region extraction feeding the counter', () => {
	it('counts only the words between sentinels', () => {
		const note = [
			'Not counted before.',
			'',
			START,
			'',
			'Words here get counted. Nothing else gets counted.',
			'',
			END,
			'',
			'Not counted after.'
		].join('\n');

		const region = extractRegion(note);
		const result = countWords(region.text);

		expect(result).toBe(8);
	});

	it('counts the words under a heading, subheadings included, and not the heading lines around it', () => {
		const note = [
			'## some header',
			'',
			'## some other header',
			'',
			'## this header is selected for word count',
			'',
			'Words here are counted',
			'',
			'### this is still under the selected header',
			'',
			'So words here are counted as well',
			'',
			'## the word count ends above this header'
		].join('\n');

		const region = extractRegion(note, { heading: 'this header is selected for word count' });
		const result = countWords(region.text);

		expect(result).toBe(18);
	});

	it('never counts a wordcount block inside the region, even when code blocks are included', () => {
		const note = [
			START,
			'Before.',
			'```wordcount',
			'heading: Chapter 3',
			'```',
			'After.',
			END
		].join('\n');

		const region = extractRegion(note);
		const result = countWords(region.text, { includeCodeBlocks: true });

		expect(result).toBe(2);
	});

	it('keeps words from adjacent pairs apart when no whitespace separates them', () => {
		const note = `${ START }one${ END }${ START }two${ END }`;

		const region = extractRegion(note);
		const result = countWords(region.text);

		expect(result).toBe(2);
	});

	it('lets a configured heading win when the note only documents sentinels in a code block', () => {
		const note = [
			'## Draft',
			'Real words here.',
			'',
			'```markdown',
			START,
			'```'
		].join('\n');

		const region = extractRegion(note, { heading: 'Draft' });
		const result = countWords(region.text);

		expect(region.mode).toBe('heading');
		expect(result).toBe(3);
	});
});