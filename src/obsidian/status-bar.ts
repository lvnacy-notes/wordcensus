import type { Plugin } from 'obsidian';
import { createStatusBarController } from '../status-bar/status-bar-controller';
import type {
	StatusBarController,
	StatusBarDisplay,
	Store
} from '../types';
import {
	readNote,
	watchNotes
} from './note-source';

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

/** Adds the status bar item and returns the controller that keeps it current. */
export function buildStatusBar(plugin: Plugin, store: Store): StatusBarController {
	return createStatusBarController({
		display: buildDisplay(plugin),
		readNote: () => readNote(plugin.app, store),
		store,
		watchNotes: (handler) => watchNotes(plugin.app, handler)
	});
}