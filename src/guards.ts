/**
 * Type guards shared across modules. Imports nothing from Obsidian.
 */

/** True for a non-null object that is not an array, such as parsed saved data. */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}