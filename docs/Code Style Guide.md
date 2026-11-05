
## Comments

Comments describe the current behavior or contract of the module, class, or
function they precede — nothing else. Do not include decision history,
rationale, alternatives considered, or any other process narration. That
belongs in separate spec or implementation docs, not in code comments.

## One Class Per File

Hard rule: each file contains exactly one class. No exceptions.

## Ordering Within a File

**Class files:**
1. The class definition, at the top of the file.
2. Supporting functions below it, alphabetized.
3. Within the class itself: if the class has enough methods that grouping is beneficial, methods are organized into categories (defined per-class, as needed), alphabetized within each category. Otherwise, methods are simply alphabetized top to bottom.

**Command files:**
1. `buildInvokeCommand`, at the top of the file.
2. Supporting functions below it, alphabetized.

**Plain utility module files** (no class, not a command file):
- All functions alphabetized, top to bottom.
- Exception: if the module grows large enough to warrant organization but not large enough to be split into separate files, functions may be grouped into categories, alphabetized within each category — same approach as class methods.

## Types and Interfaces

If a type or interface is exported, it should live in `types.ts`.
If `types.ts` becomes unwieldy, it should become `types/` with the members organized into modules by purpose and re-exported from a barrel, `index.ts`.

## List-Breaking

Any list of more than two items is broken up, one item per line. This applies anywhere a list-like structure appears: function signatures, function calls, arrays, objects, or any other enumerated list.

## Brace Spacing

Include spaces between braces, e.g. `{ foo }` rather than `{foo}`.