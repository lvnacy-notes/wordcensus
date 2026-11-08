import { type App } from 'obsidian';

/******************************************************************************
 * Declared Variables and Constants
******************************************************************************/

/** The view type registered for the panel. */
export const VIEW_TYPE = 'wordcensus-panel';

/******************************************************************************
 * Functions
******************************************************************************/

/**
 * Reveals the panel in the right sidebar, creating it if it is not open.
 *
 * @param app - The Obsidian application instance.
 */
export async function activateView(app: App): Promise<void> {
	const { workspace } = app;
	const existing = workspace.getLeavesOfType(VIEW_TYPE)[0];
	const leaf = existing ?? workspace.getRightLeaf(false);
	if (leaf === null) {
		return;
	}
	if (existing === undefined) {
		await leaf.setViewState({ active: true, type: VIEW_TYPE });
	}
	await workspace.revealLeaf(leaf);
}