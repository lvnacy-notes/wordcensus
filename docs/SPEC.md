# Word Census: Specification

| Field | Value |
|-------|-------|
| Name | Word Census |
| Manifest `id` | `wordcensus` |
| Author | LVNACY |
| `isDesktopOnly` | `false` |
| `minAppVersion` | `1.13.0` |

## 1. Overview

Word Census is an Obsidian plugin that counts words only inside a defined region of a note. A region is defined by sentinel comments or by a heading. The count is shown in three places: a sidebar panel with a three-mode timer, an inline code-block processor that can sit anywhere in a note, and, on desktop, the status bar.

## 2. Constraints

- Every feature works on mobile. The status bar is desktop only.
- No Node APIs in plugin runtime code.
- `main.ts` holds `onload` and `onunload` and nothing else. Commands, sidebar, processor, status bar and settings tab each live in their own module and are registered from `runtime.ts`. State and persistence live in the pure `store.ts`.
- Every settings edit goes through the store, which runs `normalizeSettings`.
- The settings tab uses the declarative settings API (`getSettingDefinitions`) and has no `display()`.
- Bundler: esbuild. Test runner: Vitest.
- Exported types and interfaces live in `src/types.ts`. Test-only ones live in `src/test/test-types.ts`.

## 3. Regions

### 3.1 Sentinel mode

Words are counted between two HTML-comment sentinels:

```markdown
<!-- word count start -->

Words here get counted. Nothing else gets counted.

<!-- word count end -->
```

- A note with several pairs has its counts summed.
- A start with no end counts to the end of the file.
- An end with no start is ignored.
- Nested or duplicate starts are ignored. A duplicate stays in the region text and is dropped by the counter like any other comment.
- A pair with nothing between the markers is still a sentinel region. The note counts as zero words and does not fall back to the whole note.
- Markers are matched case-insensitively and tolerate extra whitespace (`<!--word count start-->` works).
- Markers inside fenced code, inline code or frontmatter are ignored.

### 3.2 Heading mode

Words are counted under a selected heading, until the next heading of the same or a higher level (`##` ends at the next `##` or `#`). Subheadings are included. The heading line itself is not counted.

```markdown
## some other header

## this header is selected for word count

Words here are counted

### this is still under the selected header

So words here are counted as well

## the word count ends above this header
```

**Matching**
- Case-insensitive, with runs of whitespace collapsed.
- When two headings have identical text, the first match wins.
- The region runs from the end of the heading line to the next heading of the same or a higher level, or to the end of the note.
- Subheading titles inside the region count as ordinary text.

**Recognition**
- Only ATX headings (`#` to `######`, up to three spaces of indent) are recognised. Setext headings are not.
- A closing sequence is ignored (`## Title ##` is `Title`). A hash that is part of the title is kept (`## C#`).
- `#tag` is not a heading.
- Headings inside fenced code, HTML or `%%` comments and frontmatter are ignored.

**Heading not found.** A configured heading that does not exist yields a zero count flagged "not found", and the UI says so. It does not fall back to the whole note.

### 3.3 Precedence

1. If the note contains sentinels, use sentinel mode.
2. Otherwise, if a heading is configured, use heading mode.
3. Otherwise, count the whole note.

An inline `wordcount` block with a `heading:` override skips this order and always uses heading mode for that block.

### 3.4 Choosing the heading

Two mechanisms that can coexist:

- **Global setting:** count under the heading named X.
- **Per-note frontmatter:** `word-count-heading: "Chapter 3"`. It takes the place of the global setting for that note.

### 3.5 Module contract (`region.ts`)

`extractRegion(text, { heading })` returns one of:

- `{ mode: 'note' }`
- `{ mode: 'sentinel', pairs }`
- `{ mode: 'heading', heading, found }`

Each carries the `text` to hand to `countWords`. Sentinel and heading text always begins with a newline, so a region whose first line is `---` is never taken for frontmatter. `extractSentinelRegions` and `extractHeadingRegion` are also exported.

## 4. What counts as a word

**Always excluded**
- Frontmatter, only at the very start of the text being counted.
- HTML comments, including the sentinels, and Obsidian `%% ... %%` comments.
- Markdown syntax: heading, list, blockquote and callout markers, task checkboxes, table pipes, block ids (`^abc123`), footnote references (`[^1]`), HTML tags.
- Link URLs: Markdown links, wikilinks, reference-style links, autolinks and bare URLs. The display text is counted. For a wikilink, the alias is counted if present, otherwise the target.
- The plugin's own `wordcount` code blocks, even when code blocks are included.

**Toggleable** (`CountOptions`)
- `includeCodeBlocks` (default off): fenced code blocks. Inline code is always counted.
- `includeFootnotes` (default on): footnote definitions, including indented continuation lines, and inline `^[...]` footnotes. The `[^id]:` marker is never counted.
- `includeEmbeds` (default off): the text of an embed (`![[...]]` target or alias, or `![alt](url)` alt text). The embedded note's contents are not counted.

**Tokenization.** A word is a run of non-whitespace containing at least one letter or number. `well-known` and `don't` are one word each. Chunks in scripts that do not separate words with spaces (Han, Hiragana, Katakana, Thai, Lao, Khmer, Myanmar) are passed to `Intl.Segmenter` with `granularity: "word"`. Hangul is counted by whitespace. Where `Intl.Segmenter` is missing, those scripts count one word per character. The `lib` setting includes `ES2022.Intl`.

**Known limits**
- Indented (four-space) code blocks are not recognised. Only fenced blocks are.
- A multi-line HTML comment that contains a code-fence line is not handled.
- Math (`$...$`) is counted as ordinary text.

## 5. User interface

### 5.1 Sidebar panel

A custom `ItemView` in the right sidebar. Top to bottom:

1. **Region summary:** the region count, the mode that matched (sentinel, heading or whole note) and the heading name if there is one.
2. **Mode selector:** one pill with three buttons: Stopwatch, Countdown, Session.
3. **Analog clock face:** an SVG clock that scales to the panel width.
4. **Mode data:** see the table below.
5. **Controls:** start/pause and reset.

The panel updates when the active note changes (debounced on `editor-change`) and refreshes on `active-leaf-change` and file open. Touch targets are at least 44px.

| Mode | Clock face | Data below the clock |
|------|-----------|----------------------|
| Stopwatch | Hands show elapsed time | Elapsed time as a digital readout |
| Countdown | Hands show time remaining, with a shrinking wedge showing progress | Time remaining and the set duration, editable while stopped |
| Session | Hands show elapsed time | Words written since the session started, words per minute, the current region count, and the bound note |

### 5.2 Timer

**Timing**
- Elapsed time is computed from timestamps, never by counting interval ticks.
- The timer takes an injectable time source.
- Timer state lives at plugin level. Switching notes does not reset it.
- A system clock change never makes a run shorter.

**Runs.** Stopwatch, countdown and session each keep their own time. Switching the selected mode never stops or resets anything. Start, pause and reset act on the selected mode only.

**Words per minute.** Uses running time only. It is based on net words (words now minus words at the start) and is never negative. A session that removed more than it wrote shows a negative word count and a rate of zero. The rate is zero before any time has passed.

**Countdown**
- Stops exactly on its duration and flags itself finished. A late check, such as the app returning from the background, still lands on the duration.
- A finished countdown ignores Start until it is reset.
- The store checks on every tick and on return to the foreground, and raises a notice when a countdown newly finishes.
- The duration is editable only while the countdown is not running. Changing it restarts the countdown from the new value.
- The duration is clamped to between 1 second and 24 hours. The default is 25 minutes.

**Session binding**
- A session binds to the note open when it first starts and keeps that note on resume. Words written are measured against that note's region and keep tracking it while the user browses elsewhere.
- If no note is open when a session starts, it still times and shows no word statistics.
- While the bound note's count cannot be read, words written and words per minute show "—". Elapsed time keeps running and the Note row shows the file name from the binding.
- When the note, or a folder holding it, is moved or renamed, the binding follows and the statistics carry on.
- When the note, or a folder holding it, is deleted, the session is paused and unbound and keeps its final figures. The Note row reads "name (deleted)". The words figures are the last count the panel or status bar saw, or "—" if neither had shown that note. The figures stay until the session is reset. Start does nothing until then. A running stopwatch or countdown is not affected. A notice tells the user.

**Persistence.** The setting "Keep timer between sessions" decides whether the timer survives a restart.
- Off: the timer resets when the app restarts, and any saved timer is dropped on the next save.
- On: the timer is saved to plugin data and restored on startup. Every run comes back paused, any stored start time is discarded, and malformed or unknown saved data is replaced with safe defaults. Time the app spent closed is never counted.
- The saved copy has everything running paused, with its time folded in.
- The timer is also saved when the app goes to the background.

**Display.** `m:ss`, or `h:mm:ss` from one hour. Countdowns round up, so `0:00` only appears once finished.

### 5.3 Inline code-block processor

A fenced code block with the language `wordcount` renders the count in place:

````markdown
```wordcount
```
````

- It works anywhere in a note, in Reading view and Live Preview. In Live Preview the rendered result shows while the cursor is outside the block.
- A block without `heading:` counts the note's own region exactly as the sidebar panel does, including the note's `word-count-heading` property.
- The `heading:` line in the block body sets what that block counts:

  ````markdown
  ```wordcount
  heading: Chapter 3
  ```
  ````

  A block with `heading:` counts under that heading in every case, even when the note has sentinels. Matching follows 3.2. If the heading is not found, the block shows a "heading not found" message.
- The `heading:` key is case-insensitive. Its value is trimmed and may be wrapped in quotes. The first `heading:` line with a value wins. Every other line in the body is ignored.
- The block shows the count and a detail line, for example `Under “Chapter 3”`. If the note cannot be read it shows "Word count unavailable".
- The block refreshes through a `MarkdownRenderChild` when the note is edited (debounced), when its properties change and when the active note changes. When the note is open in an editor the block reads the live editor text. Otherwise it reads the cached file.

### 5.4 Status bar (desktop only)

An item such as `142 words (region)`, with a tooltip showing the mode and the matched region. The `(region)` suffix appears when the count covers only part of the note. It is not created on mobile.

### 5.5 Commands

- "Open word count panel": reveals the sidebar view.

### 5.6 Settings

| Setting | Default | Notes |
|:--------|:--------|:------|
| Heading | blank | Used for notes with no sentinels. Blank counts the whole note. Trimmed on save. Edits are debounced by 500 ms |
| Include code blocks | off | Fenced code only |
| Include footnotes | on | Definitions and inline footnotes |
| Include embeds | off | The name or alt text of an embed |
| Default countdown | 25 | Whole minutes, 1 to 1440. The length of a new countdown. It can also be changed in the panel while a countdown is stopped |
| Keep timer across restarts | off | Saves the timer and restores it paused |
| Show status bar item | on | Desktop only |

**Saved data.** Settings are top-level fields in `data.json`. A `timer` field is present only when "keep timer" is on. Everything read back is untrusted: a field of the wrong type falls back to its default, the countdown length is rounded and clamped, unknown fields are dropped, and the plugin always loads.

**The tab** (`SettingsTab.ts`) describes its controls with `getSettingDefinitions`. The counting settings sit unheaded at the top. Timer and Display are groups. The tab overrides `getControlValue` and `setControlValue` to read from and write to the store. Pending debounced edits are applied when the tab closes.

## 6. Code structure

`main.ts` and `styles.css` are at the project root. Everything else is under `src/`. Tests sit next to the code they test.

```
main.ts                  onload and onunload only
styles.css               panel, clock and inline-block styling
manifest.json
versions.json
src/
  guards.ts              type guards shared across modules (isRecord)
  runtime.ts             builds the store and driver, registers every feature with Obsidian
  types.ts               every exported type and interface
  block/
    block-controller.ts  keeps one wordcount block current; owns its note subscription
    block-model.ts       pure: reads the block's heading line, counts the note for a block
  commands/
    open-panel.ts        the "Open word count panel" command
  counting/
    count.ts             pure: region text + options -> word count
    markdown-patterns.ts pure: frontmatter, fence and comment patterns shared by count.ts and region.ts
    note-count.ts        pure: note text + settings (+ per-note heading) -> NoteCount
    region.ts            pure: text + config -> region text
    summary.ts           pure: note count -> headline and detail line for the panel, blocks and status bar
  obsidian/              the Obsidian-facing layer
    note-source.ts       reads notes from the vault
    processor.ts         builds the wordcount code-block callback
    SettingsTab.ts       the settings tab
    status-bar.ts        adds the status bar item and builds its controller
    View.ts              the sidebar ItemView, a shell around the panel controller
    watcher-sources.ts   the Obsidian events behind the shared note watcher
    WordCountBlock.ts    the MarkdownRenderChild for one block, a shell around the block controller
  panel/
    clock-face.ts        hand angles and wedge path (pure), SVG clock face
    panel.ts             renders a PanelModel as DOM and reports user actions
    panel-controller.ts  keeps the open panel current; owns its subscriptions
    panel-model.ts       pure: timer + notes -> everything the panel shows
  settings/
    settings.ts          pure: defaults, normalizeSettings, timer load and save
    store.ts             pure: settings and timer, load, save, updateSettings, subscribe
  status-bar/
    status-bar-controller.ts  keeps the item current; owns its subscriptions
    status-bar-model.ts       pure: count -> item text and tooltip
  timer/
    last-counts.ts       pure: remembers the session note's last count
    timer.ts             pure: timer state machine with injectable clock
    timer-driver.ts      ticks the timer in real time (injected scheduler, clock, foreground and background hooks, notices)
  watcher/
    note-watcher.ts      pure: one shared watcher over injected sources
  test/
    fakes.ts             buildSettings(), the malformed-settings fixture, fakePersistence(), fakeEnvironment()
    region-count.test.ts integration tests
    test-types.ts        types used only by tests
docs/
  Code Style Guide.md
  LVNACY Testing Philosophy.md
  SPEC.md
  TESTING.md
.coverage/
  baseline.json
  check-coverage-ratchet.js
```

Each module has a `.test.ts` beside it.

### 6.1 Shared note watcher

The panel, the status bar and every `wordcount` block watch notes through one `NoteWatcher` (`watcher/note-watcher.ts`).

- It listens to Obsidian only while something is subscribed.
- It merges edits into one debounced notification (500 ms).
- It reports setting changes, so a counting setting refreshes the panel, status bar and blocks.
- A subscriber says which notes' property changes it wants: the active note, listed paths, or all.
- Move and delete handlers run before subscribers are notified.
- Events arrive through `WatcherSources`, which `obsidian/watcher-sources.ts` supplies.

### 6.2 Pure modules

`count.ts`, `region.ts`, `summary.ts`, `timer.ts`, `store.ts`, `panel-model.ts`, `note-count.ts`, `block-model.ts`, `status-bar-model.ts` and `note-watcher.ts` import nothing from Obsidian.

### 6.3 Module layout

Rules are in `Code Style Guide.md`.

- A module with numerous declarations reads top to bottom in banner-headed sections: Interfaces and Types, Declared Variables and Constants, Functions. A small module omits the banners and alphabetizes its functions. Declarations are alphabetical, except where one must follow another it depends on.
- A class file is named for the class in PascalCase, puts the class first, then supporting functions, with methods alphabetized. Every other file is kebab-case.
- A command file puts `buildInvokeCommand` first.
- Test files are not laid out this way.
- Shared helpers have one definition each: the frontmatter, fence and comment patterns in `counting/markdown-patterns.ts`, `isRecord` in `guards.ts`, `buildSummary` in `counting/summary.ts`, `MINUTE_MS` in `timer.ts`.
- Source is grouped by purpose under `src/`: `counting/`, `obsidian/`, `panel/`, `settings/`, `timer/`, `watcher/`, `commands/`.

## 7. Tooling

| File | Contents |
|------|----------|
| `package.json` | pnpm, Node >= 24. Scripts: `dev`, `dev:mobile`, `typecheck`, `typecheck:fast`, `lint`, `test*`, `build`, `version`, and a `test:ratchet` that chains coverage and the Ratchet check |
| `esbuild.config.js` | `dist/` output, ES2020 target, `main.ts` and `styles.css` entry points, `EMULATE_MOBILE` define |
| `eslint.config.js` | Shared and type-aware rule blocks and a Node-tooling override block. `obsidianmd/ui/sentence-case` has `Word Census` as a brand |
| `vitest.config.js` | `obsidian-test-mocks` alias, jsdom, `src/**/*.test.ts` include, coverage config. Documented in `TESTING.md`, "Vitest configuration" |
| `tsconfig.json` | `moduleResolution: bundler`, `isolatedModules`, `ES2022.Intl` in `lib` |
| `.coverage/check-coverage-ratchet.js` | The Ratchet. The baseline moves by hand |
| `version-bump.js` | Bumps `manifest.json` and `versions.json` |

Testing follows `LVNACY Testing Philosophy.md`. Project specifics are in `TESTING.md`: load-bearing behaviors, trust boundaries and known gaps. The timer is built on an injectable clock and fake timers.