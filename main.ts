import { Plugin } from 'obsidian';
import { startRuntime } from './src/runtime';
import type { Runtime } from './src/types';

export default class WordCensusPlugin extends Plugin {
	private runtime: Runtime | null = null;

	async onload(): Promise<void> {
		this.runtime = await startRuntime(this);
	}

	onunload(): void {
		void this.runtime?.stop();
		this.runtime = null;
	}
}