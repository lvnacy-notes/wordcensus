/**
 * Keeps the status bar item current: it shows the active note's count while
 * the `showStatusBar` setting is on and hides otherwise. Everything it needs
 * from Obsidian arrives through `StatusBarControllerDeps`.
 */

import { buildStatusContent } from './status-bar-model';
import type { StatusBarController, StatusBarControllerDeps } from '../types';

/**
 * Creates a status bar controller. It starts stopped; calling `start` begins
 * watching, and `stop` releases the watch and hides the item.
 *
 * @param deps - The display, settings store, note access, and note-change subscription.
 * @returns A controller with `start` and `stop`.
 */
export function createStatusBarController(deps: StatusBarControllerDeps): StatusBarController {
	let generation = 0;
	let release: (() => void) | null = null;

	/** Shows the active note's count, or hides the item; drops the result if stopped meanwhile. */
	const refresh = async (): Promise<void> => {
		const token = generation;
		if (!deps.store.settings.showStatusBar) {
			deps.display.hide();
			return;
		}
		const note = await deps.readNote();
		if (token !== generation) {
			return;
		}
		const content = buildStatusContent(note?.count ?? null);
		if (content === null) {
			deps.display.hide();
			return;
		}
		deps.display.show(content.text, content.tooltip);
	};

	/** Runs `refresh`, logging any failure. */
	const refreshQuietly = (): void => {
		refresh().catch((error: unknown) => {
			console.error('Word Census: failed to read the note', error);
		});
	};

	/** Releases the note watch and hides the item. */
	const stop = (): void => {
		generation += 1;
		release?.();
		release = null;
		deps.display.hide();
	};

	/** Starts watching notes and refreshes. Restarts if already started. */
	const start = (): void => {
		stop();
		// The watcher also reports setting changes, which can show or hide the item.
		release = deps.watchNotes(refreshQuietly);
		refreshQuietly();
	};

	return { start, stop };
}