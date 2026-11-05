import type { App, Command } from 'obsidian';
import { activateView } from '../obsidian/View';

/** The command that reveals the sidebar panel, so it is reachable from the mobile command palette. */
export function buildInvokeCommand(app: App): Command {
	return {
		callback: () => {
			void activateView(app);
		},
		id: 'open-panel',
		name: 'Open word count panel'
	};
}