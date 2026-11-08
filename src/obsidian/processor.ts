import type { App, MarkdownPostProcessorContext } from 'obsidian';
import { createBlockController } from '../block/block-controller';
import { parseBlockSource } from '../block/block-model';
import { readNoteText } from './note-source';
import { WordCountBlock } from './WordCountBlock';
import type { NoteWatcher, Store } from '../types';

/******************************************************************************
 * Declared Variables and Constants
******************************************************************************/

/** The code block language that marks a word count block. */
export const BLOCK_LANGUAGE = 'wordcount';

/******************************************************************************
 * Functions
******************************************************************************/

/**
 * Builds the callback that renders each `wordcount` code block.
 *
 * @param app - The Obsidian application instance.
 * @param store - The settings store supplying the counting options.
 * @param watcher - The shared note watcher.
 * @returns The Markdown code block processor.
 */
export function buildProcessor(
	app: App,
	store: Store,
	watcher: NoteWatcher
): (
	source: string,
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext
) => void {
	return (
		source,
		el,
		ctx
	) => {
		const controller = createBlockController({
			options: parseBlockSource(source),
			readText: () => readNoteText(app, ctx.sourcePath),
			store,
			// Watches only the note the block sits in.
			watchNotes: (handler) => watcher.watch(handler, { paths: () => [ctx.sourcePath] })
		});
		ctx.addChild(new WordCountBlock(el, controller));
	};
}