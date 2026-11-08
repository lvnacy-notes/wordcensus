/** Type guards shared across modules. Imports nothing from Obsidian. */

/**
 * Tells whether a value is a non-null object that is not an array, such as
 * parsed saved data.
 *
 * @param value - The value to test.
 * @returns `true` when `value` is a plain record.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}