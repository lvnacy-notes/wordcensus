/** Shared patterns for frontmatter, code fences, and comments. Imports nothing from Obsidian. */

/**
 * A fence opener: three or more backticks or tildes at any indent. Group 1 is
 * the fence; group 2 is the rest of the line (the info string).
 */
export const FENCE_OPEN = /^[ \t]*(`{3,}|~{3,})(.*)$/;

/** Frontmatter at the very start of the text, closed by `---` or `...`. */
export const FRONTMATTER = /^---[ \t]*\n(?:[\s\S]*?\n)?(?:---|\.\.\.)[ \t]*(?:\n|$)/;

/**
 * An HTML comment; an unterminated one runs to the end of the text. Global,
 * so for `String.prototype.replace` only.
 */
export const HTML_COMMENT = /<!--[\s\S]*?(?:-->|$)/g;

/**
 * An Obsidian `%%` comment; an unterminated one runs to the end of the text.
 * Global, so for `String.prototype.replace` only.
 */
export const OBSIDIAN_COMMENT = /%%[\s\S]*?(?:%%|$)/g;