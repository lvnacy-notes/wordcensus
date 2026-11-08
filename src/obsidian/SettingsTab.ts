import {
	Notice,
	PluginSettingTab,
	debounce,
	type App,
	type Debouncer,
	type Plugin,
	type SettingDefinitionItem
} from 'obsidian';
import { MAX_COUNTDOWN_MINUTES, MIN_COUNTDOWN_MINUTES } from '../settings/settings';
import type { Store, WordCensusSettings } from '../types';

/** The settings whose edits are debounced before they are saved. */
const DEBOUNCED_KEYS: ReadonlySet<keyof WordCensusSettings> = new Set(['heading']);

/**
 * The plugin's settings tab. Edits to the heading are debounced; every other
 * edit is saved immediately through the store.
 */
export class WordCensusSettingTab extends PluginSettingTab {
	/** Saves a pending settings change after a pause in editing. */
	private readonly debouncedUpdate: Debouncer<[Partial<WordCensusSettings>], void>;
	private readonly store: Store;

	/**
	 * @param app - The Obsidian application instance.
	 * @param plugin - The plugin that owns the tab.
	 * @param store - The settings store the controls read and write.
	 */
	constructor(
		app: App,
		plugin: Plugin,
		store: Store
	) {
		super(app, plugin);
		this.store = store;
		this.debouncedUpdate = debounce(
			(change: Partial<WordCensusSettings>) => {
				void this.updateSettings(change);
			},
			500,
			true
		);
	}

	/**
	 * Reads a setting's current value from the store.
	 *
	 * @param key - The setting to read.
	 * @returns The setting's value.
	 */
	getControlValue(key: keyof WordCensusSettings): WordCensusSettings[keyof WordCensusSettings] {
		return this.store.settings[key];
	}

	/**
	 * Describes the controls shown on the tab.
	 *
	 * @returns The setting definitions, with the timer and display settings grouped.
	 */
	getSettingDefinitions(): SettingDefinitionItem<keyof WordCensusSettings>[] {
		return [
			{
				name: 'Heading',
				desc: 'Count only the words under this heading when a note has no start and end markers. Leave blank to count the whole note.',
				control: {
					type: 'text',
					key: 'heading',
					placeholder: 'Draft'
				}
			},
			{
				name: 'Include code blocks',
				desc: 'Count words inside fenced code blocks.',
				control: { type: 'toggle', key: 'includeCodeBlocks' }
			},
			{
				name: 'Include footnotes',
				desc: 'Count the text of footnote definitions.',
				control: { type: 'toggle', key: 'includeFootnotes' }
			},
			{
				name: 'Include embeds',
				desc: 'Count the embed links themselves as words.',
				control: { type: 'toggle', key: 'includeEmbeds' }
			},
			{
				type: 'group',
				heading: 'Timer',
				items: [
					{
						name: 'Default countdown',
						desc: 'Minutes the countdown starts from.',
						control: {
							type: 'number',
							key: 'defaultCountdownMinutes',
							min: MIN_COUNTDOWN_MINUTES,
							max: MAX_COUNTDOWN_MINUTES,
							step: 1
						}
					},
					{
						name: 'Keep timer across restarts',
						desc: 'Save the timer and bring it back, paused, when Obsidian reopens.',
						control: { type: 'toggle', key: 'keepTimerState' }
					}
				]
			},
			{
				type: 'group',
				heading: 'Display',
				items: [
					{
						name: 'Show status bar item',
						desc: 'Show the word count in the status bar. Desktop only.',
						control: { type: 'toggle', key: 'showStatusBar' }
					}
				]
			}
		];
	}

	/** Applies any pending debounced edit, then closes the tab. */
	hide(): void {
		this.debouncedUpdate.run();
		super.hide();
	}

	/**
	 * Writes a value through the store, which normalizes it and saves. Edits to
	 * debounced settings are deferred.
	 *
	 * @param key - The setting to change.
	 * @param value - The new value.
	 * @returns A promise for the save, or nothing when the edit is debounced.
	 */
	setControlValue(key: keyof WordCensusSettings, value: boolean | number | string): void | Promise<void> {
		const change = { [key]: value } as Partial<WordCensusSettings>;
		if (DEBOUNCED_KEYS.has(key)) {
			this.debouncedUpdate(change);
			return;
		}
		return this.updateSettings(change);
	}

	/**
	 * Saves a settings change through the store. A failure is logged and
	 * reported in a notice.
	 *
	 * @param change - The settings to change.
	 */
	private async updateSettings(change: Partial<WordCensusSettings>): Promise<void> {
		try {
			await this.store.updateSettings(change);
		} catch (error) {
			console.error('Word Census: failed to save settings', error);
			new Notice('Word Census: failed to save your settings. Please try again.');
		}
	}
}