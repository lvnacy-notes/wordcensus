import type { App, Command } from 'obsidian';
import { activateView } from '../obsidian/activateView';

/**
 * Builds the command that reveals the word count panel in the right sidebar.
 *
 * @param app - The Obsidian application instance.
 * @returns The `open-panel` command definition.
 */
export function buildInvokeCommand(app: App): Command {
	return {
		callback: () => {
			void activateView(app);
		},
		id: 'open-panel',
		name: 'Open word count panel'
	};
}