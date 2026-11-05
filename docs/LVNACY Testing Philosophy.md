# LVNACY Testing Philosophy

How tests get written, in every project. It was first worked out in the Tab Candy Testing Specification; this document keeps the parts that travel and drops the parts that belong to one codebase.

Each project keeps its own `docs/TESTING.md`, which applies this philosophy to that project: it names the load-bearing behaviors, records any deviation and why, and lists known gaps. Where a project's file is silent, this document decides.

## 1. Principle

**Minimal overhead. Maximum confidence where it actually matters.**

Coverage numbers are vanity. A file can sit at 100% and still let a real regression through, because that 100% is spread evenly across things nobody would notice breaking. What matters is that a short list of genuinely load-bearing behaviors, named and not inferred from which folder a file lives in, are tested hard enough that a regression cannot hide. Everything else is supplementary.

A suite should be small enough that people run it and sharp enough that a break in something important cannot slip past. A suite that is slow, noisy or padded gets skipped, and a skipped suite protects nothing.

## 2. Load-bearing behaviors

Every project names its load-bearing behaviors explicitly, in its own `TESTING.md`, as behaviors rather than files.

A behavior is load-bearing when failing it would be one of these:

- **Silent and wrong.** The software gives a confident answer that is incorrect, and nothing signals it.
- **Destructive.** It corrupts or loses the user's data or configuration.
- **Fatal to the host.** It hangs or crashes the application it runs inside.
- **Cumulative.** It leaks listeners, handles, roots or timers that only hurt after a long session.
- **Outside our control.** It depends on undocumented internals or on platform differences that can change with no warning.

Typical examples are normalizing persisted data that may be malformed or from an older version, boundary and parsing logic, lifecycle and cleanup, access to private APIs, and degrading gracefully on runtimes that lack a feature.

Everything not on the list is real and worth testing, but supplementary. It gets covered because it is cheap once the fakes exist, not because it earns a target.

## 3. Trust boundaries

**Test our usage, not the dependency.**

- We test what our code does with a host API, never the host's own behavior.
- We test what our code does with a UI framework, never the framework.
- We test how we handle a file listing or a platform value, never the filesystem or runtime that produces it.
- A mocking library is covered by its own tests. We do not re-verify it.
- A function that only forwards to something else, with no branching, state or error handling, is not worth a dedicated test. Trust what it wraps.

## 4. Coverage: the Ratchet

A fixed percentage target, soft or hard, would smuggle "the percentage means quality" back in after Section 1 argued against it. So there is no target. There is a floor:

- **Coverage cannot drop below its existing baseline.** No invented number, just "don't silently backslide".
- **The baseline moves only by hand.** A person edits the baseline file in the same change that raised coverage. Scripts never write to it, so no bot commits are needed and someone stays accountable for raising the floor.
- **Two independent hard gates.** A failing test always fails the build, whatever the coverage. The Ratchet fails the build when coverage drops, whatever the tests did. The second gate catches what no test can, such as a well-tested file being deleted.
- **The tolerance is small and earned.** It exists to absorb float rounding. If coverage swings between runs with no source change, find the nondeterministic test and fix it. Do not widen the tolerance.
- **The baseline starts at zero**, so the first real run establishes it.

Whether the named load-bearing behaviors are actually tested is a human and review question, not something a tool can check. That is what the list in Section 2 is for.

## 5. Writing tests

### What to cover

1. **One case per logical branch, not per data value.** A branch is a conditional, a ternary, a toggle, or a different shape of output. Variation of data within a branch is not a new case, and one representative value is enough.
2. **Boolean combinators need enough cases to show that each operand can independently gate the outcome.** That is not the full truth table.
3. **Do not test combinations that real call sites cannot produce**, even when the type system allows them.

### How they read

- `describe()` per exported function, hook or class. `it()` is a sentence describing behavior ("returns an empty array when the folder doesn't exist"), not a fragment.
- Arrange, act, assert, with a blank line between each section.
- Import `describe`, `it`, `expect` and the rest explicitly from the test runner. Do not rely on injected globals.
- No `any` in tests. If a fake needs a shape the compiler cannot infer, give it a proper type.
- **No snapshot testing.** A snapshot diff says something changed, not whether it is correct. Use explicit assertions even when it takes more typing.

### Time

Use fake timers wherever a debounce or interval is under test, and give time-dependent logic an injectable clock so tests drive it directly. No real waits anywhere. A suite that takes thirty seconds because of real timers is a suite people start skipping.

### Fixtures

- Build test data with a factory that takes overrides and spreads them over the real defaults, so a new field means updating one place and not every test.
- Shared fixtures for malformed shapes (a registry that is missing, an entry that is corrupt, a call that throws) live in one shared file. They start from the real fake and deliberately strip or corrupt it. No general-purpose library ships "intentionally broken" as a feature.

### Cleanup

When globals are off, test libraries' automatic cleanup hooks never register, because they attach to a global. Any file that renders or otherwise adds to shared state, the DOM above all, must clean up explicitly after each test, or later tests start matching leftovers from earlier ones. Every new test file of that kind needs this from the start.

### Wrong tests

A test that pins a misunderstanding of what the code should do is fixed together with the code, never worked around.

## 6. Structure

- **Co-locate by default.** `thing.ts` and `thing.test.ts` live side by side. This covers pure functions, services tested against fakes in isolation, hooks and components.
- **Integration tests go directly in the project's `test` directory**, with no subfolder of their own: because everything else is co-located, there is nothing to separate them from. They are the few tests that wire together more than one collaborating piece and assert on the combined behavior.
- **The discriminator:** a test belongs there if it connects fakes for more than one service and the assertion is about what that combination does, whichever single file it is nominally about. A file that merely imports several modules, with fakes and assertions scoped to its own contract, stays co-located.
- A shared fakes file holds only what is specific to the project. Anything host-shaped comes from the mocking library.
- One glob in the runner's config covers both locations, with no special-casing.

## 7. What is not tested

**Permanent exclusions**, by decision:

- The host application's and dependencies' own internals (Section 3).
- CSS and visual output. No visual-regression tooling is in scope.
- Trivial wrappers (Section 3).

**Known gaps**, which are not exclusions: things not tested yet, each with the reason. They live in a table in the project's `TESTING.md`, filled in as real gaps are identified and never invented speculatively. A gap is revisited if a bug actually surfaces there.

## 8. When to expand the suite

- **Mandatory: a bug fix ships with a test that would have caught it.** No exception for "it was a one-liner", because one-liner bugs are the most embarrassing to repeat. Name the test after what it catches (`normalizeSettings_drops_unknown_legacy_field`), not after an issue number.
- **Mandatory: a feature that adds to a normalized or persisted area ships with its malformed, missing and legacy cases.** The code that guards user data grows every time a feature does, and its tests grow with it.
- **Mandatory: touching a shared service means running its existing tests first.** If a change breaks them, decide whether the test encoded the old contract on purpose (fix the test) or caught a real regression (fix the code). Do not just make it pass.
- **Recommended: fix a test that pins wrong behavior** rather than working around it.

## 9. Toolchain defaults

- **Test runner: Vitest.** It is ESM-native, so there is no transpilation shim or CommonJS layer to fight in a `"type": "module"` project. It bundles assertions, mocking, fake timers, a DOM environment and V8 coverage in one dependency rather than five stitched together.
- **Build tool: esbuild, for every Obsidian plugin. This is a hard rule, not a default.** Vite did not replace esbuild when it was tried on a plugin, and other build tools have been attempted with similar results. Do not reopen it. The test runner is a separate decision, so Vitest is used regardless of the build tool. Vitest runs on Vite internally, so Vite may appear in `devDependencies`; it is never used to build the plugin.
- **For Obsidian plugins, `obsidian-test-mocks` is the fake host layer.** The `obsidian` package is types-only, so something has to supply the runtime. It mocks the whole API surface, including the prototype extensions Obsidian adds to built-ins, and ships a Vitest setup file. The accepted risk is a single maintainer and modest adoption, to be revisited if it goes stale.
- **Rejected, with reasons.** Jest, for its ESM friction. Node's built-in `node:test`, because its strip-only TypeScript mode cannot handle constructs such as `enum`, so it suits only projects that avoid them. A bundled meta-toolchain was also evaluated and rejected as pre-1.0 and wanting to own choices already settled elsewhere. These were decisions for the projects that made them, and a new project may revisit them.
- **Type errors in a test file block the build**, exactly as type errors in source do. That is intentional.

## 10. Adopting this in a project

A project's `docs/TESTING.md`:

1. Names its load-bearing behaviors, each with a status (covered, or pending the module that does not exist yet).
2. Lists which trust boundaries are specific to it.
3. Records any deviation from this document, and why. No deviation is the common case.
4. Notes its layout where it differs.
5. Lists its permanent exclusions and its known gaps.
6. Lists open implementation items, which are settled in principle and only need hands-on work.