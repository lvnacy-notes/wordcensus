/**
 * Runs the sidebar panel while it is open: keeps its model current from the
 * timer and the active note, turns the user's actions into timer calls, and
 * releases every subscription when it closes. Everything it needs from
 * Obsidian arrives through `PanelControllerDeps`.
 */

import { createPanel } from '../panel/panel';
import { buildPanelModel } from '../panel/panel-model';
import {
	isRunning,
	selectedRun
} from '../timer/timer';
import type {
	NoteInfo,
	Panel,
	PanelController,
	PanelControllerDeps
} from '../types';

/******************************************************************************
 * Declared Variables and Constants
******************************************************************************/

const MINUTE_MS = 60_000;

/******************************************************************************
 * Functions
******************************************************************************/

/**
 * Creates a controller that is closed until `open` is called. Opening again
 * without closing replaces the earlier panel.
 */
export function createPanelController(deps: PanelControllerDeps): PanelController {
	const { driver, store } = deps;
	let active: NoteInfo | null = null;
	let bound: NoteInfo | null = null;
	let generation = 0;
	let panel: Panel | null = null;
	let release: (() => void) | null = null;

	const render = (): void => {
		panel?.update(buildPanelModel({
			active,
			bound,
			now: deps.now(),
			timer: store.timer
		}));
	};

	const refresh = async (): Promise<void> => {
		const token = generation;
		const nextActive = await deps.readNote();
		const { binding } = store.timer.session;
		let nextBound: NoteInfo | null = null;
		if (binding !== null) {
			nextBound = nextActive?.path === binding.path
				? nextActive
				: await deps.readNote(binding.path);
		}
		if (token !== generation) {
			return;
		}
		active = nextActive;
		bound = nextBound;
		render();
	};

	const refreshQuietly = (): void => {
		refresh().catch((error: unknown) => {
			console.error('Word Census: failed to read the note', error);
		});
	};

	const toggle = async (): Promise<void> => {
		if (isRunning(selectedRun(store.timer))) {
			driver.pause();
			return;
		}
		await refresh();
		driver.start(active === null
			? undefined
			: { baselineWords: active.count.words, path: active.path });
		await refresh();
	};

	const close = (): void => {
		generation += 1;
		release?.();
		release = null;
		panel?.destroy();
		panel = null;
		active = null;
		bound = null;
	};

	return {
		close,
		open(host: HTMLElement): void {
			close();
			panel = createPanel(host, {
				onDuration: (minutes) => driver.setCountdownDuration(minutes * MINUTE_MS),
				onMode: (mode) => driver.selectMode(mode),
				onReset: () => {
					driver.reset();
					refreshQuietly();
				},
				onToggle: () => {
					toggle().catch((error: unknown) => {
						console.error('Word Census: failed to start the timer', error);
					});
				}
			});
			const unsubscribe = driver.subscribe(render);
			const stopWatching = deps.watchNotes(refreshQuietly);
			release = () => {
				unsubscribe();
				stopWatching();
			};
			render();
			refreshQuietly();
		}
	};
}