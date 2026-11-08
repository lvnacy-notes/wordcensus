/**
 * Turns the timer, the active note, and the session's bound note into
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

/** The model fields shared by every timer mode. */
type BaseModel = Pick<PanelModel, 'mode' | 'running' | 'summary'>;

/******************************************************************************
 * Functions
******************************************************************************/

/**
 * Gets what to show for the session's note when its count is unavailable.
 *
 * @param binding - The session's note binding, or `null` for a session with none.
 * @returns The file name from the binding's path, or "Not bound".
 */
function boundNoteName(binding: SessionBinding | null): string {
	return binding === null ? 'Not bound' : fileTitle(binding.path);
}

/**
 * Builds the model for countdown mode: time remaining, a wedge for the
 * fraction left, and an editable duration while stopped.
 *
 * @param base - The fields shared by every mode.
 * @param input - The panel input.
 * @returns The countdown model.
 */
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
		rows: [{ label: 'Remaining', value: formatDuration(remaining, 'ceil') }, { label: 'Duration', value: formatDuration(countdown.durationMs) }],
		startDisabled: isCountdownFinished(countdown)
	};
}

/**
 * Builds the model for a session that ended because its note was deleted. The
 * clock stays at its final time, the figures are the ones saved when it ended,
 * and Start is disabled until a reset.
 *
 * @param base - The fields shared by every mode.
 * @param input - The panel input.
 * @param result - The saved result of the ended session.
 * @returns The ended-session model.
 */
function buildEndedSessionModel(
	base: BaseModel,
	input: PanelInput,
	result: SessionResult
): PanelModel {
	const {
		active,
		now,
		timer
	} = input;
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

/**
 * Builds the model for the selected timer mode.
 *
 * - Stopwatch and session hands show elapsed time.
 * - Countdown hands show time remaining, with a wedge for the fraction left.
 * - Session statistics are measured against the bound note's current count.
 *
 * @param input - The timer, the active and bound notes, and the current time.
 * @returns Everything the panel shows.
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
				rows: [{ label: 'Elapsed', value: formatDuration(elapsedMs(timer.stopwatch, now)) }],
				startDisabled: false
			};
		case 'countdown':
			return buildCountdownModel(base, input);
		case 'session':
			return buildSessionModel(base, input);
	}
}

/**
 * Builds the model for session mode. An ended session uses its saved result;
 * otherwise statistics are measured against the bound note's current count,
 * where a `null` count means the note can't be measured, not zero words.
 *
 * @param base - The fields shared by every mode.
 * @param input - The panel input.
 * @returns The session model.
 */
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
 * Gets a note's name as Obsidian shows it: the file name without its folders
 * or `.md`.
 *
 * @param path - The note's vault path.
 * @returns The note's title.
 */
function fileTitle(path: string): string {
	const fileName = path.split('/').pop() ?? path;
	return fileName.replace(/\.md$/, '');
}

/**
 * Formats a words-per-minute rate.
 *
 * @param rate - The rate, or `null` when it is unavailable.
 * @returns The rounded rate, or an em dash when unavailable.
 */
function formatRate(rate: number | null): string {
	return rate === null ? '—' : String(Math.round(rate));
}

/**
 * Formats a words-written figure with an explicit sign for gains.
 *
 * @param written - The words written, or `null` when unavailable.
 * @returns For example `+12`, `0`, or `-3`, or an em dash when unavailable.
 */
function formatWordsWritten(written: number | null): string {
	if (written === null) {
		return '—';
	}
	return written > 0 ? `+${ written }` : String(written);
}