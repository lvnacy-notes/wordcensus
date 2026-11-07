/**
 * Exported types and interfaces shared across the plugin's modules.
 */

export type RegionResult =
	| { mode: 'note'; text: string }
	| { mode: 'sentinel'; text: string; pairs: number }
	| { mode: 'heading'; text: string; heading: string; found: boolean };

export type TimerMode = 'stopwatch' | 'countdown' | 'session';

/** Shows a `wordcount` code block's count in a host element and keeps it current. */
export interface BlockController {
	/** Releases the note subscription and removes the count. Safe to call when not open. */
	close(): void;
	/** Renders the count into `host`, replacing any count already open. */
	open(host: HTMLElement): void;
}

/** What a block controller needs from the rest of the plugin. */
export interface BlockControllerDeps {
	options: BlockOptions;
	/** The text of the note the block sits in, or null when it cannot be read. */
	readText(): Promise<NoteText | null>;
	store: Store;
	/** Calls `handler` whenever the note, its text or a setting changes. Returns the stop function. */
	watchNotes(handler: () => void): () => void;
}

/** The parameters in a `wordcount` code block's body. */
export interface BlockOptions {
	/** The heading this block counts under, or null to count the note's own region. */
	heading: string | null;
}

/** An analog clock face that can be redrawn. */
export interface ClockFace {
	update(model: ClockModel): void;
}

/** What the clock face draws. */
export interface ClockModel {
	/** Milliseconds shown by the hands: elapsed time, or time remaining for a countdown. */
	ms: number;
	/** Fraction of a countdown still remaining, from 0 to 1, or null for modes without a wedge. */
	wedge: number | null;
}

export interface CountdownRun extends Run {
	durationMs: number;
}

export interface CountOptions {
	/** Count the contents of fenced code blocks. */
	includeCodeBlocks: boolean;
	/** Count footnote definitions (and inline footnotes). */
	includeFootnotes: boolean;
	/**
	 * Count the text of embeds (`![[...]]` and `![alt](url)`). This only
	 * counts the embed's own text (target or alias, or alt text); it does
	 * not resolve and count the embedded note's contents.
	 */
	includeEmbeds: boolean;
}

/** A function whose calls are delayed and merged into one, and that can be cancelled. */
export interface Debounced {
	(): void;
	cancel(): void;
}

/** One label and value shown below the clock. */
export interface DataRow {
	label: string;
	value: string;
}

export interface DriverEnvironment {
	notify(message: string): void;
	now(this: void): number;
	/** Calls `handler` each time the app goes to the background. */
	onBackground(handler: () => void): void;
	/** Calls `handler` each time the app returns to the foreground. */
	onForeground(handler: () => void): void;
	/** Calls `handler` every `intervalMs` until the returned function is called. */
	schedule(handler: () => void, intervalMs: number): () => void;
}

/** Hand rotations in degrees clockwise from twelve o'clock. */
export interface HandAngles {
	hour: number;
	minute: number;
	second: number;
}

export interface HeadingRegion {
	/** The heading exactly as written in the note, without its `#` markers. */
	heading: string;
	text: string;
}

/** The result of counting one note's region. */
export interface NoteCount {
	/** The heading counted under, or null outside heading mode. */
	heading: string | null;
	/** False when a configured heading matched nothing. Always true outside heading mode. */
	headingFound: boolean;
	/** Which rule produced the region. */
	mode: 'heading' | 'note' | 'sentinel';
	/** Number of start and end marker pairs, or zero outside sentinel mode. */
	pairs: number;
	words: number;
}

/** A note, with the count of its region. */
export interface NoteInfo {
	count: NoteCount;
	path: string;
	title: string;
}

/** A note's text, with what is needed to count it. */
export interface NoteText {
	/** The note's own `word-count-heading` property, or null. */
	headingOverride: string | null;
	path: string;
	text: string;
	title: string;
}

/**
 * One shared watcher over the vault, so the panel, the status bar and every
 * `wordcount` block listen through a single set of Obsidian listeners.
 */
export interface NoteWatcher {
	/** Stops listening to Obsidian and drops every subscriber. */
	dispose(): void;
	/** Calls `handler` with the path of a note or folder just deleted. Returns the stop function. */
	onDelete(handler: (path: string) => void): () => void;
	/** Calls `handler` with the old and new path of a note or folder just moved or renamed. Returns the stop function. */
	onMove(handler: (oldPath: string, newPath: string) => void): () => void;
	/**
	 * Calls `handler` when the active note changes, while a note is being
	 * edited (debounced), when a setting changes, when anything is moved or
	 * deleted and, as `options` allows, when a note's properties change.
	 * Returns the stop function.
	 */
	watch(handler: () => void, options?: WatchOptions): () => void;
}

/** A rendered sidebar panel. */
export interface Panel {
	/** Removes the panel from the page. */
	destroy(): void;
	update(model: PanelModel): void;
}

/** The callbacks a panel invokes when the user acts. */
export interface PanelActions {
	onDuration(minutes: number): void;
	onMode(mode: TimerMode): void;
	onReset(): void;
	onToggle(): void;
}

/** Opens and closes the sidebar panel's content in a host element. */
export interface PanelController {
	/** Releases every subscription and removes the panel. Safe to call when not open. */
	close(): void;
	/** Renders the panel into `host`, replacing any panel already open. */
	open(host: HTMLElement): void;
}

/** What a panel controller needs from the rest of the plugin. */
export interface PanelControllerDeps {
	driver: TimerDriver;
	now(): number;
	/** Counts a note's region: the note at `path`, or the active note when omitted. Null when there is none. */
	readNote(path?: string): Promise<NoteInfo | null>;
	store: Store;
	/** Calls `handler` whenever the active note, its text or a setting changes. Returns the stop function. */
	watchNotes(handler: () => void): () => void;
}

/** The inputs that determine a panel model. */
export interface PanelInput {
	active: NoteInfo | null;
	/** The note the session is bound to, with its current count, or null when unbound. */
	bound: NoteInfo | null;
	now: number;
	timer: TimerState;
}

/** Everything the panel shows, ready to render. */
export interface PanelModel {
	clock: ClockModel;
	/** The countdown length in whole minutes, or null when the countdown is not the selected mode. */
	durationMinutes: number | null;
	durationEditable: boolean;
	mode: TimerMode;
	/** True when the selected run is running. */
	running: boolean;
	/** True when the selected mode is a countdown that has run out and awaits reset. */
	startDisabled: boolean;
	rows: DataRow[];
	summary: PanelSummary;
}

export interface PanelSummary {
	detail: string;
	headline: string;
}

/** Where saved data lives. In the plugin this is `loadData` and `saveData`. */
export interface Persistence {
	load(): Promise<unknown>;
	save(data: unknown): Promise<void>;
}

export interface RegionConfig {
	/** The configured heading to count under, if any. Blank means none. */
	heading?: string | null;
}

/** The time-keeping core shared by every mode. */
export interface Run {
	/** Milliseconds accumulated before the current stretch began. */
	accumulatedMs: number;
	/** When the current stretch began, or null when paused or idle. */
	startedAt: number | null;
}

/** The running plugin, as `main.ts` sees it. */
export interface Runtime {
	/** Stops the timer and saves state. Everything registered with Obsidian is released by Obsidian itself. */
	stop(): Promise<void>;
}

/** What gets written to `data.json`. */
export interface SavedData extends WordCensusSettings {
	/** Present only when `keepTimerState` is on. */
	timer?: TimerState;
}

/** The note a session measures its words against. */
export interface SessionBinding {
	path: string;
	/** The note's region word count when the session started. */
	baselineWords: number;
}

/** What a session reported when its note was deleted and it ended. */
export interface SessionResult {
	/** The note the session was bound to. */
	path: string;
	/** Words per minute at the end, or null when the last count was unknown. */
	wordsPerMinute: number | null;
	/** Net words at the end, or null when the last count was unknown. */
	wordsWritten: number | null;
}

export interface SessionRun extends Run {
	binding: SessionBinding | null;
	/** Set when the session ended because its note was deleted. Cleared by reset. */
	result: SessionResult | null;
}

export interface SessionStats {
	elapsedMs: number;
	/** Net words since the session started (negative if text was removed), or null for an unbound session. */
	wordsWritten: number | null;
	/** Words per minute of running time, or null for an unbound session. */
	wordsPerMinute: number | null;
}

/** The text and tooltip the status bar item shows. */
export interface StatusBarContent {
	text: string;
	tooltip: string;
}

/** The status bar controller's lifetime. */
export interface StatusBarController {
	/** Shows the active note's count and keeps it current. Starting again restarts it. */
	start(): void;
	/** Stops watching and hides the item. Safe to call when not started. */
	stop(): void;
}

/** What a status bar controller needs from the rest of the plugin. */
export interface StatusBarControllerDeps {
	display: StatusBarDisplay;
	/** The active note and its count, or null when no Markdown note is open. */
	readNote(): Promise<NoteInfo | null>;
	store: Store;
	/** Calls `handler` whenever the note, its text or a setting changes. Returns the stop function. */
	watchNotes(handler: () => void): () => void;
}

/** The status bar item, reduced to what the controller does with it. */
export interface StatusBarDisplay {
	hide(): void;
	show(text: string, tooltip: string): void;
}

export interface Store {
	readonly settings: WordCensusSettings;
	readonly timer: TimerState;
	/** Replaces the current timer state. */
	replaceTimer(timer: TimerState): void;
	/** Reads saved data. Malformed data never throws; it falls back to defaults. */
	load(): Promise<void>;
	/** Writes the current settings, and the timer if the user is keeping it. */
	save(): Promise<void>;
	/** Calls `listener` after every settings change. Returns the unsubscribe function. */
	subscribe(listener: () => void): () => void;
	/** Applies a change to the settings, normalized, then saves. */
	updateSettings(change: Partial<WordCensusSettings>): Promise<void>;
}

export interface TimerDriver {
	/** Checks the timer now and starts watching for the app returning to the foreground. */
	begin(): void;
	/** Stops ticking and drops every subscriber. */
	end(): void;
	/**
	 * Ends the session if its note is at `path` or inside that folder, because
	 * it was deleted: pauses it, unbinds it and keeps its final figures.
	 * `currentWords` is the note's last known count, or null if there is none.
	 */
	endSession(path: string, currentWords: number | null): void;
	pause(): void;
	/** Follows the session's note when it, or a folder holding it, is moved or renamed. */
	rebind(oldPath: string, newPath: string): void;
	reset(): void;
	selectMode(mode: TimerMode): void;
	setCountdownDuration(durationMs: number): void;
	start(binding?: SessionBinding): void;
	/** Calls `listener` after every tick and every state change. Returns the unsubscribe function. */
	subscribe(this: void, listener: () => void): () => void;
}

export interface TimerState {
	mode: TimerMode;
	stopwatch: Run;
	countdown: CountdownRun;
	session: SessionRun;
}

/** Which notes' property changes a watcher cares about. */
export interface WatchOptions {
	/** Also tell the watcher when the active note's properties change. */
	active?: boolean;
	/** Also tell the watcher when these notes' properties change. Read again for every event. */
	paths?: () => readonly string[];
}

/** The Obsidian events a note watcher listens to. Each returns the function that stops listening. */
export interface WatcherSources {
	/** The path of the active note, or null when none is open. */
	activePath(): string | null;
	debounce(handler: () => void, delayMs: number): Debounced;
	/** The active note changed. */
	onActive(handler: () => void): () => void;
	/** A note or folder was deleted. */
	onDelete(handler: (path: string) => void): () => void;
	/** Text was edited. Fires on every keystroke. */
	onEdit(handler: () => void): () => void;
	/** The properties of the note at the given path changed. Fires for any note in the vault. */
	onMetadata(handler: (path: string) => void): () => void;
	/** A note or folder was moved or renamed. */
	onMove(handler: (oldPath: string, newPath: string) => void): () => void;
	/** A setting changed. */
	onSettings(handler: () => void): () => void;
}

export interface WordCensusSettings extends CountOptions {
	/** Length of a new countdown, in minutes. */
	defaultCountdownMinutes: number;
	/** Count under this heading when a note has no sentinels. Blank means none. */
	heading: string;
	/** Keep the timer's state across restarts. */
	keepTimerState: boolean;
	/** Show the word count in the status bar. Desktop only. */
	showStatusBar: boolean;
}

/** The slice of `Intl.Segmenter` that this module needs. */
export interface WordSegmenter {
	segment(input: string): Iterable<{ isWordLike?: boolean }>;
}