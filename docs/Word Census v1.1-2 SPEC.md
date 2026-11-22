
**Applies to:** Word Census 1.1.0 and 1.2.0
**Status:** Draft 1

## 1. Scope

This document specifies five features and the shared groundwork they need:

1. Session history
2. Character count
3. Whitespace reveal
4. Page count
5. Selection count

It also specifies the `display` property of the inline `wordcount` block and the per-surface display toggles.

## 2. Constraints

- `isDesktopOnly` is `false`. Every feature works on mobile. The status bar is desktop only.
- No Node APIs in runtime code.
- `main.ts` holds lifecycle only. Features are registered from `runtime.ts`.
- Every settings edit goes through `store.updateSettings`, which runs `normalizeSettings`. `normalizeSettings` lists its fields explicitly and drops unknown fields.
- Logic lives in pure modules with no Obsidian import. Obsidian-facing code is a thin layer in `src/obsidian/`.
- Every new toggle defaults to off.

## 3. Existing behavior these features build on

- **Region.** The counted region is, in order of precedence: the text between sentinel markers; the text under the configured heading (the `heading` setting, or the note's `word-count-heading` property); the whole note. A heading that is not found yields no region and the count shows "Heading not found".
- **Cleaning.** Before counting, a region has frontmatter, comments, link URLs and Markdown syntax removed, and code blocks, footnotes and embeds included or excluded per the counting settings.
- **Surfaces.** The sidebar panel, the status bar and the inline `wordcount` block. All three refresh through the shared `NoteWatcher`, which also reports settings changes.

## 4. Groundwork

### 4.1 Display options

Characters, pages, whitespace and selection count change presentation only. They never change the count. A `DisplayOptions` object carries the display settings. `buildSummary(count, display)` and `buildStatusContent(count, display)` take it.

### 4.2 Single cleaning pass

The counter cleans a region once and returns:

- `words`
- `characters`
- `charactersNoSpaces`

`countWords` remains as a wrapper that returns `words`. `NoteCount` carries `characters` and `charactersNoSpaces`. Pages are derived at display time and are not stored in `NoteCount`.

### 4.3 Region ranges

`extractRegion` returns, in addition to `text`, the source offset ranges of the region as `{ from, to }[]`.

### 4.4 Editor extension

One CodeMirror 6 extension serves whitespace reveal and selection count. It is registered with `registerEditorExtension` from `runtime.ts` and held in a `Compartment`. What to draw and what to count is decided in pure modules. The CodeMirror code only connects them to the editor.

### 4.5 New settings

| Setting | Type | Default | Visible when |
|---------|------|---------|--------------|
| `showCharactersInStatusBar` | toggle | off | always |
| `showCharactersInSidebar` | toggle | off | always |
| `includeSpacesInCharacterCount` | toggle | off | either characters toggle is on |
| `showPagesInStatusBar` | toggle | off | always |
| `showPagesInSidebar` | toggle | off | always |
| `wordsPerPage` | number | 250 | always |
| `revealWhitespace` | toggle | off | always |
| `whitespaceRevealScope` | dropdown: `region`, `note` | `region` | `revealWhitespace` is on |
| `recordSessionHistory` | toggle | off | always |
| `historyRetention` | dropdown | `90d` | always |

Saved state, not user-edited settings, each checked in `normalizeSettings`:

| Field | Type | Default |
|-------|------|---------|
| `lastExportedAt` | epoch milliseconds, or null | null |
| `lastExportFolder` | vault folder path | `""` (the vault root) |
| `lastExportFiles` | `{ sqlite, sessions, segments }`, each a boolean | all false |

Each new setting is added to: `WordCensusSettings`, `DEFAULT_SETTINGS`, `normalizeSettings`, the definitions in `SettingsTab.ts`, the `buildSettings` fake and malformed-settings fixture in `src/test/fakes.ts`, `settings.test.ts`, the README settings table.

Conditional rows use the declarative settings API's `visible` property. Hiding a row does not reset its value.

`wordsPerPage` is normalized to an integer and clamped to a range of 1 to 10000.

### 4.6 Summary text

The panel's region summary and the status bar show the same headline: the enabled figures in the order words, characters, pages, joined with ` · `, for example `142 words · 812 characters · 2 pages`. Words always show. Characters and pages show when their toggle for that surface is on.

- Status bar: the headline, then ` (region)` once at the end when the count covers only part of the note. The tooltip is the existing detail line.
- Panel: the headline in the region summary, and the existing detail line.
- Plurals: `1 word`, `1 character`, `1 page`, `1 region`. Zero and every other number take the plural.
- With a selection (section 8), words and characters read `12 of 142 words` and `85 of 812 characters`. Pages keep the region figure.
- The panel's Session mode keeps its "current region count" line on the region.

## 5. Character count

### 5.1 Counting

Characters are counted in the cleaned region text. Any run of whitespace counts as one space. Leading and trailing whitespace is dropped. Characters are counted as Unicode code points, so an emoji is one character.

- `characters` includes the single spaces.
- `charactersNoSpaces` excludes all whitespace.

### 5.2 Display

| Surface | Control |
|---------|---------|
| Status bar | `showCharactersInStatusBar` |
| Sidebar panel | `showCharactersInSidebar` |

`includeSpacesInCharacterCount` chooses the figure shown:

- Off: `812 characters` (`charactersNoSpaces`)
- On: `812 characters with spaces` (`characters`)

### 5.3 Documentation

The README and the settings description state the counting rules in 5.1.

### 5.4 Tests

Whitespace collapsing, link and comment stripping, the empty region, code points outside the Basic Multilingual Plane, both label variants in `summary.test.ts` and `status-bar-model.test.ts`.

## 6. Page count

### 6.1 Calculation

`estimatePages(words, wordsPerPage)` is a pure function in `src/counting/`. It returns `ceil(words / wordsPerPage)`. 0 words is 0 pages.

### 6.2 Display

Whole numbers: `11 pages`, `1 page`.

| Surface | Control |
|---------|---------|
| Status bar | `showPagesInStatusBar` |
| Sidebar panel | `showPagesInSidebar` |
| Inline block | `page-count` in `display` |

### 6.3 Default

`wordsPerPage` is 250, documented in the README as the "mass market standard": US Letter, 12-point type, 1-inch margins, double-spaced. The README describes the figure as an estimate.

### 6.4 Tests

`estimatePages` at 0, 1, exactly one page, one word over, and non-default `wordsPerPage`. Clamping in `settings.test.ts`.

## 7. Whitespace reveal

### 7.1 Behavior

When `revealWhitespace` is on, the editor draws a glyph for each whitespace character:

| Character | Glyph |
|-----------|-------|
| Space | `·` |
| Non-breaking space | `·` |
| Tab | `→` |
| Hard line break | `¶` |

A line end glyph is drawn at hard line breaks only, not at wrapped lines. All whitespace is drawn.

### 7.2 Scope

| `whitespaceRevealScope` | Drawn in |
|-------------------------|----------|
| `region` | The counted region, resolved as in section 3. A note with no markers and no heading is drawn in full. A heading that is not found draws nothing. |
| `note` | The whole note |

### 7.3 Activation

- The `revealWhitespace` setting.
- The command "Toggle whitespace reveal", which flips `revealWhitespace` through `store.updateSettings`.

### 7.4 Implementation

- The extension is held in a `Compartment` and reconfigured when `revealWhitespace` or `whitespaceRevealScope` changes.
- Pure module `src/whitespace/` maps characters to glyphs and ranges to decorations.
- Glyphs are drawn only in the visible ranges of the editor.
- The extension recomputes the region on every document change and whenever the settings or the note's `word-count-heading` property change. The heading override comes from the metadata cache.
- Glyph styling is in `styles.css`, in the editor's muted text colour.
- It works in source mode and Live Preview. It does not apply in Reading view.
- If Obsidian's bundled CodeMirror exports `highlightWhitespace`, use it. Otherwise use a `ViewPlugin` with a `MatchDecorator`.

### 7.5 Tests

Glyph mapping, region and note scope, no markers and no heading, heading not found, non-breaking space, wrapped lines.

## 8. Selection count

### 8.1 Behavior

There is no setting. When the active editor has a selection inside the counted region, the word count shows the selection's count against the region's count:

`12 of 142 words`

| Surface | Shows |
|---------|-------|
| Inline block | Word line, and character line when `char-count` or `char-count-with-spaces` is listed |
| Status bar | Words, and characters when the status bar character toggle is on |
| Sidebar panel | Words, and characters when the sidebar character toggle is on |

Pages always show the region.

### 8.2 Rules

- A selection entirely outside the region shows nothing. The region count is shown.
- A selection that crosses a region boundary counts only the part inside the region.
- Multiple selections are summed.
- With no markers and no heading the region is the whole note.
- Active editor only. In Reading view the region count is shown.
- An empty selection (a cursor) is no selection. The region count is shown.
- A selection inside the region that holds no words reads `0 of 142 words`.
- The panel and the status bar follow the note in the active editor. A block shows the selection only when its note is the note in the active editor.
- A block with `heading:` clips the selection to the range of its own heading.

### 8.3 Counting

The selection is intersected with the region ranges (4.3). The clipped text is cleaned by itself, then counted with the single cleaning pass (4.2). A selection that starts inside a link or an excluded code block is cleaned as if it stood alone. The clipped text is cleaned with a newline in front, as region text is, so a selection that begins with `---` is never taken for frontmatter.

Ranges are offsets into the editor document's text. The leading newline that region text carries is not part of any range.

### 8.4 Implementation

- A CodeMirror `updateListener` reacts to `selectionSet` and publishes the selections of the active editor.
- Updates are debounced.
- The panel, the status bar and the inline blocks subscribe to the selection state in addition to note changes.
- Pure module `src/selection/` clips selections to region ranges and counts them.
- The ranges for a block with `heading:` come from `extractHeadingRegion`.

### 8.5 Documentation

The README states:

- If a selection starts or ends outside the counted region, only the part inside the region is counted.
- A selection is cleaned on its own, so a selection that starts inside a link or an excluded code block can differ by a few words from the region count.

### 8.6 Tests

Selection inside, outside, crossing the start, crossing the end, spanning several regions, multiple selections, empty selection, no markers and no heading, and heading not found.

## 9. Inline block `display` property

### 9.1 Syntax

````markdown
```wordcount
heading: Chapter 3
display:
  - word-count
  - char-count
  - page-count
```
````

`display` is a multi-line list. The inline array form is not supported. `display` and `heading` are independent and may appear in either order.

### 9.2 Options

| Option | Line |
|--------|------|
| `word-count` | `34 words under “Chapter 3”` |
| `char-count` | `5400 characters` |
| `char-count-with-spaces` | `5400 characters with spaces` |
| `page-count` | `11 pages` |
| `session-time` | `24:10 session time` |
| `session-words` | `312 words this session` |
| `session-wpm` | `13 words per minute` |
| `session-characters` | `1520 characters this session`, or `1520 characters with spaces this session` when `includeSpacesInCharacterCount` is on |

### 9.3 Parsing

- The property name and option values are case-insensitive and trimmed. Quotes around a value are accepted.
- Figures show in the order listed. A repeated option shows once.
- `display:` stands alone on its line. Its items are the following lines that begin with `-`, after optional indentation. Blank lines inside the list are skipped. The list ends at the first other line. `display: word-count`, with a value on the same line, is ignored.
- Every line that is not `heading:`, `display:` or a list item of `display:` is ignored.
- Unknown options are ignored.
- With no `display` property, or no valid option, the block shows the word count only.
- Parsing is a small hand-written pure parser with no Obsidian import. `parseBlockSource` reads `display` alongside `heading`.

### 9.4 Rendering

- Each figure is on its own line with its label.
- A block shows what it lists, regardless of the display toggles in settings.
- The word line names the region:

| Region | Phrase |
|--------|--------|
| Heading | `under “Chapter 3”` |
| Markers | `between markers (2 regions)`, or `(1 region)` |
| None | `in the whole note` |

  N is the number of start-and-end marker regions in the note. A start marker with no end marker runs to the end of the text and counts as a region. An end marker with no start marker is ignored. A heading that is not found shows "Heading not found".
- `char-count` always shows characters without spaces. `char-count-with-spaces` always shows characters with spaces. Neither follows `includeSpacesInCharacterCount`.
- When the heading is not found, one line reads `Heading not found` in the place of the word, character and page figures. Session figures still show.
- Plurals follow 4.6.
- With a selection in the region the word line reads `12 of 142 words under “Chapter 3”`.
- The sidebar panel and the status bar keep their existing region wording.

### 9.5 Session options

- Session options show the running session, whichever note it is bound to.
- A session is active when a Session-mode run has started at least once and has not been reset or ended by the deletion of its note. A paused session is active.
- A paused session shows a `(paused)` suffix on the `session-time` line. When `session-time` is not listed, the first session line carries it.
- With no active session, one line reads `No active session` in the place of the first session figure. Every figure that needs no session still shows.
- `session-characters` follows `includeSpacesInCharacterCount`: `1520 characters this session`, or `1520 characters with spaces this session`. The other options do not depend on settings.
- When the bound note's count cannot be read, word, character and rate figures show `—`. A session with no bound note shows only its time.
- When the session is bound to a note other than the block's note, a line `Session note: <title>` follows the session lines. It is a link:
  - If the bound note is open in a workspace leaf, the link activates that leaf.
  - If it is not open, the link opens it in a new tab.
  - It never replaces the note in the current tab.
- A session bound to the block's own note, or bound to no note, shows no `Session note` line.
- A block subscribes to timer state only when it lists a session option.

### 9.6 Implementation

- `BlockOptions` gains `display`.
- A new pure block-lines builder takes the count, the display list, the selection and the session state, and returns the labelled lines.
- A line may carry a link target, a note path. The pure builder returns the path and the controller attaches the click handler that activates or opens the note through the workspace.
- `block-controller.ts` renders one line per figure.

### 9.7 Tests

List parsing, mixed case, quotes, duplicates, unknown values, an empty list, `heading` and `display` together, each option, session options with no session, a running session and a paused session, a session bound to another note (link line, open and not open), `session-characters` with each value of `includeSpacesInCharacterCount`, an unreadable bound note, a session with no bound note, `Heading not found`, plurals, region phrases for markers, heading and whole note, a selection.

## 10. Session history

### 10.1 Storage

- The engine is `sql.js`, using its inline build, initialised lazily on first use. Its licence text ships with the plugin.
- The database is held in memory and written whole through the vault adapter to `history.db` in the plugin folder, next to `data.json`.
- Schema version is held in `PRAGMA user_version`. Each migration runs in a transaction. The `v1_*` views are dropped and recreated on every open.
- The data is local to the vault. No sync is provided. The README states that two devices writing the same file can overwrite each other's history.
- `recordSessionHistory` controls only whether new sessions are written. With it off, an existing database stays open and readable: the API, export, pruning and Clear history work on it as usual.
- When no database exists, the API returns empty results and no database is created until recording is on.

**Writing**
- Writes are debounced, flushed when the app goes to the background, and flushed in `onunload`.
- The database is written to `history.db.tmp` and then moved over `history.db`. At startup a leftover `history.db.tmp` is deleted when `history.db` exists and is used when `history.db` is missing.
- Database writes, export copies, pruning and Clear history run one at a time through a single queue.
- A failed write shows a notice and is retried at the next scheduled write. The in-memory database is kept.

**Unusable files**
- A `history.db` that is not a readable SQLite database is renamed `history.db.corrupt-<epoch ms>`. A new database starts and a notice names the renamed file.
- A database whose `user_version` is newer than the plugin knows, or whose migration fails, is left untouched. Recording is off for that session of Obsidian, a notice says why, and API calls reject with an error that names the cause.

### 10.2 Recording and when a row is written

Only Session-mode runs are recorded. Stopwatch and countdown are not.

**Session id.** A recorded session has an `id`, a random string from an injected generator, carried by `SessionRun` and saved with the timer. It is assigned when a session starts for the first time while recording is on. A session with no id is not recorded.

**Rows.** A row is written, as an upsert, when a recorded session:

- pauses, or the app goes to the background
- is reset
- ends because its note was deleted
- has recording turned off (below)

A run that never started writes nothing. A session with no bound note is recorded with null note and count columns.

**Restore.** `restoreTimer` accepts saved timers that have no id. Such a session, saved by 1.0.x, is not recorded. If recording is off when a timer with an id is restored, the id is dropped.

**Counts.** A session stores character baselines (with and without spaces) when it starts. A timer saved by 1.0.x has none, and those columns are null. `last-counts.ts` also remembers characters.

**Recording turned on while a session is active.** A dialog says the running session started before recording was on and cannot be recorded. It offers:

- Restart the session: the session is reset, and started again if it was running, so the new session is recorded.
- Record from the next session: the running session continues unrecorded, and the next session start is recorded.

**Recording turned off while a session is active.** The session's row is written with what has been captured. The moment recording is turned off is its `ended_at`, and an open segment is closed at that moment. The session continues, its id is cleared, and it is not recorded again. Turning recording back on while it is still active shows the dialog above.

**Clear history while a recorded session is active.** The Clear history confirmation offers:

- Clear everything except the running session
- Clear everything, including the running session: the session's rows are deleted and its id is cleared, so it is not recorded again
- Cancel

**Active** is defined as in 9.5.

### 10.3 Sessions table

One row per session. Exposed as the view `v1_sessions`.

| Column | Type |
|--------|------|
| `id` | text |
| `started_at`, `ended_at`, `running_ms` | integer |
| `note_path`, `note_title` | text |
| `region_mode` | text: `note`, `sentinel` or `heading` |
| `heading` | text |
| `baseline_words`, `final_words`, `net_words` | integer |
| `words_per_minute` | real, not rounded; 0 when `net_words` is negative |
| `baseline_characters`, `final_characters`, `net_characters` | integer |
| `baseline_characters_no_spaces`, `final_characters_no_spaces`, `net_characters_no_spaces` | integer |
| `words_per_page`, `pages` | integer |
| `include_code_blocks`, `include_footnotes`, `include_embeds` | integer, 0 or 1 |

Timestamps are epoch milliseconds. `running_ms` excludes paused time. `pages` is estimated from `final_words`. `heading` is the heading in effect when `region_mode` is `heading`, otherwise null. A column that could not be determined is null.

### 10.4 Segments table

`session_segments` has one row per start-to-pause stretch. Exposed as the view `v1_segments`.

| Column | Type |
|--------|------|
| `session_id` | text |
| `seq` | integer, 1 for the first stretch of a session |
| `started_at`, `ended_at`, `running_ms` | integer |
| `start_words`, `end_words` | integer |
| `start_characters`, `end_characters` | integer |
| `start_characters_no_spaces`, `end_characters_no_spaces` | integer |

- A start opens a segment. A pause, including a pause caused by the app going to the background, closes it.
- A restored session comes back paused. Its next start opens a new segment.
- Boundary counts are read from the bound note when the stretch starts and ends. A count that cannot be read is null.
- A session's `running_ms` equals the sum of its segments' `running_ms`.
- The timer driver reports each start and pause of the session run.

### 10.5 Retention

`historyRetention` values:

| Stored value | Period |
|--------------|--------|
| `30d` | 30 days |
| `60d` | 60 days |
| `90d` | 90 days (default) |
| `6m` | 6 calendar months |
| `9m` | 9 calendar months |
| `12m` | 12 calendar months |

`normalizeSettings` replaces any other value with `90d`.

**Cutoff.** The cutoff is the current local date and time minus the period. A session is kept while its `ended_at` is on or after the cutoff.

- Day periods subtract calendar days in local time.
- Month periods subtract calendar months in local time.
- When the earlier month has no such day, the cutoff uses that month's last day: 31 August minus 6 months is the last day of February, and 29 February minus 12 months is 28 February. `setMonth` overflow is not used.

**Pruning.** Pruning runs on startup, whenever a database exists, and after each write. It removes sessions and their segments together. When it removed rows it then compacts the file with `VACUUM`. Shortening the period shows a notice when it deletes data.

**Clear history.** An action row in the settings tab asks for confirmation, then deletes all sessions and segments. While a recorded session is active, the confirmation has the choices in 10.2.

### 10.6 Query API

The plugin instance exposes `api`, reachable at `app.plugins.plugins.wordcensus.api`. `main.ts` holds what `startRuntime` returns. `api` holds one namespace per API version. There is no unversioned `api.query` or `api.sessions`.

| Member | Description |
|--------|-------------|
| `api.versions` | Array of the exposed version names, for example `["v1"]` |
| `api.v1` | The version 1 API |
| `api.v1.query(sql, params?)` | Async. Returns an array of plain row objects |
| `api.v1.sessions({ from, to, path })` | Async. Returns sessions in the range, optionally for one note path |

**Versioning**
- Each version is built by its own factory over the shared repository: `createApiV1(repository)`, and a later `createApiV2(repository)`.
- A version's contract is its method signatures, its return shapes, and its views. Views are named with the version prefix: `v1_sessions`, `v1_segments`. A later version adds `v2_sessions` and `v2_segments`.
- A version's views keep their names, columns, column types, units and null behavior for as long as that version is exposed.
- Schema migrations keep every exposed version's views working. A migration that cannot keep a version's views working is a breaking change and requires a new version.
- An additive change (a new column, a new helper) does not create a new version. A new column appears in the version's views only when it cannot change the result of an existing query that selects named columns.
- A new version is added alongside the old ones. An old version is removed only in a major release of the plugin, and the README documents its removal first.
- The internal tables are not part of any version's contract and may change in any release.
- Each version is documented separately in the README, with its views, columns and methods.

**Behavior of every version**
- `query` is read-only. Each statement runs under `PRAGMA query_only = ON`. A string with more than one statement is rejected.
- Timestamps are epoch milliseconds.
- `params` is a positional array.
- `sessions({ from, to, path })`: every field is optional. `from` and `to` are epoch milliseconds, both inclusive, and filter on `ended_at`. `path` matches `note_path` exactly. Rows are sorted by `started_at`, oldest first, and have the columns of `v1_sessions`.
- With no database (recording never turned on), results are empty and nothing throws.

```js
const api = app.plugins.plugins.wordcensus?.api?.v1;
const rows = await api.query(
  "SELECT date(started_at / 1000, 'unixepoch') AS day, SUM(net_words) AS words FROM v1_sessions GROUP BY day ORDER BY day"
);
dv.table(["Day", "Words"], rows.map(r => [r.day, r.words]));
```

### 10.7 Export

An export action in the settings tab opens a dialog. The action row's description shows the date of the last export (`lastExportedAt`).

**Dialog**

- Folder picker: the vault root and every folder in the vault. The user may type a new folder path. A new folder is created only when the export proceeds, with `createFolder`. The last folder used is the starting point (`lastExportFolder`). If that folder no longer exists, the starting point is the vault root.
- Name field: a base name, starting as `wordcensus-history-YYYY-MM-DD`.
- One toggle per file, remembered in `lastExportFiles`. On first use all are off.
  - `<name>.sqlite`, a copy of the database file, with its internal tables and views
  - `<name>-sessions.csv`
  - `<name>-segments.csv`
- The Export button is disabled until at least one file is toggled on.

**Name rules.** A name is rejected when it contains `\ / : * ? " < > |`, begins or ends with a dot or a space, is empty, or exceeds 100 characters. A name for which any selected file already exists is refused, and the dialog lists the clashes and asks for a different name. An existing file is never overwritten.

**Writing**

- Pending database writes are flushed first.
- Files are written through the vault adapter.
- The CSVs are built from `v1_sessions` and `v1_segments`, with the columns of the view in view order.
- CSV is UTF-8 with a header row. Fields containing commas, quotes or line breaks are quoted, with quotes doubled.
- CSV timestamps are epoch milliseconds. `started_at_iso` and `ended_at_iso` (ISO 8601, UTC) follow the epoch columns in both CSVs.
- A text cell that begins with `=`, `+`, `-` or `@` is prefixed with a single quote in the CSV. Numeric columns and the SQLite copy are unchanged. The README states this.
- On success a notice names the folder and files, and `lastExportedAt` is set. If any selected file fails, the notice names the failure and `lastExportedAt` is unchanged.
- After an export the settings tab refreshes with `update()`.

### 10.8 Structure

- `src/history/session-record.ts`: pure, builds a record from timer state.
- `src/history/retention.ts`: pure, computes the cutoff and what to prune.
- `src/history/export.ts`: pure, CSV building and name validation.
- `src/history/sqlite-repository.ts`: the SQL, with file reading and writing injected.
- `src/history/api/api-v1.ts`: `createApiV1(repository)`. Each later version is its own file in the same folder.
- `SessionRepository` interface in `types.ts`, with an in-memory fake in `src/test/fakes.ts`.
- The query API, the export dialog and the History settings rows in `src/obsidian/`.

### 10.9 Tests

- Record building and retention are pure unit tests. Retention tests pin a time zone and cover month ends, leap years and a daylight saving change.
- Controllers run against the in-memory repository.
- One integration test runs the real schema and a migration through `sql.js`.
- API, for every exposed version: INSERT, UPDATE, DELETE, DROP and multi-statement strings are rejected, results are plain objects.
- Contract test per version: a fixed set of queries and helper calls against that version's views, run on a database produced by every migration from the first schema to the current one. The test compares column names, column types, units and null behavior with a stored expectation.
- `api.versions` lists exactly the versions that have a contract test.
- Segments: the sum of segment `running_ms` equals the session's `running_ms`, background pause, restore then start.
- Export: name validation, clashes, CSV quoting, the formula prefix, partial failure leaves `lastExportedAt` unchanged, a missing `lastExportFolder` falls back to the root.
- Lifecycle: a session started with recording on is recorded; a session with no id is not; a run that never started writes nothing; a session with no bound note is recorded with null columns; a 1.0.x timer restores unrecorded; a restored id is dropped when recording is off.
- Recording turned on mid-session: both dialog choices. Turned off mid-session: the row is finalised at that moment, the open segment is closed, the session continues unrecorded.
- Clear history mid-session: both choices, and cancel.
- Storage: a leftover `.tmp` file in each case, an unreadable file is renamed, a newer `user_version` is left untouched and the API rejects, a failed migration rolls back, a failed write is retried, writes and exports are queued in order.
- Pruning runs with recording off, and `VACUUM` runs only when rows were removed.

## 11. Per-surface display toggles

| Figure | Status bar | Sidebar panel |
|--------|------------|---------------|
| Characters | `showCharactersInStatusBar` | `showCharactersInSidebar` |
| Pages | `showPagesInStatusBar` | `showPagesInSidebar` |

Session figures have no toggle. They are shown by the timer in the panel and by `display` in the block.

## 12. Settings tab

Existing groups are unchanged. The Display group gains the characters, pages and whitespace rows. A History group holds `recordSessionHistory`, `historyRetention`, the export row and the "Clear history" row.