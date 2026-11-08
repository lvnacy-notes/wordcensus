/** Connects Obsidian's workspace, vault, and metadata events to the shared note watcher. */

import { debounce, type App } from 'obsidian';
import type { Store, WatcherSources } from '../types';

/**
 * Connects a note watcher to `app`'s events and to the store's setting
 * changes. Each `on*` source returns a function that removes its listener.
 *
 * @param app - The Obsidian application instance.
 * @param store - The settings store.
 * @returns The event sources for the watcher.
 */
export function buildWatcherSources(app: App, store: Store): WatcherSources {
	return {
		activePath: () => app.workspace.getActiveFile()?.path ?? null,
		debounce: (handler, delayMs) => debounce(
			handler,
			delayMs,
			true
		),
		onActive: (handler) => {
			const refs = [app.workspace.on('active-leaf-change', handler), app.workspace.on('file-open', handler)];
			return () => {
				for (const ref of refs) {
					app.workspace.offref(ref);
				}
			};
		},
		onDelete: (handler) => {
			const ref = app.vault.on('delete', (file) => handler(file.path));
			return () => {
				app.vault.offref(ref);
			};
		},
		onEdit: (handler) => {
			const ref = app.workspace.on('editor-change', handler);
			return () => {
				app.workspace.offref(ref);
			};
		},
		onMetadata: (handler) => {
			const ref = app.metadataCache.on('changed', (file) => handler(file.path));
			return () => {
				app.metadataCache.offref(ref);
			};
		},
		onMove: (handler) => {
			const ref = app.vault.on('rename', (file, oldPath) => handler(oldPath, file.path));
			return () => {
				app.vault.offref(ref);
			};
		},
		onSettings: (handler) => store.subscribe(handler)
	};
}