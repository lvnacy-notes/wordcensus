import type { Plugin } from 'obsidian';
import { createStatusBarController } from '../status-bar/status-bar-controller';
import type {
	NoteInfo,
	NoteWatcher,
	StatusBarController,
	StatusBarDisplay,
	Store
} from '../types';

/**
 * Adds a status bar item, initially hidden, and wraps it as a display.
 *
 * @param plugin - The plugin that owns the item.
 * @returns A display that shows text with a tooltip, or hides the item.
 */
function buildDisplay(plugin: Plugin): StatusBarDisplay {
	const item = plugin.addStatusBarItem();
	item.hide();

	const hide: StatusBarDisplay['hide'] = () => item.hide();
	const show: StatusBarDisplay['show'] = (text, tooltip) => {
		item.setText(text);
		item.setAttr('aria-label', tooltip);
		item.show();
	};

	return { hide, show };
}

/**
 * Adds the status bar item and builds the controller that keeps it current.
 *
 * @param plugin - The plugin that owns the item.
 * @param store - The settings store.
 * @param watcher - The shared note watcher.
 * @param readNote - Reads the active note's count.
 * @returns The status bar controller.
 */
export function buildStatusBar(
	plugin: Plugin,
	store: Store,
	watcher: NoteWatcher,
	readNote: () => Promise<NoteInfo | null>
): StatusBarController {
	return createStatusBarController({
		display: buildDisplay(plugin),
		readNote,
		store,
		// Watches only the active note.
		watchNotes: (handler) => watcher.watch(handler, { active: true })
	});
}