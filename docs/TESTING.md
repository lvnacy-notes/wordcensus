# Word Census: Testing

This is the project instance of [LVNACY Testing Philosophy](<LVNACY Testing Philosophy.md>). It records only what is specific to Word Census. Where it is silent, the philosophy decides, and there are currently no deviations from it.

## Load-bearing behaviors

Named, not inferred from folder names (philosophy Section 2). These get tested hard enough that a regression cannot hide. Everything else is supplementary and gets covered because it is cheap.

| # | Behavior | Why it is load-bearing | Status |
|---|----------|------------------------|--------|
| 1 | **Region boundaries are right, and look-alikes are ignored** (`region.ts`): sentinel edge cases, heading-level boundaries, precedence, markers inside code, comments or frontmatter | A wrong boundary produces a wrong number with no error (silent and wrong) | Covered |
| 2 | **The counter never counts its own output or Markdown machinery** (`count.ts`), above all the `wordcount` block | If an inline block counted itself, the number would change the number it shows | Covered |
| 3 | **A missing heading never silently falls back to the whole note** (`extractRegion` returns `found: false`) | A confident wrong count is worse than a visible "not found" (silent and wrong) | Covered |
| 4 | **Counting degrades gracefully where `Intl.Segmenter` is missing** (older mobile WebViews) | Mobile-first: the counter must not throw on a runtime the author does not test on (outside our control) | Covered |
| 5 | **Timer accounting** (`timer.ts`): elapsed time comes from timestamps, paused time is never counted, a restored timer comes back paused, a countdown stops at zero, malformed saved timer data is normalized (`restoreTimer`) | Background throttling on mobile makes tick-counting wrong, and corrupted time is user-visible (silent and wrong) | Covered |
| 6 | **Settings survive malformed or legacy data** (`normalizeSettings`), including handing the saved timer to `restoreTimer` | A bad `data.json` must never stop the plugin loading or show `NaN` (destructive) | Covered |
| 7 | **View and processor lifecycles do not leak**: open, close and reopen the sidebar; unload a `wordcount` block | Leaked listeners and intervals accumulate silently across a long session (cumulative) | Sidebar panel covered (`panel/panel-controller.test.ts`: closing releases the timer and note subscriptions, reopening leaves exactly one, a late note read is ignored). `block/block-controller.test.ts` covers the same for a `wordcount` block: closing stops watching, reopening leaves one, a late read is ignored |

## Trust boundaries in this project

Test our usage, not the dependency (philosophy Section 3). Here that means:

- **Obsidian's API** (`ItemView`, `MarkdownRenderChild`, `metadataCache`, `processFrontMatter`, `Setting`): we test what our code does with them, never how they behave. This includes `debounce`: the plugin uses Obsidian's, so there is no test of debouncing itself.
- **`Intl.Segmenter`**: we test that we call it for scripts without spaces and that we fall back when it is absent. We do not test how it segments text, which is platform behavior and varies by runtime.
- **CodeMirror and Live Preview**: how a `wordcount` block is rendered by the editor is Obsidian's concern. We test the content our processor produces.

## Layout

- Co-located by default: `counting/count.ts` + `counting/count.test.ts`.
- `src/test/` holds the tests where more than one module cooperates and the assertion is about the combination. They sit directly in it with no subfolder, because everything else is co-located and there is nothing to separate them from. Currently `region-count.test.ts`: region extraction feeding the counter. A `conf.test.ts`, if one is ever raised, would sit beside them.
- `src/test/fakes.ts` holds `buildSettings()`, the shared malformed-settings fixture `MALFORMED_SETTINGS`, `fakePersistence()` and `fakeEnvironment()`. `src/test/test-types.ts` holds the exported types the tests use.
- The Vitest glob `src/**/*.test.ts` covers both locations.

## Notes on applying the philosophy

- **Build tool: esbuild**, a hard rule for Obsidian plugins (philosophy Section 9). Vitest handles tests only. Vite appears in `devDependencies` because Vitest runs on it, and it is never used to build.
- **No React.** The DOM-facing tests (clock face, sidebar view, processor) follow the same rule of one case per logical branch, and the cleanup rule applies: anything a test adds to the document is removed in an explicit `afterEach`.
- **Time-dependent logic** (`timer.ts`) takes `now` as an argument instead of reading a clock, so tests pass explicit timestamps and need neither fake timers nor waits. `timer-driver.ts` takes its scheduler, clock, foreground and background hooks as injected fakes (`fakeEnvironment()`), so its tests need neither fake timers nor waits either.
- **Pure modules** need no Obsidian fakes: `counting/` (`count.ts`, `region.ts`, `note-count.ts`, `summary.ts`), `settings/` (`settings.ts`, `store.ts`, with persistence and the clock injected), `timer/` (`timer.ts`, `timer-driver.ts`, `last-counts.ts`), `watcher/` (`note-watcher.ts`, whose Obsidian events are injected as fakes) and `panel/` (`panel-model.ts`, `clock-face.ts`, `panel.ts`, `panel-controller.ts`), `block/` (`block-model.ts`, `block-controller.ts`) and `status-bar/` (`status-bar-model.ts`, `status-bar-controller.ts`).
- **DOM-facing modules** (`clock-face.ts`, `panel.ts`, `panel-controller.ts`, `block-controller.ts`) run under jsdom. `panel.ts` and `block-controller.ts` build elements with Obsidian's global `createEl`, which `obsidian-test-mocks` provides through its Vitest setup file.
- **Obsidian-facing modules** are `obsidian/` (`note-source.ts`, `processor.ts`, `SettingsTab.ts`, `status-bar.ts`, `View.ts`, `watcher-sources.ts`, `WordCountBlock.ts`), `commands/`, `runtime.ts` and `main.ts`.

## Vitest configuration

The rationale behind `vitest.config.js`, kept here so the config itself stays free of comments.

| Setting | Why |
|:--------|:----|
| `resolve.alias.obsidian` → `obsidian-test-mocks/obsidian` | The `obsidian` package on npm is a types-only shim with an empty `main`; Obsidian supplies the real module at plugin-load time. Vite's resolver fails on that empty entry before `vi.mock('obsidian', ...)` can intercept the import, so the bare specifier is aliased straight to the mock package |
| `environment: 'jsdom'` | The DOM-facing code (clock face, sidebar view, processor) needs a document |
| `pool: 'vmThreads'` | Building a jsdom costs roughly 200 to 500 ms, and the default pool pays that once per test file. `vmThreads` pays it once per worker while still giving every file a fresh `window`. `isolate: false` would be faster still, but it shares module state (such as `obsidian-test-mocks`' icon registry) across files in the same worker. The one known risk is cross-realm `instanceof` against externalized packages, so revisit this if a test ever checks `instanceof` against an Obsidian class |
| `setupFiles: ['obsidian-test-mocks/vitest-setup']` | The mock library's own setup file, which installs the prototype extensions Obsidian adds to DOM and JS built-ins (such as `Element.prototype.addClass`) |
| `include: ['src/**/*.test.ts']` | One glob covers the co-located tests and the ones in `src/test/` |
| `coverage.provider: 'v8'`, reporters `text` and `json-summary` | `json-summary` is the file the Ratchet reads (`.coverage/report/coverage-summary.json`); `text` is the table printed in the terminal and in CI logs. There is no `html` reporter. It crashed a run with an `ENOENT` on `mkdir` while writing the report tree, and because reporters run in the order listed, `json-summary` was never written and the Ratchet had nothing to read. Keeping the list to what CI and the Ratchet consume removes that failure mode. For a browsable report locally, run `pnpm vitest run --coverage --coverage.reporter=html` |
| `coverage.reportsDirectory: '.coverage/report'` | Lives under the same dot-directory as the committed `baseline.json`, in its own subfolder so the two never collide. The report folder is regenerated every run and git-ignored; `baseline.json` is the one committed file under `.coverage/` |
| `coverage.include: ['src/**/*.ts']` | Scopes coverage to application source. Without it, v8's default whole-project sweep pulls in root-level build tooling (`main.ts`, `esbuild.config.js`, `version-bump.js`) and the CI script under `.coverage/`, none of which is unit-testable logic and none of which should move the baseline |
| `coverage.thresholds`, all `0` | The Ratchet is the gate, not Vitest: there is no invented target. Thresholds stay at zero so an empty or young suite never fails on percentage. The comparison against `.coverage/baseline.json` lives in `.coverage/check-coverage-ratchet.js` |

## Coverage

The Ratchet is in place as the philosophy defines it (Section 4). In this project:

- The baseline in `.coverage/baseline.json` is the floor recorded from the first real run (lines 84.66, statements 83.76, functions 70.38, branches 89.23), and moves only when a person edits it by hand.
- The tolerance (`EPSILON`) is `0.5`, deliberately smaller than the parent project's, because the timer is built on an injectable clock and has no real-time source of flakiness. If the number swings with no source change, find the nondeterministic test.
- The percentage is not a goal and is not reported as one.

## Permanent exclusions

- Obsidian's and CodeMirror's own internals (see trust boundaries above).
- CSS and visual output. The clock face's hand angles are computed by a pure function and are tested; how the SVG looks is not.
- Trivial wrappers, for example a command registration that only calls a function.
- The settings tab (`obsidian/SettingsTab.ts`), which only declares the settings and forwards reads and writes to the store. Its one piece of logic, routing every edit through `normalizeSettings`, now lives in `store.updateSettings` and is tested in `store.test.ts`.
- `obsidian/View.ts`, `obsidian/WordCountBlock.ts`, `obsidian/processor.ts`, `obsidian/note-source.ts`, `obsidian/watcher-sources.ts` and `commands/open-panel.ts`: thin shells over `ItemView`, `MarkdownRenderChild`, the vault and the command registry. Their logic lives in `panel-controller.ts`, `block-controller.ts`, `block-model.ts`, `note-count.ts` and `panel-model.ts`, which are tested.
- `main.ts` and `runtime.ts`. `main.ts` is lifecycle only and `runtime.ts` is wiring only (construct the store, register features); any logic that creeps into either belongs in a pure module with its own tests.

## Known gaps

Not tested yet, or deliberately pinned in prose rather than in a test. Revisit if a bug surfaces here.

| Gap | Reason |
|:----|:-------|
| Setext headings (`Title` underlined with `===`) are not recognised as headings | A documented limitation (SPEC §3.2), not a behavior worth pinning with a test |
| Indented (four-space) code blocks, a comment that contains a fence line, math | Documented limits (SPEC §5). Each would need a parser, not a regex |
| Direct CRLF handling in the exported `extractSentinelRegions` and `extractHeadingRegion` | Covered through `extractRegion`, which shares the same one-line helper |
| How a `wordcount` block renders in Live Preview, and behavior on real mobile WebViews | Needs a real Obsidian or device. Checked by hand with `pnpm dev:mobile` before a release |

## When to expand

The philosophy's rules (Section 8) apply as written. In this project:

- **A bug fix ships with a test that would have caught it**, named after what it catches, for example `extractRegion_ignores_sentinel_inside_code_block`.
- **A new setting ships with a `normalizeSettings` case** for its missing, malformed and legacy values. The same goes for any new field in persisted timer state.
- **A new counting rule** (something else to exclude or include) ships with a `count.test.ts` case and a line in SPEC §5. A new kind of marker or heading rule ships with a `region.test.ts` case, and an integration case if it changes how region text reaches the counter.
- **Touching `region.ts`, `count.ts` or `timer.ts`** means running their existing tests first.

## Open implementation items

- Whether `eslint-plugin-obsidianmd` false-positives on test files: verify at the first lint run that includes them.