import type { App, MarkdownPostProcessorContext } from 'obsidian';
import { createBlockController } from '../block/block-controller';
import { parseBlockSource } from '../block/block-model';
import { readNoteText } from './note-source';
import { WordCountBlock } from './WordCountBlock';
import type { NoteWatcher, Store } from '../types';

export const BLOCK_LANGUAGE = 'wordcount';

/** Builds the callback that renders each `wordcount` code block. */
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
			// A block counts the note it sits in, so only that note's properties matter.
			watchNotes: (handler) => watcher.watch(handler, { paths: () => [ctx.sourcePath] })
		});
		ctx.addChild(new WordCountBlock(el, controller));
	};
}
