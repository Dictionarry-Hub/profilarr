/**
 * Date utilities for handling SQLite timestamps
 *
 * SQLite stores timestamps from CURRENT_TIMESTAMP as UTC in the format
 * "YYYY-MM-DD HH:MM:SS" (no timezone indicator). JavaScript's Date constructor
 * interprets strings without timezone info as local time, causing incorrect
 * display.
 *
 * These utilities normalize SQLite timestamps to proper ISO 8601 format
 * so JavaScript correctly interprets them as UTC.
 */

/**
 * Normalizes a SQLite timestamp to ISO 8601 format with UTC indicator.
 * Handles both SQLite format ("YYYY-MM-DD HH:MM:SS") and ISO format.
 *
 * @param timestamp - SQLite or ISO timestamp string
 * @returns ISO 8601 formatted string with Z suffix, or null if input is null/undefined
 *
 * @example
 * toUTC("2026-01-17 03:21:52")     // "2026-01-17T03:21:52Z"
 * toUTC("2026-01-17T03:21:52")     // "2026-01-17T03:21:52Z"
 * toUTC("2026-01-17T03:21:52Z")    // "2026-01-17T03:21:52Z" (unchanged)
 * toUTC(null)                      // null
 */
export function toUTC(timestamp: string | null | undefined): string | null {
	if (!timestamp) return null;

	const trimmed = timestamp.trim();
	// Already has timezone info - return as-is
	if (/[+-]\d{2}:\d{2}$/.test(trimmed) || trimmed.endsWith('Z')) return trimmed;

	// Replace space with T (SQLite format) and add Z
	return trimmed.replace(' ', 'T') + 'Z';
}

/**
 * Parses a SQLite timestamp into a JavaScript Date object.
 * Normalizes the timestamp to UTC before parsing.
 *
 * @param timestamp - SQLite or ISO timestamp string
 * @returns Date object, or null if input is null/undefined
 *
 * @example
 * parseUTC("2026-01-17 03:21:52")  // Date object in UTC
 * parseUTC(null)                   // null
 */
export function parseUTC(timestamp: string | null | undefined): Date | null {
	const normalized = toUTC(timestamp);
	if (!normalized) return null;
	return new Date(normalized);
}

// ---------------------------------------------------------------------------
// Display formatting
//
// These functions accept normalized UTC strings (from the query layer) and
// the server timezone (from the serverTimezone store). They are the only
// way dates should be rendered in the UI.
// ---------------------------------------------------------------------------

/**
 * Formats a UTC timestamp as a full date and time in the given timezone.
 *
 * @example
 * formatDateTime("2026-04-19T14:30:45.123Z", "Asia/Kuala_Lumpur")
 * // "4/19/2026, 10:30:45 PM"
 */
export function formatDateTime(timestamp: string | null | undefined, timezone: string): string {
	if (!timestamp) return '-';
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) return '-';
	return date.toLocaleString(undefined, { timeZone: timezone });
}

/**
 * Formats a UTC timestamp as a date (no time) in the given timezone.
 *
 * @example
 * formatDate("2026-04-19T14:30:45.123Z", "Asia/Kuala_Lumpur")
 * // "4/19/2026"
 */
export function formatDate(timestamp: string | null | undefined, timezone: string): string {
	if (!timestamp) return '-';
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) return '-';
	return date.toLocaleDateString(undefined, { timeZone: timezone });
}

/**
 * Formats a UTC timestamp as a relative time string.
 * Timezone-agnostic (compares UTC instants).
 *
 * @example
 * formatRelative("2026-04-19T14:30:45.123Z") // "2h ago"
 * formatRelative("2026-04-19T16:30:45.123Z") // "in 2h"
 */
export function formatRelative(timestamp: string | null | undefined): string {
	if (!timestamp) return '-';
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) return '-';

	const diff = date.getTime() - Date.now();
	const abs = Math.abs(diff);
	const past = diff < 0;

	const seconds = Math.floor(abs / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (seconds < 10) return 'just now';
	if (days > 0) return past ? `${days}d ago` : `in ${days}d`;
	if (hours > 0) return past ? `${hours}h ago` : `in ${hours}h`;
	if (minutes > 0) return past ? `${minutes}m ago` : `in ${minutes}m`;
	return past ? `${seconds}s ago` : `in ${seconds}s`;
}
