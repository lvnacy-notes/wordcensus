/**
 * Reads notes from the vault and watches for changes that affect their
 * counts. The only module that reaches into Obsidian's workspace, vault
 * and metadata cache for the sidebar panel.
 */

import {
	MarkdownView,
	TFile,
	debounce
} from 'obsidian';
import type { App } from 'obsidian';
import { countNote } from '../counting/note-count';
import type {
	NoteInfo,
	NoteText,
	Store
} from '../types';

/******************************************************************************
 * Declared Variables and Constants
******************************************************************************/

const EDIT_DEBOUNCE_MS = 500;
const HEADING_PROPERTY = 'word-count-heading';

/******************************************************************************
 * Functions
******************************************************************************/

/** The note's own heading from its `word-count-heading` property, or null. */
function readHeadingOverride(app: App, file: TFile): string | null {
	const value: unknown = app.metadataCache.getFileCache(file)?.frontmatter?.[HEADING_PROPERTY];
	return typeof value === 'string' ? value : null;
}

/**
 * Counts the region of the note at `path`, or of the active note when
 * `path` is omitted. Null when there is no such Markdown note.
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
 * Reads the text of the note at `path`, or of the active note when `path`
 * is omitted, with the note's own heading property. Null when there is no
 * such Markdown note.
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

/** The text of an open note including edits not yet saved, otherwise the cached file. */
async function readText(app: App, file: TFile): Promise<string> {
	for (const leaf of app.workspace.getLeavesOfType('markdown')) {
		if (leaf.view instanceof MarkdownView && leaf.view.file?.path === file.path) {
			return leaf.view.getViewData();
		}
	}
	return await app.vault.cachedRead(file);
}

/**
 * Calls `handler` when the active note changes, when its properties change
 * and, debounced, while it is being edited. Returns a function that stops
 * watching.
 */
export function watchNotes(app: App, handler: () => void): () => void {
	const debounced = debounce(
		handler,
		EDIT_DEBOUNCE_MS,
		true
	);
	const workspaceRefs = [
		app.workspace.on('active-leaf-change', handler),
		app.workspace.on('file-open', handler),
		app.workspace.on('editor-change', debounced)
	];
	const metadataRef = app.metadataCache.on('changed', handler);

	return () => {
		for (const ref of workspaceRefs) {
			app.workspace.offref(ref);
		}
		app.metadataCache.offref(metadataRef);
		debounced.cancel();
	};
}