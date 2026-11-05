import { ItemView } from 'obsidian';
import type { App, WorkspaceLeaf } from 'obsidian';
import type { PanelController } from '../types';

export const VIEW_TYPE = 'wordcensus-panel';

export class WordCensusView extends ItemView {
	private readonly controller: PanelController;

	constructor(leaf: WorkspaceLeaf, controller: PanelController) {
		super(leaf);
		this.controller = controller;
	}

	getDisplayText(): string {
		return 'Word Census';
	}

	getIcon(): string {
		return 'timer';
	}

	getViewType(): string {
		return VIEW_TYPE;
	}

	onClose(): Promise<void> {
		this.controller.close();
		return Promise.resolve();
	}

	onOpen(): Promise<void> {
		this.controller.open(this.contentEl);
		return Promise.resolve();
	}
}

/** Reveals the panel in the right sidebar, creating it if it is not open. */
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