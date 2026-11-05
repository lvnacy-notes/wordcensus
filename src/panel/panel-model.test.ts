import {
	describe,
	expect,
	it
} from 'vitest';
import { buildPanelModel } from './panel-model';
import {
	createTimer,
	setCountdownDuration,
	startTimer,
	tickTimer
} from '../timer/timer';
import type {
	NoteCount,
	NoteInfo,
	PanelInput,
	TimerMode,
	TimerState
} from '../types';

const T0 = 1_000_000;
const MINUTE = 60_000;

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

function buildNote(overrides: Partial<NoteCount> = {}, path = 'a.md'): NoteInfo {
	return {
		count: buildCount(overrides),
		path,
		title: path.replace('.md', '')
	};
}

function buildInput(mode: TimerMode, overrides: Partial<PanelInput> = {}): PanelInput {
	return {
		active: buildNote(),
		bound: null,
		now: T0,
		timer: { ...createTimer(), mode },
		...overrides
	};
}

describe('buildPanelModel', () => {
	describe('summary', () => {
		it('says so when no note is open', () => {
			const model = buildPanelModel(buildInput('stopwatch', { active: null }));

			expect(model.summary).toEqual({ detail: '', headline: 'No note open' });
		});

		it('names the whole note, singular for one word', () => {
			const active = buildNote({ words: 1 });

			const model = buildPanelModel(buildInput('stopwatch', { active }));

			expect(model.summary).toEqual({ detail: 'Whole note', headline: '1 word' });
		});

		it('counts the marker regions', () => {
			const active = buildNote({ mode: 'sentinel', pairs: 2, words: 40 });

			const model = buildPanelModel(buildInput('stopwatch', { active }));

			expect(model.summary).toEqual({ detail: 'Between markers (2 regions)', headline: '40 words' });
		});

		it('names the heading', () => {
			const active = buildNote({ heading: 'Draft', mode: 'heading', words: 9 });

			const model = buildPanelModel(buildInput('stopwatch', { active }));

			expect(model.summary).toEqual({ detail: 'Under “Draft”', headline: '9 words' });
		});

		it('says a missing heading is missing', () => {
			const active = buildNote({
				heading: 'Draft',
				headingFound: false,
				mode: 'heading',
				words: 0
			});

			const model = buildPanelModel(buildInput('stopwatch', { active }));

			expect(model.summary.headline).toBe('Heading not found');
		});
	});

	describe('stopwatch', () => {
		it('shows elapsed time on the hands and as a readout, with no wedge', () => {
			const timer = startTimer(createTimer(), T0);

			const model = buildPanelModel(buildInput('stopwatch', { now: T0 + 75_000, timer }));

			expect(model.clock).toEqual({ ms: 75_000, wedge: null });
			expect(model.rows).toEqual([{ label: 'Elapsed', value: '1:15' }]);
			expect(model.running).toBe(true);
		});
	});

	describe('countdown', () => {
		it('shows time remaining, the duration and the fraction left', () => {
			const idle = setCountdownDuration(createTimer(), 10 * MINUTE);
			const timer = startTimer({ ...idle, mode: 'countdown' }, T0);

			const model = buildPanelModel(buildInput('countdown', { now: T0 + 2 * MINUTE, timer }));

			expect(model.clock).toEqual({ ms: 8 * MINUTE, wedge: 0.8 });
			expect(model.rows).toEqual([
				{ label: 'Remaining', value: '8:00' },
				{ label: 'Duration', value: '10:00' }
			]);
			expect(model.durationMinutes).toBe(10);
		});

		it('lets the duration be edited only while stopped', () => {
			const stopped: TimerState = { ...createTimer(), mode: 'countdown' };
			const running = startTimer(stopped, T0);

			const whenStopped = buildPanelModel(buildInput('countdown', { timer: stopped }));
			const whenRunning = buildPanelModel(buildInput('countdown', { timer: running }));

			expect(whenStopped.durationEditable).toBe(true);
			expect(whenRunning.durationEditable).toBe(false);
		});

		it('disables Start once the countdown has finished', () => {
			const started = startTimer({ ...createTimer(), mode: 'countdown' }, T0);
			const end = T0 + started.countdown.durationMs;
			const finished = tickTimer(started, end);

			const model = buildPanelModel(buildInput('countdown', { now: end, timer: finished }));

			expect(model.startDisabled).toBe(true);
			expect(model.rows[0]?.value).toBe('0:00');
		});
	});

	describe('session', () => {
		it('shows words written, the rate and the bound note', () => {
			const bound = buildNote({ words: 220 }, 'novel.md');
			const timer = startTimer(
				{ ...createTimer(), mode: 'session' },
				T0,
				{ baselineWords: 120, path: 'novel.md' }
			);

			const model = buildPanelModel(buildInput('session', {
				bound,
				now: T0 + 2 * MINUTE,
				timer
			}));

			expect(model.rows).toEqual([
				{ label: 'Elapsed', value: '2:00' },
				{ label: 'Words written', value: '+100' },
				{ label: 'Words per minute', value: '50' },
				{ label: 'Region words', value: '120' },
				{ label: 'Note', value: 'novel' }
			]);
		});

		it('rounds the rate to a whole number', () => {
			const bound = buildNote({ words: 200 }, 'novel.md');
			const timer = startTimer(
				{ ...createTimer(), mode: 'session' },
				T0,
				{ baselineWords: 100, path: 'novel.md' }
			);

			const model = buildPanelModel(buildInput('session', {
				bound,
				now: T0 + 3 * MINUTE,
				timer
			}));

			expect(model.rows[2]?.value).toBe('33');
		});

		it('shows no statistics for a session with no note', () => {
			const model = buildPanelModel(buildInput('session', { active: null }));

			expect(model.rows.map((row) => row.value)).toEqual([
				'0:00',
				'—',
				'—',
				'—',
				'Not bound'
			]);
		});

		it('shows a negative word count and a rate of zero when text was removed', () => {
			const bound = buildNote({ words: 80 }, 'novel.md');
			const timer = startTimer(
				{ ...createTimer(), mode: 'session' },
				T0,
				{ baselineWords: 100, path: 'novel.md' }
			);

			const model = buildPanelModel(buildInput('session', {
				bound,
				now: T0 + MINUTE,
				timer
			}));

			expect(model.rows[1]?.value).toBe('-20');
			expect(model.rows[2]?.value).toBe('0');
		});
	});
});