# Word Census: Specification

**Status:** Draft 0.4 (all design questions resolved; ready to scaffold)

| Field | Value |
|-------|-------|
| Name | Word Census |
| Manifest `id` | `wordcensus` (permanent once published) |
| Author | LVNACY |
| `isDesktopOnly` | `false` |

## 1. Overview

Word Census is an Obsidian plugin that counts words only inside a defined region of a note. A region is defined in one of two ways: by sentinel comments or by a heading. The count is surfaced in three places: a sidebar panel (with a three-mode timer), an inline code-block processor that can sit anywhere in a note, and, on desktop, the status bar.

**Design principle: mobile-first.** Every feature must work on mobile. Desktop-only conveniences (the status bar) are additions, never the only way to see a result. The manifest sets `isDesktopOnly: false`, and no Node.js APIs are used in plugin runtime code.

## 2. Decisions Log

| # | Question | Decision |
|---|----------|----------|
| 1 | Multiple sentinel pairs | Sum them |
| 2 | Is the heading line counted? | No |
| 3 | Inline display | A code-block processor, placeable anywhere in a note |
| 4 | Platform | Mobile-first, always. Sidebar panel replaces reliance on the status bar |
| 5 | Bundler | esbuild. A hard rule for Obsidian plugins: Vite and other bundlers have been tried and do not replace it |
| 6 | Test runner | Vitest, using the existing config |
| 7 | Duplicate headings / case | First match wins; matching is case-insensitive |
| 8 | Timer modes | All three: stopwatch, countdown, writing session |
| 9 | Timer persistence | An option (setting), not a fixed behavior |
| 10 | Tooling carry-over | Ratchet script and `version-bump.js` both carried over |
| 11 | Inline block parameters | A `heading:` override only |
| 12 | Timer restore and session binding | A restored timer comes back paused; a session binds to the note it started in |
| 13 | Name | Word Census, id `wordcensus` |
| 14 | Testing | Governed by [LVNACY Testing Philosophy](<LVNACY Testing Philosophy.md>): lean suite, coverage is not a target, the Ratchet only prevents backsliding. Project specifics (load-bearing behaviors, trust boundaries, known gaps) live in [TESTING.md](TESTING.md) |
| 15 | Session words per minute | Excludes paused time: the rate uses running time only |
| 16 | Countdown at zero | The clock stops at zero and flags itself finished; it never runs into negative time |
| 17 | Settings | Global heading, three counting toggles, keep timer between sessions (off by default), status bar item on desktop (on by default), and a default countdown length (25 minutes). Every edit goes through the store, which runs `normalizeSettings` |
| 18 | `main.ts` is lifecycle only | `main.ts` holds `onload` and `onunload` and nothing else. Commands, sidebar, processor, status bar and the settings tab each live in their own module and are registered from `runtime.ts`; state and persistence live in the pure `store.ts` |
| 19 | Declarative settings API | The settings tab implements `getSettingDefinitions` and has no `display()`. This sets `minAppVersion` to 1.13.0. Values route through the store via `getControlValue` and `setControlValue`, keeping normalization in one place |
| 20 | Where types live | Exported types and interfaces live in `src/types.ts`, and test-only ones in `src/test/test-types.ts`, so each can be found in one place. A module keeps only the types it does not export |
| 21 | Panel structure | The panel is split so its logic is testable without Obsidian: `panel-model.ts` (what to show), `panel.ts` (DOM), `panel-controller.ts` (subscriptions and actions). `View.ts` and `note-source.ts` are the thin Obsidian-facing layer |
| 22 | Layout and naming | Source is grouped by purpose under `src/` (`counting/`, `obsidian/`, `panel/`, `settings/`, `timer/`, `watcher/`, `commands/`). A file that exports a class is named for the class in PascalCase (`SettingsTab.ts`, `View.ts`); every other file is kebab-case |
| 23 | Saving a running timer | Besides every user action, the timer is saved when the app goes to the background, so time a running timer has accumulated since the last action survives the app being closed |
| 24 | Shared helpers | Each helper has one definition. The frontmatter, fence and comment patterns that the counter and the region extractor both use live in `counting/markdown-patterns.ts`; `isRecord` lives in `guards.ts`; `buildSummary`, which the panel, the inline block and the status bar all use, lives in `counting/summary.ts`; and `MINUTE_MS` is exported from `timer.ts` |
| 25 | One shared note watcher | The panel, the status bar and every `wordcount` block watch notes through one `NoteWatcher` (`watcher/note-watcher.ts`), so Obsidian is listened to once however many are open. The watcher listens only while something is subscribed, merges edits into one debounced notification, and also reports setting changes, so a counting setting refreshes the panel and blocks as well as the status bar. A watcher says which notes' property changes it cares about (the active note, listed paths, or all), so a change to a note nobody is showing wakes nobody. The pure watcher takes its events through `WatcherSources`; `obsidian/watcher-sources.ts` supplies the real ones |
| 26 | A session follows its note | When the session's note, or a folder holding it, is moved or renamed, the session's binding follows it and its statistics carry on unbroken |
| 27 | A deleted note ends its session | When the session's note, or a folder holding it, is deleted, the session is paused and unbound, and its final figures are saved with it (`session.result`): elapsed time stays on its clock, and words written and words per minute are the last count the panel or status bar saw, or none if it never saw one. The panel keeps showing these until the session is reset, and Start does nothing until then, as with a finished countdown. The user is told with a notice |

## 3. Region Modes

### 3.1 Sentinel mode

Words are counted between two HTML-comment sentinels:

```markdown
<!-- word count start -->

Words here get counted. Nothing else gets counted.

<!-- word count end -->
```

**Behavior**
- Counts words between `<!-- word count start -->` and `<!-- word count end -->`.
- If a note contains several pairs, the counts are summed.

**Edge cases**
- A start with no end counts to the end of the file.
- An end with no start is ignored.
- Nested or duplicate starts are ignored (the duplicate stays in the region text and is dropped by the counter like any other comment).
- A pair with nothing between the markers is still a sentinel region, so the note counts as zero words rather than falling back to the whole note.

**Recognition**
- Markers are matched case-insensitively and tolerate extra whitespace (`<!--word count start-->` works).
- Markers inside fenced code, inline code or frontmatter are ignored, so a note that documents this plugin can show example markers safely.

### 3.2 Heading mode

Words are counted under a selected heading, until the next heading of the same or higher level (`##` ends at the next `##` or `#`). Subheadings are included. The heading line itself is not counted.

```markdown
## some header

## some other header

## this header is selected for word count

Words here are counted

### this is still under the selected header

So words here are counted as well

## the word count ends above this header
```

**Matching rules**
- Matching is case-insensitive, with runs of whitespace collapsed.
- If two headings have identical text, the first match wins.
- The region runs from the end of the heading line to the next heading of the same or a higher level, or to the end of the note.
- Subheading titles inside the region are counted as ordinary text; only the selected heading line itself is excluded.

**Recognition**
- Only ATX headings (`#` to `######`, up to three spaces of indent) are recognised. Setext headings (underlined with `===` or `---`) are not.
- A closing sequence is ignored (`## Title ##` is `Title`); a hash that is part of the title is kept (`## C#`).
- `#tag` is not a heading. Headings inside fenced code, HTML or `%%` comments and frontmatter are ignored.

**Heading not found:** a configured heading that does not exist yields a zero count flagged as "not found", and the UI says so. It does not fall back to counting the whole note, which would show a misleading number.

### 3.3 Precedence

Sentinels are explicit and per-note, so they take precedence:

1. If the note contains sentinels, use sentinel mode.
2. Otherwise, if a heading is configured, use heading mode.
3. Otherwise, count the whole note.

An inline `wordcount` block with a `heading:` override skips this order and always uses heading mode for that block.

**Module contract (`region.ts`):** `extractRegion(text, { heading })` returns one of `{ mode: 'note' }`, `{ mode: 'sentinel', pairs }` or `{ mode: 'heading', heading, found }`, each with the `text` to hand to `countWords`. Sentinel and heading text always begins with a newline, so a region whose first line is `---` is never mistaken for frontmatter. `extractSentinelRegions` and `extractHeadingRegion` are also exported for the inline processor.

## 4. Choosing the Heading

Two mechanisms, which can coexist:

- **Global setting:** "count under the heading named X" (useful for a convention such as `## Draft`).
- **Per-note frontmatter override:** e.g. `word-count-heading: "Chapter 3"`.

## 5. What Counts as a Word

Configurable, with defaults.

**Always excluded**
- Frontmatter (only at the very start of the text being counted)
- HTML comments (including the sentinels) and Obsidian `%% ... %%` comments
- Markdown syntax: heading, list, blockquote and callout markers, task checkboxes, table pipes, block ids (`^abc123`), footnote references (`[^1]`), HTML tags
- Link URLs: Markdown links, wikilinks, reference-style links, autolinks and bare URLs (the display text is counted; for a wikilink, the alias if present, otherwise the target)
- The plugin's own `wordcount` code blocks, so an inline block never counts itself, even when code blocks are included

**Toggleable** (`CountOptions`)
- `includeCodeBlocks` (default: off): fenced code blocks. Inline code is always counted.
- `includeFootnotes` (default: on): footnote definitions, including indented continuation lines, and inline `^[...]` footnotes. The `[^id]:` marker itself is never counted.
- `includeEmbeds` (default: off): the text of an embed (`![[...]]` target or alias, or `![alt](url)` alt text). This does not resolve the embedded note and count its contents; that needs the vault and is out of scope for the pure counter.

**Tokenization:** a word is a run of non-whitespace containing at least one letter or number, matching word-processor conventions: `well-known` and `don't` are one word each. Chunks written in scripts that do not separate words with spaces (Han, Hiragana, Katakana, Thai, Lao, Khmer, Myanmar) are passed to `Intl.Segmenter` (`granularity: "word"`), because boundaries there can only be found with a dictionary. Hangul is space-delimited, so it is counted by whitespace. Where `Intl.Segmenter` is missing (older mobile WebViews), those scripts fall back to one word per character. Because the target is ES2020, the `lib` setting includes `ES2022.Intl` for types.

**Known limits**
- Indented (four-space) code blocks are not recognised; only fenced blocks are.
- A multi-line HTML comment that itself contains a code-fence line is not handled.
- Math (`$...$`) is counted as ordinary text.

## 6. User Interface

### 6.1 Sidebar panel (primary surface)

A custom `ItemView` registered in the right sidebar. It works on mobile, where the right drawer holds it, and on desktop.

Top to bottom, the panel contains:

1. **Region summary:** the region count, which mode matched (sentinel, heading, or whole note), and the heading name if applicable.
2. **Mode selector:** a single pill divided into three buttons (Stopwatch, Countdown, Session).
3. **Analog clock face:** an SVG clock that scales to the panel width.
4. **Mode data:** whatever is relevant to the selected mode (below).
5. **Controls:** start/pause and reset.

The panel updates live as the active note changes: debounced on `editor-change`, and refreshed on `active-leaf-change` and file open. A command ("Open word count panel") reveals the view, so it is reachable from the mobile command palette. Touch targets are at least 44px.

#### Timer modes

| Mode | Clock face | Data shown below the clock |
|------|-----------|----------------------------|
| Stopwatch | Hands show elapsed time | Elapsed time as a digital readout |
| Countdown | Hands show time remaining, with a shrinking wedge showing progress | Time remaining and the set duration (duration is editable when stopped) |
| Session | Hands show elapsed time | Words written since the session started (delta), words per minute, and the current region count |

**Timing rules**
- Elapsed time is computed from timestamps, never by counting interval ticks, because mobile WebViews throttle timers in the background.
- The timer logic takes an injectable time source so tests can drive it with fake timers rather than racing a real clock.
- Timer state lives at plugin level, not per note, so switching notes does not reset it.

**Persistence (setting):** "Keep timer state across restarts."
- Off: the timer resets when the app restarts.
- On: state is saved to plugin data and restored on startup. A timer that was running comes back paused, so time the app was closed is not silently counted.

**Session mode and notes:** a session binds to the note it started in. Words written are measured against that note's region and keep tracking it while you browse elsewhere. The panel shows which note the session is bound to.

**Timer rules (as built in `timer.ts`)**
- **Three independent runs.** Stopwatch, countdown and session each keep their own time. Switching the selected mode never stops or resets anything, so a running stopwatch keeps running while you look at the session. Start, pause and reset act on the selected mode only.
- **Words per minute** uses running time only, so time spent paused never lowers it. It is based on net words (words now minus words at the start) and is never negative: a session that removed more than it wrote reports a negative word count and a rate of zero. It is zero before any time has passed.
- **Countdown at zero:** it stops exactly on its duration and flags itself finished. A late check, such as the app returning from the background, still lands on the duration and never overshoots. A finished countdown ignores Start until it is reset. The store checks on every tick and on return to the foreground, and raises the notice when a countdown newly finishes.
- **Countdown duration** is editable only while the countdown is not running. Changing it restarts the countdown from the new value. It is clamped to between 1 second and 24 hours, and the default is 25 minutes.
- **Unbound session:** if no note is open when a session starts, it still times, but shows no word statistics. A session binds to its note on first start and keeps that note on resume.
- **Bound note unavailable:** while the bound note's count can't be read (for instance, before it has loaded after a restart), words written and words per minute show "—" rather than measuring against zero words. Elapsed time keeps running, and the Note row shows the file name from the binding.
- **Note moved or renamed:** the binding follows it, so the session's statistics carry on. A folder rename or move does the same for a note inside it.
- **Note deleted:** the session ends: it is paused, unbound, and keeps its final figures, shown in the panel (the Note row reads "name (deleted)") until the session is reset. The words figures are the last count seen by the panel or status bar, so they are "—" if neither had shown that note. Start does nothing until reset. A running stopwatch or countdown is not affected.
- **Saving and restoring:** what gets saved is a frozen copy in which everything running has been paused, with its time folded in. On restore every run comes back paused, any stored start time is discarded, and malformed or unknown saved data is replaced with safe defaults. Time the app spent closed is never counted. The timer is also saved when the app goes to the background, so a running timer's time since the last action is not lost if the app is then closed.
- **Clock moves backwards:** a system clock change never makes a run shorter.
- **Display:** `m:ss`, or `h:mm:ss` from one hour. Countdowns round up so `0:00` only appears once finished.

### 6.2 Inline code-block processor

A fenced code block with the language `wordcount` renders the count in place:

````markdown
```wordcount
```
````

- It can be placed anywhere in a note, in both Reading view and Live Preview. In Live Preview the rendered result shows while the cursor is outside the block.
- By default it shows the count for the note's own region (per the precedence rules in 3.3).
- One optional parameter, `heading:`, in the block body overrides what that block counts, so a single note can show several counts (for example one per chapter):

  ````markdown
  ```wordcount
  heading: Chapter 3
  ```
  ````

  The override uses the same matching rules as 3.2 (case-insensitive, first match wins). If the heading is not found, the block shows a short "heading not found" message rather than a zero.
- It subscribes to updates through a `MarkdownRenderChild`, so it refreshes while the note is open: when the note is edited (debounced), when its properties change, and when the active note changes. When the note is open in an editor the block reads the live editor text, otherwise the cached file.
- A block without `heading:` counts the note's own region exactly as the sidebar panel does, including the note's `word-count-heading` property. A block with `heading:` counts under that heading in every case, even when the note has sentinels.
- The `heading:` key is matched case-insensitively, its value is trimmed and may be wrapped in quotes, and the first `heading:` line with a value wins. Every other line in the body is ignored.
- The block shows the count and a short detail line (for example `Under “Chapter 3”`). If the note cannot be read it shows "Word count unavailable".

### 6.3 Status bar (desktop only)

A status bar item such as `142 words (region)`, with a tooltip showing the mode and matched region. It is skipped on mobile, where it would not be visible.

### 6.4 Commands

- "Open word count panel"

### 6.5 Settings

| Setting | Default | Notes |
|:--------|:--------|:------|
| Heading to count under | blank | Used for notes with no sentinels. Blank means count the whole note. Trimmed on save |
| Count code blocks | off | Fenced code only; inline code is always counted |
| Count footnotes | on | Definitions and inline footnotes |
| Count embeds | off | The name or alt text of an embed, never the embedded note's contents |
| Countdown length | 25 minutes | Whole minutes, 1 to 1440. The length of a new countdown. It can also be changed in the panel while a countdown is stopped |
| Keep timer between sessions | off | When on, the timer is saved and restored paused. When off, any saved timer is dropped on the next save |
| Show in status bar | on | Desktop only. Mobile has no status bar |

**Saved data.** Settings are top-level fields in `data.json`. A `timer` field is present only when "keep timer between sessions" is on. Whatever is read back is treated as untrusted: a field of the wrong type falls back to its default, the countdown length is rounded and clamped, unknown fields are dropped, and the plugin always loads. A new timer starts with the countdown length from settings.

**The tab** (`SettingsTab.ts`) uses Obsidian's declarative settings API (`getSettingDefinitions`, Obsidian 1.13.0 and later), so the settings are described, not built, and appear in Obsidian's settings search. The counting settings sit unheaded at the top; Timer and Display are groups. The tab overrides `getControlValue` and `setControlValue` so values are read from and written to the store instead of `plugin.settings`. Every edit goes through `store.updateSettings`, which runs `normalizeSettings` before anything is stored, so an out-of-range or malformed value can never reach saved data. The heading for a single note (a property in its frontmatter) is not a setting; it is described in section 4.

## 7. Code Structure

Aligned with Tab Candy: `main.ts` and `styles.css` at the project root, everything else under `src/`, tests colocated next to the code.

```
main.ts                  lifecycle ONLY: onload and onunload, nothing else
styles.css               panel, clock and inline-block styling
manifest.json
versions.json
src/
  guards.ts              pure: type guards shared across modules (`isRecord`)
  runtime.ts             the single wiring point: builds the store and driver, registers every feature with Obsidian
  types.ts               every exported type and interface
  block/
    block-controller.ts  keeps one `wordcount` block's count current; owns its note subscription
    block-controller.test.ts
    block-model.ts       pure: reads the block's `heading:` line, counts the note for a block
    block-model.test.ts
  commands/
    open-panel.ts        the "Open word count panel" command
  counting/
    count.ts             pure: region text + options -> word count
    count.test.ts
    markdown-patterns.ts pure: the frontmatter, fence and comment patterns shared by count.ts and region.ts
    note-count.ts        pure: note text + settings (+ per-note heading) -> NoteCount
    note-count.test.ts
    region.ts            pure: text + config -> region text (sentinel/heading logic)
    region.test.ts
    summary.ts           pure: note count -> the headline and detail line the panel, blocks and status bar show
    summary.test.ts
  obsidian/              the Obsidian-facing layer; no logic worth a unit test lives here
    note-source.ts       reads notes from the vault
    processor.ts         builds the `wordcount` code-block callback
    SettingsTab.ts       the settings tab (declarative API), class file
    status-bar.ts        adds the status bar item and builds its controller
    View.ts              the sidebar ItemView, a shell around the panel controller, class file
    watcher-sources.ts   the real Obsidian events behind the shared note watcher
    WordCountBlock.ts    the MarkdownRenderChild for one block, a shell around the block controller, class file
  panel/
    clock-face.ts        hand angles and wedge path (pure), SVG clock face
    clock-face.test.ts
    panel.ts             renders a PanelModel as DOM and reports the user's actions
    panel.test.ts
    panel-controller.ts  keeps the open panel current; owns its subscriptions
    panel-controller.test.ts
    panel-model.ts       pure: timer + notes -> everything the panel shows
    panel-model.test.ts
  settings/
    settings.ts          pure: defaults, normalizeSettings, timer load and save
    settings.test.ts
    store.ts             pure: current settings and timer, load, save, updateSettings, subscribe (persistence and clock injected)
    store.test.ts
  status-bar/
    status-bar-controller.ts  keeps the item current; owns its subscriptions
    status-bar-controller.test.ts
    status-bar-model.ts       pure: count -> item text and tooltip
    status-bar-model.test.ts
  timer/
    last-counts.ts       pure: remembers the session's note's last count, for when the note is deleted
    last-counts.test.ts
    timer.ts             pure: timer state machine with injectable clock
    timer.test.ts
    timer-driver.ts      ticks the timer in real time (injected scheduler, clock, foreground and background hooks, notices)
    timer-driver.test.ts
  watcher/
    note-watcher.ts      pure: one shared watcher; listens through injected sources, filters by path, merges edits
    note-watcher.test.ts
  test/
    fakes.ts             buildSettings(), the malformed-settings fixture, fakePersistence(), fakeEnvironment()
    region-count.test.ts region extraction feeding the counter (integration tests sit directly in test/)
    test-types.ts        every exported type and interface used only by tests
docs/
  Code Style Guide.md    comments, class files, ordering, types.ts, list-breaking, brace spacing
  LVNACY Testing Philosophy.md   how tests get written, in every project
  SPEC.md
  TESTING.md             this project's application of the philosophy
.coverage/
  baseline.json
  check-coverage-ratchet.js
```

`count.ts`, `region.ts`, `summary.ts`, `timer.ts`, `store.ts`, `panel-model.ts`, `note-count.ts` and `block-model.ts` are plain functions with no `obsidian` imports, so the tricky parts (heading boundaries, unterminated sentinels, comment stripping, timer transitions) are unit-testable.

**Module layout.** The rules are in [Code Style Guide](<Code Style Guide.md>). In short:

- Exported types and interfaces live in `types.ts`. A module keeps only the types it does not export.
- A module whose declarations are numerous reads top to bottom in banner-headed sections: *Interfaces and Types*, *Declared Variables and Constants*, *Functions*. A small module omits the banners and simply alphabetizes its functions. Declarations are alphabetical, except where one has to follow another it depends on.
- A class file puts the class first, then supporting functions, with methods alphabetized. A command file puts `buildInvokeCommand` first.
- Test files are not laid out this way.

## 8. Tooling

The Obsidian sample plugin's tooling is not used. The scaffold is adapted from Tab Candy.

| File | Carry over | Changes |
|------|-----------|---------|
| `package.json` | Scripts (`dev`, `dev:mobile`, `typecheck`, `typecheck:fast`, `lint`, `test*`, `build`, `version`), pnpm, Node >= 24, dev dependency set | New name, description, version `0.1.0`; remove `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@testing-library/react`; add a `test:ratchet` script chaining coverage and the Ratchet check |
| `esbuild.config.js` | As is: `dist/` output, ES2020 target, `main.ts` + `styles.css` entry points, `EMULATE_MOBILE` define | None expected |
| `eslint.config.js` | Shared and type-aware rule blocks, Node-tooling override block | Replace `brands` in `obsidianmd/ui/sentence-case` with `Word Census`; keep the tooling-file list in sync with files that exist |
| `vitest.config.js` | `obsidian-test-mocks` alias, jsdom, `src/**/*.test.{ts,tsx}` include, coverage config | `include` narrowed to `.ts`. The rationale comments moved out of the config into [TESTING.md](TESTING.md), "Vitest configuration" |
| `tsconfig.json` | Core flags, `moduleResolution: bundler`, `isolatedModules` | Drop `jsx` and the React types; add `ES2022.Intl` to `lib` |
| `.coverage/check-coverage-ratchet.js` | The ratchet logic and the baseline-moves-by-hand policy | Rewrite the `EPSILON` comment (it describes Tab Candy's `useClock`); start with a smaller epsilon, and set it from observed flakiness rather than inheriting 1.5 |
| `version-bump.js` | As is | Requires `manifest.json` and `versions.json` to exist before the first `version` run |

**Timer and the Ratchet:** Tab Candy's epsilon exists because a real `setInterval` made branch coverage flaky. This plugin's timer is deliberately built on an injectable clock with fake timers in tests, so that class of flakiness should not arise and the epsilon can stay small.

## 9. Open Questions

None blocking.

- `minAppVersion` is `1.13.0`, required by the declarative settings API (decision 19).

## 10. Scaffold Order

1. Project files: `package.json`, `tsconfig.json`, `esbuild.config.js`, `eslint.config.js`, `vitest.config.js`, `manifest.json`, `versions.json`, `.gitignore`, Ratchet script and baseline.
2. Pure modules with tests, in this order: `count.ts`, `region.ts`, `timer.ts`.
3. Store, timer driver, `runtime.ts`, settings tab and the lifecycle-only `main.ts` shell. Commands and the status bar follow as their own modules, registered from `runtime.ts`.
4. Sidebar view and clock face.
5. Inline processor.
6. Status bar item.
7. Mobile pass using `pnpm dev:mobile`.