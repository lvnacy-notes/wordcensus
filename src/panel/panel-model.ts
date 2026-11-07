/**
 * Turns the timer, the active note and the session's bound note into
 * everything the sidebar panel shows. Pure: the same input always gives the
 * same model.
 */

import { buildSummary } from '../counting/summary';
import {
	MINUTE_MS,
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
	PanelInput,
	PanelModel,
	SessionBinding,
	SessionResult
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
		durationMinutes: Math.max(1, Math.round(countdown.durationMs / MINUTE_MS)),
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

/**
 * A session that ended because its note was deleted: the clock stays at its
 * final time, the figures are the ones saved when it ended, and Start waits
 * for a reset.
 */
function buildEndedSessionModel(
	base: BaseModel,
	input: PanelInput,
	result: SessionResult
): PanelModel {
	const { active, now, timer } = input;
	const elapsed = elapsedMs(timer.session, now);
	return {
		...base,
		clock: { ms: elapsed, wedge: null },
		durationEditable: false,
		durationMinutes: null,
		rows: [
			{ label: 'Elapsed', value: formatDuration(elapsed) },
			{ label: 'Words written', value: formatWordsWritten(result.wordsWritten) },
			{ label: 'Words per minute', value: formatRate(result.wordsPerMinute) },
			{ label: 'Region words', value: active === null ? '—' : String(active.count.words) },
			{ label: 'Note', value: `${ fileTitle(result.path) } (deleted)` }
		],
		startDisabled: true
	};
}

function buildSessionModel(base: BaseModel, input: PanelInput): PanelModel {
	const {
		active,
		bound,
		now,
		timer
	} = input;
	const { result } = timer.session;
	if (result !== null) {
		return buildEndedSessionModel(
			base,
			input,
			result
		);
	}
	// A null count means "can't measure", not zero words: measuring against zero
	// would report every word of the baseline as deleted.
	const stats = sessionStats(
		timer,
		now,
		bound?.count.words ?? null
	);
	const rows: DataRow[] = [
		{ label: 'Elapsed', value: formatDuration(stats.elapsedMs) },
		{ label: 'Words written', value: formatWordsWritten(stats.wordsWritten) },
		{ label: 'Words per minute', value: formatRate(stats.wordsPerMinute) },
		{ label: 'Region words', value: active === null ? '—' : String(active.count.words) },
		{ label: 'Note', value: bound?.title ?? boundNoteName(timer.session.binding) }
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

/**
 * What to show for the session's note when its count isn't available: the
 * file name from the binding's path, or "Not bound" for a session with none.
 */
function boundNoteName(binding: SessionBinding | null): string {
	return binding === null ? 'Not bound' : fileTitle(binding.path);
}

/** A note's name as Obsidian shows it: the file name without its folders or `.md`. */
function fileTitle(path: string): string {
	const fileName = path.split('/').pop() ?? path;
	return fileName.replace(/\.md$/, '');
}

function formatRate(rate: number | null): string {
	return rate === null ? '—' : String(Math.round(rate));
}

function formatWordsWritten(written: number | null): string {
	if (written === null) {
		return '—';
	}
	return written > 0 ? `+${ written }` : String(written);
}