import {
	describe,
	expect,
	it
} from 'vitest';
import { countHeading, countNote } from './note-count';
import { buildSettings } from '../test/fakes';

const NOTE = [
	'Intro words here.',
	'',
	'# Draft',
	'one two three',
	'',
	'# Other',
	'four five'
].join('\n');

describe('countNote', () => {
	it('counts the whole note when there is no marker and no heading', () => {
		const result = countNote(NOTE, buildSettings());

		expect(result.mode).toBe('note');
		expect(result.words).toBe(10);
	});

	it('counts between markers and reports the number of pairs', () => {
		const text = 'skip <!-- word count start -->a b c<!-- word count end --> skip';

		const result = countNote(text, buildSettings({ heading: 'Draft' }));

		expect(result).toEqual({
			heading: null,
			headingFound: true,
			mode: 'sentinel',
			pairs: 1,
			words: 3
		});
	});

	it('counts under the configured heading', () => {
		const result = countNote(NOTE, buildSettings({ heading: 'draft' }));

		expect(result).toEqual({
			heading: 'Draft',
			headingFound: true,
			mode: 'heading',
			pairs: 0,
			words: 3
		});
	});

	it('reports a missing heading instead of counting the whole note', () => {
		const result = countNote(NOTE, buildSettings({ heading: 'Missing' }));

		expect(result.headingFound).toBe(false);
		expect(result.words).toBe(0);
	});

	it('lets a note override the configured heading', () => {
		const result = countNote(NOTE, buildSettings({ heading: 'Draft' }), ' Other ');

		expect(result.heading).toBe('Other');
		expect(result.words).toBe(2);
	});

	it('ignores a blank override', () => {
		const result = countNote(NOTE, buildSettings({ heading: 'Draft' }), '   ');

		expect(result.heading).toBe('Draft');
	});

	it('applies the counting options', () => {
		const text = 'one two\n\n```\ncode words here\n```';

		const result = countNote(text, buildSettings({ includeCodeBlocks: true }));

		expect(result.words).toBe(5);
	});
});

describe('countHeading', () => {
	it('counts under the heading even when the note has markers', () => {
		const text = `<!-- word count start -->a b<!-- word count end -->\n${ NOTE }`;

		const result = countHeading(text, buildSettings(), 'draft');

		expect(result).toEqual({
			heading: 'Draft',
			headingFound: true,
			mode: 'heading',
			pairs: 0,
			words: 3
		});
	});

	it('reports a missing heading by the name it was given', () => {
		const result = countHeading(NOTE, buildSettings(), ' Missing ');

		expect(result.heading).toBe('Missing');
		expect(result.headingFound).toBe(false);
		expect(result.words).toBe(0);
	});
});