import { MarkdownRenderChild } from 'obsidian';
import type { BlockController } from '../types';

/** Ties a `wordcount` block's controller to the lifetime of its rendered element. */
export class WordCountBlock extends MarkdownRenderChild {
	private readonly controller: BlockController;

	/**
	 * @param containerEl - The element the block renders into.
	 * @param controller - The block controller to open and close.
	 */
	constructor(containerEl: HTMLElement, controller: BlockController) {
		super(containerEl);
		this.controller = controller;
	}

	/** Opens the controller into the container. */
	onload(): void {
		this.controller.open(this.containerEl);
	}

	/** Closes the controller. */
	onunload(): void {
		this.controller.close();
	}
}