# Word Census: Implementation Plan

Details for every item live in the [[Word Census v1.1 SPEC]]. This document is the order of work and the checklists for calling each piece done.

## Build order

| Step | Work | Branch | Ships in |
|------|------|--------|----------|
| 0 | Session history spike | `spike/sqlite` | not shipped |
| 1 | Prerequisites for session history | `feat/session-history` | 1.1.0 |
| 2 | Session history | `feat/session-history` | 1.1.0 |
| 3 | Groundwork: display options and region ranges | `feat/character-count` | 1.2.0 |
| 4 | Character count | `feat/character-count` | 1.2.0 |
| 5 | Page count | `feat/page-count` | 1.2.0 |
| 6 | Block `display` property | `feat/block-display` | 1.2.0 |
| 7 | Whitespace reveal | `feat/whitespace-reveal` | 1.2.0 |
| 8 | Selection count | `feat/selection-count` | 1.2.0 |

Release grouping is a proposal: session history alone as 1.1.0, everything else as 1.2.0. Change it if you want one release.

Session history records characters and pages, so step 1 builds the small pieces of character count and page count that it reads. Steps 4 and 5 then add the display for them.

## Definition of done

Every feature, before it is marked ready to ship:

- [ ] Every item in the feature's checklist below is checked
- [ ] Pure logic has unit tests, per `LVNACY Testing Philosophy.md`
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test:ratchet` passes, and the baseline in `.coverage/baseline.json` is moved by hand
- [ ] Each new setting is added everywhere listed in [spec 4.5](wordcensus-features-spec.md#45-new-settings)
- [ ] Exercised by hand on desktop and on mobile (`pnpm dev:mobile`)
- [ ] README features list and settings table updated
- [ ] `docs/TESTING.md` known gaps updated
- [ ] Operational details ported to `docs/SPEC.md`
- [ ] Spec and code agree. Anything that changed while building is changed in the feature spec too
- [ ] Merged to `main`
- [ ] At release: versions bumped with the `version` script and release notes written

## Step 0: Session history spike

Throwaway branch. Record each result. If any item fails, stop and revisit the engine before building on it.

- [ ] `sql.js` inline build loads in Obsidian's Electron renderer without touching Node modules
- [ ] It loads on a real phone, and start-up time is acceptable with lazy init
- [ ] Whole-file write time measured with a year of realistic sessions
- [ ] `PRAGMA query_only = ON` rejects INSERT, UPDATE, DELETE and DROP
- [ ] Database file round-trips through the vault adapter (`writeBinary`, tmp file then move)
- [ ] A plugin API object is reachable from a DataviewJS block
- [ ] `main.js` size increase measured and recorded

## Step 1: Prerequisites for session history

[Spec 4.2](wordcensus-features-spec.md#42-single-cleaning-pass), [5.1](wordcensus-features-spec.md#51-counting), [6.1](wordcensus-features-spec.md#61-calculation).

- [ ] The counter cleans once and returns `words`, `characters` and `charactersNoSpaces`
- [ ] `countWords` is a wrapper, and its existing tests are untouched
- [ ] `NoteCount` carries both character fields
- [ ] `estimatePages(words, wordsPerPage)` exists and is tested
- [ ] `wordsPerPage` is in settings, defaults, `normalizeSettings` and tests (clamped 1 to 10000). The settings tab row waits for step 5.
- [ ] Existing tests still pass

## Step 2: Session history

[Spec 10](wordcensus-features-spec.md#10-session-history). Build in this order. Timer first, because every later part depends on it.

**Timer and driver** ([10.2](wordcensus-features-spec.md#102-recording-and-when-a-row-is-written), [10.4](wordcensus-features-spec.md#104-segments-table))
- [ ] Timer tests written first for: session id, segments, restore with no id, restore with an id while recording is off
- [ ] `SessionRun` carries an id, assigned at the first start while recording is on, saved with the timer
- [ ] `restoreTimer` accepts a timer with no id
- [ ] Character baselines stored when a session starts
- [ ] `last-counts.ts` remembers characters
- [ ] The driver reports every start and pause, including a background pause
- [ ] Segment boundary counts are read from the bound note
- [ ] A session's `running_ms` equals the sum of its segments

**Pure modules**
- [ ] `session-record.ts` builds a record from timer state
- [ ] `retention.ts` computes the cutoff: day periods, calendar months, month-end clamping
- [ ] Retention tests pin a time zone and cover month ends, leap years and a daylight saving change

**Repository** ([10.1](wordcensus-features-spec.md#101-storage), [10.3](wordcensus-features-spec.md#103-sessions-table))
- [ ] `SessionRepository` interface in `types.ts` and an in-memory fake in `src/test/fakes.ts`
- [ ] `sqlite-repository.ts`: lazy `sql.js`, schema, `user_version`, migrations in transactions
- [ ] `v1_sessions` and `v1_segments` views, dropped and recreated on open
- [ ] Debounced write, background flush and flush in `onunload`
- [ ] Write to `history.db.tmp` then move; leftover `.tmp` handled at startup
- [ ] One queue for writes, export copies, pruning and Clear history
- [ ] Unreadable file renamed and a new database started; newer or failed schema left untouched with API rejection
- [ ] Failed write shows a notice and retries
- [ ] Pruning on startup, whenever a database exists, and after each write; `VACUUM` only after deleted rows
- [ ] One integration test runs the real schema and a migration through `sql.js`

**Recording rules** ([10.2](wordcensus-features-spec.md#102-recording-and-when-a-row-is-written))
- [ ] Only Session-mode runs are recorded; a run that never started writes nothing
- [ ] Rows written on pause, background, reset, note deletion and recording off
- [ ] Recording turned on mid-session shows the restart dialog and both choices work
- [ ] Recording turned off mid-session finalises the row and the session continues
- [ ] Clear history mid-session offers both choices and Cancel

**API** ([10.6](wordcensus-features-spec.md#106-query-api))
- [ ] `createApiV1` in `src/history/api/api-v1.ts`
- [ ] `api.versions` and `api.v1.query` and `api.v1.sessions`
- [ ] Read-only enforced; multi-statement strings rejected
- [ ] Contract test for v1 across every migration; `api.versions` lists only versions that have one
- [ ] Works from a DataviewJS block on desktop and mobile

**Settings and dialogs** ([10.5](wordcensus-features-spec.md#105-retention), [10.7](wordcensus-features-spec.md#107-export), [12](wordcensus-features-spec.md#12-settings-tab))
- [ ] `recordSessionHistory` and `historyRetention` settings, with `normalizeSettings` fallback to `90d`
- [ ] Notice when shortening the period deletes data
- [ ] Clear history action row
- [ ] Export dialog: folder picker with create, name validation, clash refusal, file toggles remembered
- [ ] CSV output: quoting, ISO columns, formula prefix
- [ ] `lastExportedAt` changes only when every selected file was written, and the row refreshes
- [ ] Saved state (`lastExportedAt`, `lastExportFolder`, `lastExportFiles`) checked in `normalizeSettings`

**Docs**
- [ ] README: recording, retention with the cutoff rule word for word, export, CSV formula prefix, the sync caveat
- [ ] README: API v1 methods, views and columns
- [ ] `sql.js` licence text ships with the plugin
- [ ] Release notes mention the larger `main.js`

## Step 3: Groundwork

[Spec 4.1, 4.3, 4.4](wordcensus-features-spec.md#4-groundwork).

- [ ] `DisplayOptions` slice; `buildSummary` and `buildStatusContent` take it
- [ ] `extractRegion` also returns `{ from, to }[]` ranges; `text` unchanged
- [ ] Range tests: sentinels, heading, whole note, unterminated start, ignored end
- [ ] Existing tests still pass

The editor extension infrastructure is built in step 7.

## Step 4: Character count

[Spec 5](wordcensus-features-spec.md#5-character-count), [4.6](wordcensus-features-spec.md#46-summary-text).

- [ ] Settings: `showCharactersInStatusBar`, `showCharactersInSidebar`, `includeSpacesInCharacterCount` (visible when either toggle is on)
- [ ] Status bar and panel headline per 4.6
- [ ] Both label variants tested
- [ ] Counting rules in the README and in the settings description

## Step 5: Page count

[Spec 6](wordcensus-features-spec.md#6-page-count).

- [ ] Settings: `showPagesInStatusBar`, `showPagesInSidebar`, and the `wordsPerPage` row in the settings tab
- [ ] Headline shows pages per 4.6
- [ ] README states 250 as the "mass market standard" and describes the figure as an estimate

## Step 6: Block `display` property

[Spec 9](wordcensus-features-spec.md#9-inline-block-display-property).

- [ ] Parser handles the list, case, quotes, duplicates, unknown options, empty list and a same-line value
- [ ] A new pure block-lines builder
- [ ] Every option renders with its label, plurals and region phrase
- [ ] `Heading not found` line
- [ ] Session options: no session, running, paused, unreadable note, no bound note
- [ ] `Session note` link activates an open leaf, or opens a new tab
- [ ] A block subscribes to the timer only when it lists a session option
- [ ] Blocks without `display` render as before
- [ ] README block section updated

## Step 7: Whitespace reveal

[Spec 7](wordcensus-features-spec.md#7-whitespace-reveal), [4.4](wordcensus-features-spec.md#44-editor-extension).

- [ ] `highlightWhitespace` export checked, and the route (built in or `MatchDecorator`) chosen
- [ ] The CodeMirror extension registered from `runtime.ts` in a `Compartment`
- [ ] Settings: `revealWhitespace`, `whitespaceRevealScope` (visible when reveal is on)
- [ ] "Toggle whitespace reveal" command
- [ ] Glyph mapping and region and note scope tested, including no markers, heading not found and non-breaking space
- [ ] Draws only visible ranges; checked in a long note
- [ ] Styling in `styles.css`
- [ ] Works in source mode and Live Preview

## Step 8: Selection count

[Spec 8](wordcensus-features-spec.md#8-selection-count).

- [ ] `updateListener` on `selectionSet`, debounced
- [ ] Pure clipping and counting in `src/selection/`
- [ ] Panel, status bar and blocks show `12 of 142 words` and characters
- [ ] Inside, outside, crossing, several regions, multiple selections, empty selection and `0 of N` tested
- [ ] A block shows the selection only for the active editor's note
- [ ] Selection dragging profiled in a long note
- [ ] README states the boundary rule and the cleaned-on-its-own rule