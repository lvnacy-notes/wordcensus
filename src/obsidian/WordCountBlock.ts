import { MarkdownRenderChild } from 'obsidian';
import type { BlockController } from '../types';

export class WordCountBlock extends MarkdownRenderChild {
	private readonly controller: BlockController;

	constructor(containerEl: HTMLElement, controller: BlockController) {
		super(containerEl);
		this.controller = controller;
	}

	onload(): void {
		this.controller.open(this.containerEl);
	}

	onunload(): void {
		this.controller.close();
	}
}