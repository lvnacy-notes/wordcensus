import {
	describe,
	expect,
	it
} from 'vitest';
import {
	countBlock,
	parseBlockSource
} from './block-model';
import { buildSettings } from '../test/fakes';
import type { NoteText } from '../types';

const TEXT = [
	'Intro words here.',
	'',
	'# Chapter 3',
	'one two three',
	'',
	'# Chapter 4',
	'four five'
].join('\n');

function buildNote(overrides: Partial<NoteText> = {}): NoteText {
	return {
		headingOverride: null,
		path: 'novel.md',
		text: TEXT,
		title: 'novel',
		...overrides
	};
}

describe('parseBlockSource', () => {
	it('has no heading for an empty body', () => {
		expect(parseBlockSource('')).toEqual({ heading: null });
	});

	it('reads the heading, ignoring the case of the key and surrounding space', () => {
		expect(parseBlockSource('  Heading :   Chapter 3  ')).toEqual({ heading: 'Chapter 3' });
	});

	it('removes quotes wrapped around the value', () => {
		expect(parseBlockSource('heading: "Chapter 3"')).toEqual({ heading: 'Chapter 3' });
		expect(parseBlockSource('heading: \'Chapter 3\'')).toEqual({ heading: 'Chapter 3' });
	});

	it('has no heading when the value is blank', () => {
		expect(parseBlockSource('heading:   ')).toEqual({ heading: null });
	});

	it('ignores other lines and takes the first heading with a value', () => {
		const source = 'colour: red\nheading:\nheading: One\nheading: Two';

		expect(parseBlockSource(source)).toEqual({ heading: 'One' });
	});

	it('reads a body with Windows line endings', () => {
		expect(parseBlockSource('colour: red\r\nheading: One')).toEqual({ heading: 'One' });
	});
});

describe('countBlock', () => {
	it('counts the note\'s own region when the block has no heading', () => {
		const result = countBlock(buildNote(), { heading: null }, buildSettings());

		expect(result.mode).toBe('note');
		expect(result.words).toBe(12);
	});

	it('honours the note\'s own heading property when the block has no heading', () => {
		const note = buildNote({ headingOverride: 'Chapter 4' });

		const result = countBlock(note, { heading: null }, buildSettings());

		expect(result.heading).toBe('Chapter 4');
		expect(result.words).toBe(2);
	});

	it('counts under the block\'s heading, even when the note has markers', () => {
		const text = `<!-- word count start -->a b<!-- word count end -->\n${ TEXT }`;

		const result = countBlock(buildNote({ text }), { heading: 'chapter 3' }, buildSettings());

		expect(result).toEqual({
			heading: 'Chapter 3',
			headingFound: true,
			mode: 'heading',
			pairs: 0,
			words: 3
		});
	});

	it('reports a heading that is not in the note instead of counting zero quietly', () => {
		const result = countBlock(buildNote(), { heading: 'Nowhere' }, buildSettings());

		expect(result.headingFound).toBe(false);
		expect(result.words).toBe(0);
	});
});