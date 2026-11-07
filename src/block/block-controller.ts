/**
 * Keeps one `wordcount` code block's count current while the block is on
 * screen, and releases its note subscription when it is removed. Everything
 * it needs from Obsidian arrives through `BlockControllerDeps`.
 */

import { countBlock } from './block-model';
import { buildSummary } from '../counting/summary';
import type { BlockController, BlockControllerDeps } from '../types';

/******************************************************************************
 * Interfaces and Types
******************************************************************************/

interface BlockView {
	detail: HTMLElement;
	headline: HTMLElement;
	root: HTMLElement;
}

/******************************************************************************
 * Declared Variables and Constants
******************************************************************************/

const UNAVAILABLE_MESSAGE = 'Word count unavailable';

/******************************************************************************
 * Functions
******************************************************************************/

/**
 * Creates a controller that is closed until `open` is called. Opening again
 * without closing replaces the earlier count.
 */
export function createBlockController(deps: BlockControllerDeps): BlockController {
	let generation = 0;
	let release: (() => void) | null = null;
	let view: BlockView | null = null;

	const refresh = async (): Promise<void> => {
		const token = generation;
		const note = await deps.readText();
		if (token !== generation || view === null) {
			return;
		}
		if (note === null) {
			view.headline.textContent = UNAVAILABLE_MESSAGE;
			view.detail.textContent = '';
			return;
		}
		const summary = buildSummary(countBlock(
			note,
			deps.options,
			deps.store.settings
		));
		view.headline.textContent = summary.headline;
		view.detail.textContent = summary.detail;
	};

	const refreshQuietly = (): void => {
		refresh().catch((error: unknown) => {
			console.error('Word Census: failed to read the note', error);
		});
	};

	const close = (): void => {
		generation += 1;
		release?.();
		release = null;
		view?.root.remove();
		view = null;
	};

	return {
		close,
		open(host: HTMLElement): void {
			close();
			const root = createSpan();
			root.className = 'wordcensus-block';
			const headline = createSpan();
			headline.className = 'wordcensus-block-count';
			const detail = createSpan();
			detail.className = 'wordcensus-block-detail';
			root.append(headline, detail);
			host.appendChild(root);
			view = {
				detail,
				headline,
				root
			};
			release = deps.watchNotes(refreshQuietly);
			refreshQuietly();
		}
	};
}