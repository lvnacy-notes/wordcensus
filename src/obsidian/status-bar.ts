import type { Plugin } from 'obsidian';
import { createStatusBarController } from '../status-bar/status-bar-controller';
import type {
	NoteInfo,
	NoteWatcher,
	StatusBarController,
	StatusBarDisplay,
	Store
} from '../types';

function buildDisplay(plugin: Plugin): StatusBarDisplay {
	const item = plugin.addStatusBarItem();
	item.hide();
	return {
		hide: () => item.hide(),
		show: (text, tooltip) => {
			item.setText(text);
			item.setAttr('aria-label', tooltip);
			item.show();
		}
	};
}

/**
 * Adds the status bar item and returns the controller that keeps it current.
 * `readNote` reads the active note.
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
		// Only the active note's count is shown, so only its properties matter.
		watchNotes: (handler) => watcher.watch(handler, { active: true })
	});
}
