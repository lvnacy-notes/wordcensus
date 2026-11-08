/**
 * Reads notes from the vault: their text, properties, and counts. Watching for
 * changes is in `watcher-sources.ts`.
 */

import {
	MarkdownView,
	TFile,
	type App
} from 'obsidian';
import { countNote } from '../counting/note-count';
import type {
	NoteInfo,
	NoteText,
	Store
} from '../types';

/******************************************************************************
 * Declared Variables and Constants
******************************************************************************/

/** The frontmatter property that gives a note its own heading. */
const HEADING_PROPERTY = 'word-count-heading';

/******************************************************************************
 * Functions
******************************************************************************/

/**
 * Reads a note's own heading from its `word-count-heading` property.
 *
 * @param app - The Obsidian application instance.
 * @param file - The note file.
 * @returns The heading, or `null` when the property is missing or not a string.
 */
function readHeadingOverride(app: App, file: TFile): string | null {
	const value: unknown = app.metadataCache.getFileCache(file)?.frontmatter?.[HEADING_PROPERTY];
	return typeof value === 'string' ? value : null;
}

/**
 * Counts the region of the note at `path`, or of the active note when `path`
 * is omitted.
 *
 * @param app - The Obsidian application instance.
 * @param store - The settings store supplying the counting options.
 * @param path - The note's vault path; omit for the active note.
 * @returns The note's count, path, and title, or `null` when there is no such Markdown note.
 */
export async function readNote(
	app: App,
	store: Store,
	path?: string
): Promise<NoteInfo | null> {
	const note = await readNoteText(app, path);
	if (note === null) {
		return null;
	}
	return {
		count: countNote(
			note.text,
			store.settings,
			note.headingOverride
		),
		path: note.path,
		title: note.title
	};
}

/**
 * Reads the text of the note at `path`, or of the active note when `path` is
 * omitted, along with the note's own heading property.
 *
 * @param app - The Obsidian application instance.
 * @param path - The note's vault path; omit for the active note.
 * @returns The note's text, path, title, and heading override, or `null` when there is no such Markdown note.
 */
export async function readNoteText(app: App, path?: string): Promise<NoteText | null> {
	const file = path === undefined
		? app.workspace.getActiveFile()
		: app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile) || file.extension !== 'md') {
		return null;
	}
	return {
		headingOverride: readHeadingOverride(app, file),
		path: file.path,
		text: await readText(app, file),
		title: file.basename
	};
}

/**
 * Reads a note's text, including edits not yet saved when the note is open.
 *
 * @param app - The Obsidian application instance.
 * @param file - The note file.
 * @returns The open editor's text, otherwise the cached file text.
 */
async function readText(app: App, file: TFile): Promise<string> {
	for (const leaf of app.workspace.getLeavesOfType('markdown')) {
		if (leaf.view instanceof MarkdownView && leaf.view.file?.path === file.path) {
			return leaf.view.getViewData();
		}
	}
	return await app.vault.cachedRead(file);
}