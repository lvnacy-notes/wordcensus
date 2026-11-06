/**
 * Keeps the status bar item current: it shows the active note's count while
 * the `showStatusBar` setting is on and hides otherwise. Everything it needs
 * from Obsidian arrives through `StatusBarControllerDeps`.
 */

import { buildStatusContent } from './status-bar-model';
import type { StatusBarController, StatusBarControllerDeps } from '../types';

/** Creates a controller that is stopped until `start` is called. */
export function createStatusBarController(deps: StatusBarControllerDeps): StatusBarController {
	let generation = 0;
	let releases: (() => void)[] = [];

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

	const refreshQuietly = (): void => {
		refresh().catch((error: unknown) => {
			console.error('Word Census: failed to read the note', error);
		});
	};

	const stop = (): void => {
		generation += 1;
		for (const release of releases) {
			release();
		}
		releases = [];
		deps.display.hide();
	};

	return {
		start(): void {
			stop();
			releases = [
				deps.watchNotes(refreshQuietly),
				deps.store.subscribe(refreshQuietly)
			];
			refreshQuietly();
		},
		stop
	};
}