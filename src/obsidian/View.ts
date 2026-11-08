import { ItemView, type WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE } from './activateView';
import type { PanelController } from '../types';

/** The sidebar view that hosts the word count panel. */
export class WordCensusView extends ItemView {
	private readonly controller: PanelController;

	/**
	 * @param leaf - The workspace leaf that holds the view.
	 * @param controller - The panel controller opened into the view's content.
	 */
	constructor(leaf: WorkspaceLeaf, controller: PanelController) {
		super(leaf);
		this.controller = controller;
	}

	/** The view's title. */
	getDisplayText(): string {
		return 'Word Census';
	}

	/** The view's icon name. */
	getIcon(): string {
		return 'timer';
	}

	/** The view's registered type. */
	getViewType(): string {
		return VIEW_TYPE;
	}

	/** Closes the panel controller. */
	onClose(): Promise<void> {
		this.controller.close();
		return Promise.resolve();
	}

	/** Opens the panel controller into the view's content element. */
	onOpen(): Promise<void> {
		this.controller.open(this.contentEl);
		return Promise.resolve();
	}
}