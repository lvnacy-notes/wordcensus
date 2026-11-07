/**
 * The patterns for frontmatter, code fences and comments that `count.ts` and
 * `region.ts` both rely on, so the two modules always agree on where those
 * structures start and end. Imports nothing from Obsidian.
 *
 * `HTML_COMMENT` and `OBSIDIAN_COMMENT` carry the global flag and are for
 * `String.prototype.replace` only. `FENCE_OPEN` and `FRONTMATTER` have no
 * global flag, so `exec` is safe with them.
 */

// A fence opener: three or more backticks or tildes at any indent. Group 1 is
// the fence, group 2 the rest of the line (the info string).
export const FENCE_OPEN = /^[ \t]*(`{3,}|~{3,})(.*)$/;

// Frontmatter at the very start of the text, closed by `---` or `...`.
export const FRONTMATTER = /^---[ \t]*\n(?:[\s\S]*?\n)?(?:---|\.\.\.)[ \t]*(?:\n|$)/;

// An HTML comment. An unterminated one runs to the end of the text.
export const HTML_COMMENT = /<!--[\s\S]*?(?:-->|$)/g;

// An Obsidian `%%` comment. An unterminated one runs to the end of the text.
export const OBSIDIAN_COMMENT = /%%[\s\S]*?(?:%%|$)/g;