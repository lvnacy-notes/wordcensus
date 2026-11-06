import type { App, MarkdownPostProcessorContext } from 'obsidian';
import { createBlockController } from '../block/block-controller';
import { parseBlockSource } from '../block/block-model';
import type { Store } from '../types';
import { readNoteText, watchNotes } from './note-source';
import { WordCountBlock } from './WordCountBlock';

export const BLOCK_LANGUAGE = 'wordcount';

/** Builds the callback that renders each `wordcount` code block. */
export function buildProcessor(
	app: App,
	store: Store
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
			watchNotes: (handler) => watchNotes(app, handler)
		});
		ctx.addChild(new WordCountBlock(el, controller));
	};
}