/** Keeps a `wordcount` code block's count current while it is on screen. */

import { countBlock } from './block-model';
import { buildSummary } from '../counting/summary';
import type { BlockController, BlockControllerDeps } from '../types';

/******************************************************************************
 * Interfaces and Types
******************************************************************************/

/** The elements a mounted block renders into. */
interface BlockView {
	detail: HTMLElement;
	headline: HTMLElement;
	root: HTMLElement;
}

/******************************************************************************
 * Declared Variables and Constants
******************************************************************************/

/** Headline shown when the note text cannot be read. */
const UNAVAILABLE_MESSAGE = 'Word count unavailable';

/******************************************************************************
 * Functions
******************************************************************************/

/**
 * Creates a controller for one `wordcount` block. It starts closed; opening
 * again without closing replaces the earlier count. Closing releases the note
 * subscription and removes the block's elements.
 *
 * @param deps - Note access, block options, settings store, and note-change subscription.
 * @returns A controller with `open` and `close`.
 */
export function createBlockController(deps: BlockControllerDeps): BlockController {
	let generation = 0;
	let release: (() => void) | null = null;
	let view: BlockView | null = null;

	/** Reads the note and renders its count; drops the result if closed or reopened meanwhile. */
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

	/** Runs `refresh`, logging any failure. */
	const refreshQuietly = (): void => {
		refresh().catch((error: unknown) => {
			console.error('Word Census: failed to read the note', error);
		});
	};

	/** Releases the subscription and removes the rendered elements. */
	const close = (): void => {
		generation += 1;
		release?.();
		release = null;
		view?.root.remove();
		view = null;
	};

	/** Renders the block into `host`, subscribes to note changes, and counts. */
	const open = (host: HTMLElement): void => {
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
	};

	return { close, open };
}