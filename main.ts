import { Plugin } from 'obsidian';
import { startRuntime } from './src/runtime';
import type { Runtime } from './src/types';

/** The plugin entry point. It starts the runtime on load and stops it on unload. */
export default class WordCensusPlugin extends Plugin {
	/** The running plugin, or `null` when not loaded. */
	private runtime: Runtime | null = null;

	/** Starts the runtime. */
	async onload(): Promise<void> {
		this.runtime = await startRuntime(this);
	}

	/** Stops the runtime, which saves the timer and settings. */
	onunload(): void {
		void this.runtime?.stop();
		this.runtime = null;
	}
}