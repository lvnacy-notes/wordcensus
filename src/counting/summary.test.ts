import {
	describe,
	expect,
	it
} from 'vitest';
import { buildSummary } from './summary';
import type { NoteCount } from '../types';

function buildCount(overrides: Partial<NoteCount> = {}): NoteCount {
	return {
		heading: null,
		headingFound: true,
		mode: 'note',
		pairs: 0,
		words: 120,
		...overrides
	};
}

describe('buildSummary', () => {
	it('says so when no note is open', () => {
		expect(buildSummary(null)).toEqual({ detail: '', headline: 'No note open' });
	});

	it('names the whole note, singular for one word', () => {
		const summary = buildSummary(buildCount({ words: 1 }));

		expect(summary).toEqual({ detail: 'Whole note', headline: '1 word' });
	});

	it('counts the marker regions', () => {
		const summary = buildSummary(buildCount({ mode: 'sentinel', pairs: 2, words: 40 }));

		expect(summary).toEqual({ detail: 'Between markers (2 regions)', headline: '40 words' });
	});

	it('names a single marker region in the singular', () => {
		const summary = buildSummary(buildCount({ mode: 'sentinel', pairs: 1, words: 5 }));

		expect(summary).toEqual({ detail: 'Between markers (1 region)', headline: '5 words' });
	});

	it('names the heading', () => {
		const summary = buildSummary(buildCount({ heading: 'Draft', mode: 'heading', words: 9 }));

		expect(summary).toEqual({ detail: 'Under “Draft”', headline: '9 words' });
	});

	it('says a missing heading is missing', () => {
		const summary = buildSummary(buildCount({
			heading: 'Draft',
			headingFound: false,
			mode: 'heading',
			words: 0
		}));

		expect(summary).toEqual({
			detail: 'No heading “Draft” in this note',
			headline: 'Heading not found'
		});
	});
});