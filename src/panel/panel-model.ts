/**
 * Turns the timer, the active note and the session's bound note into
 * everything the sidebar panel shows. Pure: the same input always gives the
 * same model.
 */

import {
	elapsedMs,
	formatDuration,
	isCountdownFinished,
	isRunning,
	remainingMs,
	selectedRun,
	sessionStats
} from '../timer/timer';
import type {
	ClockModel,
	DataRow,
	NoteCount,
	PanelInput,
	PanelModel,
	PanelSummary
} from '../types';

/******************************************************************************
 * Interfaces and Types
******************************************************************************/

type BaseModel = Pick<PanelModel, 'mode' | 'running' | 'summary'>;

/******************************************************************************
 * Functions
******************************************************************************/

function buildCountdownModel(base: BaseModel, input: PanelInput): PanelModel {
	const { now, timer } = input;
	const { countdown } = timer;
	const remaining = remainingMs(countdown, now);
	const clock: ClockModel = { ms: remaining, wedge: remaining / countdown.durationMs };
	return {
		...base,
		clock,
		durationEditable: !base.running,
		durationMinutes: Math.max(1, Math.round(countdown.durationMs / 60000)),
		rows: [
			{ label: 'Remaining', value: formatDuration(remaining, 'ceil') },
			{ label: 'Duration', value: formatDuration(countdown.durationMs) }
		],
		startDisabled: isCountdownFinished(countdown)
	};
}

/**
 * Builds the model for the selected timer mode.
 *
 * - Stopwatch and session hands show elapsed time.
 * - Countdown hands show time remaining, with a wedge for the fraction left.
 * - Session statistics are measured against the bound note's current count.
 */
export function buildPanelModel(input: PanelInput): PanelModel {
	const { now, timer } = input;
	const run = selectedRun(timer);
	const base = {
		mode: timer.mode,
		running: isRunning(run),
		summary: buildSummary(input.active?.count ?? null)
	};

	switch (timer.mode) {
		case 'stopwatch':
			return {
				...base,
				clock: { ms: elapsedMs(timer.stopwatch, now), wedge: null },
				durationEditable: false,
				durationMinutes: null,
				rows: [
					{ label: 'Elapsed', value: formatDuration(elapsedMs(timer.stopwatch, now)) }
				],
				startDisabled: false
			};
		case 'countdown':
			return buildCountdownModel(base, input);
		case 'session':
			return buildSessionModel(base, input);
	}
}

function buildSessionModel(base: BaseModel, input: PanelInput): PanelModel {
	const {
		active,
		bound,
		now,
		timer
	} = input;
	const stats = sessionStats(
		timer,
		now,
		bound?.count.words ?? 0
	);
	const rows: DataRow[] = [
		{ label: 'Elapsed', value: formatDuration(stats.elapsedMs) },
		{ label: 'Words written', value: formatWordsWritten(stats.wordsWritten) },
		{ label: 'Words per minute', value: formatRate(stats.wordsPerMinute) },
		{ label: 'Region words', value: active === null ? '—' : String(active.count.words) },
		{ label: 'Note', value: bound?.title ?? 'Not bound' }
	];
	return {
		...base,
		clock: { ms: stats.elapsedMs, wedge: null },
		durationEditable: false,
		durationMinutes: null,
		rows,
		startDisabled: false
	};
}

/** The headline and detail line for a count, or for no note when `count` is null. */
export function buildSummary(count: NoteCount | null): PanelSummary {
	if (count === null) {
		return { detail: '', headline: 'No note open' };
	}
	switch (count.mode) {
		case 'sentinel':
			return {
				detail: `Between markers (${ count.pairs } ${ count.pairs === 1 ? 'region' : 'regions' })`,
				headline: formatWords(count.words)
			};
		case 'heading':
			return count.headingFound
				? { detail: `Under “${ count.heading }”`, headline: formatWords(count.words) }
				: { detail: `No heading “${ count.heading }” in this note`, headline: 'Heading not found' };
		case 'note':
			return { detail: 'Whole note', headline: formatWords(count.words) };
	}
}

function formatRate(rate: number | null): string {
	return rate === null ? '—' : String(Math.round(rate));
}

function formatWords(words: number): string {
	return `${ words } ${ words === 1 ? 'word' : 'words' }`;
}

function formatWordsWritten(written: number | null): string {
	if (written === null) {
		return '—';
	}
	return written > 0 ? `+${ written }` : String(written);
}