import {
	describe,
	expect,
	it
} from 'vitest';
import { buildStatusContent } from './status-bar-model';
import type { NoteCount } from '../types';

function count(overrides: Partial<NoteCount>): NoteCount {
	return {
		heading: null,
		headingFound: true,
		mode: 'note',
		pairs: 0,
		words: 142,
		...overrides
	};
}

describe('buildStatusContent', () => {
	it('shows nothing when there is no note', () => {
		expect(buildStatusContent(null)).toBeNull();
	});

	it('marks a counted region and says how it was found', () => {
		expect(buildStatusContent(count({ mode: 'sentinel', pairs: 2 }))).toEqual({
			text: '142 words (region)',
			tooltip: 'Between markers (2 regions)'
		});
	});

	it('leaves the mark off for the whole note', () => {
		expect(buildStatusContent(count({}))).toEqual({
			text: '142 words',
			tooltip: 'Whole note'
		});
	});

	it('says so when the heading is missing', () => {
		const content = buildStatusContent(count({
			heading: 'Draft',
			headingFound: false,
			mode: 'heading',
			words: 0
		}));

		expect(content?.text).toBe('Heading not found');
	});
});