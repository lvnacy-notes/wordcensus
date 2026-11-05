#!/usr/bin/env node

/**
 * The Coverage Ratchet: there's no invented percentage target, coverage
 * just can't drop below wherever it already sits. This script is the
 * enforcement half of that - it diffs the coverage this run actually
 * produced against the floor recorded in `.coverage/baseline.json` and
 * fails if any of the four aggregate metrics (lines, statements,
 * functions, branches) has dropped.
 *
 * The baseline only ever moves by a human editing `.coverage/baseline.json`
 * by hand in the same PR that raised coverage - this script never writes
 * to it. That's deliberate: no bot commits, no write-back permissions
 * needed in CI, a person stays accountable for consciously raising the
 * floor.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Tolerance for float rounding between runs, in percentage points. Kept
// small on purpose: this plugin's timer logic takes an injectable clock and
// is tested with fake timers, so there is no known source of real-time
// flakiness to absorb (the parent project this script came from needed a
// much larger value because of a real setInterval). If coverage ever
// swings between runs with no source changes, find the nondeterministic
// test rather than raising this number.
const EPSILON = 0.5;

const METRICS = [
	'lines',
	'statements',
	'functions',
	'branches'
];

const SUMMARY_PATH = path.resolve('.coverage/report/coverage-summary.json');
const BASELINE_PATH = path.resolve('.coverage/baseline.json');

async function readJson(filePath, missingMessage) {
	let raw;
	try {
		raw = await readFile(filePath, 'utf8');
	} catch (error) {
		console.error(missingMessage);
		console.error(`  (${ filePath }: ${ error.message })`);
		process.exit(1);
	}
	return JSON.parse(raw);
}

const summary = await readJson(
	SUMMARY_PATH,
	'Coverage Ratchet: no coverage summary found. Run `vitest run --coverage` before this check.'
);
const baseline = await readJson(
	BASELINE_PATH,
	'Coverage Ratchet: no baseline found - .coverage/baseline.json should be committed to the repo.'
);

const current = {
	lines: summary.total?.lines?.pct,
	statements: summary.total?.statements?.pct,
	functions: summary.total?.functions?.pct,
	branches: summary.total?.branches?.pct,
};

const regressions = METRICS.filter((metric) => {
	const currentValue = current[metric];
	const baselineValue = baseline[metric];
	if (typeof currentValue !== 'number' || typeof baselineValue !== 'number') {
		return true;
	}
	return currentValue < baselineValue - EPSILON;
});

if (regressions.length > 0) {
	console.error('Coverage Ratchet: coverage dropped below the committed baseline.\n');
	for (const metric of regressions) {
		console.error(`  ${ metric }: ${ current[metric] }% (baseline: ${ baseline[metric] }%)`);
	}
	console.error(
		'\nEither add tests to bring coverage back up, or - if this drop is deliberate and reviewed - '
		+ 'lower the corresponding value(s) in .coverage/baseline.json in this same PR.'
	);
	process.exit(1);
}

console.log('Coverage Ratchet: OK. Current coverage meets or exceeds the committed baseline.');
for (const metric of METRICS) {
	console.log(`  ${ metric }: ${ current[metric] }% (baseline: ${ baseline[metric] }%)`);
}
