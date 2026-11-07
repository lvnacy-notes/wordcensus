import {
	describe,
	expect,
	it
} from 'vitest';
import { createLastCounts } from './last-counts';
import type { NoteInfo } from '../types';

function buildNote(path: string, words: number): NoteInfo {
	return {
		count: {
			heading: null,
			headingFound: true,
			mode: 'note',
			pairs: 0,
			words
		},
		path,
		title: path
	};
}

describe('createLastCounts', () => {
	it('remembers the latest count of the session\'s note', () => {
		const counts = createLastCounts(() => 'a.md');

		counts.observe(buildNote('a.md', 10));
		counts.observe(buildNote('a.md', 14));

		expect(counts.recall('a.md')).toBe(14);
	});

	it('ignores every other note', () => {
		const counts = createLastCounts(() => 'a.md');

		counts.observe(buildNote('b.md', 99));

		expect(counts.recall('b.md')).toBe(null);
		expect(counts.recall('a.md')).toBe(null);
	});

	it('ignores everything while no session is bound', () => {
		const counts = createLastCounts(() => null);

		counts.observe(buildNote('a.md', 10));

		expect(counts.recall('a.md')).toBe(null);
	});

	it('returns the note it was given, and accepts none', () => {
		const counts = createLastCounts(() => 'a.md');
		const note = buildNote('a.md', 10);

		expect(counts.observe(note)).toBe(note);
		expect(counts.observe(null)).toBe(null);
	});

	it('does not recall a count for a different path', () => {
		const counts = createLastCounts(() => 'a.md');
		counts.observe(buildNote('a.md', 10));

		const result = counts.recall('b.md');

		expect(result).toBe(null);
	});
});
