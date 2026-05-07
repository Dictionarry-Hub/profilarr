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

export type DateFormat = 'auto' | 'mdy' | 'dmy' | 'ymd';
export type DatePart = 'month' | 'day' | 'year';

// ---------------------------------------------------------------------------
// Display formatting
//
// These functions accept normalized UTC strings (from the query layer) and
// the server timezone (from the serverTimezone store). They are the only
// way dates should be rendered in the UI.
// ---------------------------------------------------------------------------

function resolveDisplayArgs(
	dateFormatOrOptions?: DateFormat | Intl.DateTimeFormatOptions,
	options?: Intl.DateTimeFormatOptions
): { dateFormat: DateFormat; options?: Intl.DateTimeFormatOptions } {
	if (typeof dateFormatOrOptions === 'string') {
		return { dateFormat: dateFormatOrOptions, options };
	}
	return { dateFormat: 'auto', options: dateFormatOrOptions };
}

export function getDatePartOrder(dateFormat: DateFormat): DatePart[] {
	if (dateFormat === 'mdy') return ['month', 'day', 'year'];
	if (dateFormat === 'dmy') return ['day', 'month', 'year'];
	if (dateFormat === 'ymd') return ['year', 'month', 'day'];

	const parts = new Intl.DateTimeFormat(undefined, {
		year: 'numeric',
		month: 'numeric',
		day: 'numeric'
	})
		.formatToParts(new Date(Date.UTC(2006, 10, 22)))
		.map((part) => part.type)
		.filter((part): part is DatePart => part === 'month' || part === 'day' || part === 'year');

	const uniqueParts = [...new Set(parts)];
	return uniqueParts.length === 3 ? uniqueParts : ['month', 'day', 'year'];
}

function formatExplicitDate(
	date: Date,
	timezone: string,
	dateFormat: Exclude<DateFormat, 'auto'>
): string {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(date);
	const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	const year = values.year;
	const month = values.month;
	const day = values.day;

	if (dateFormat === 'mdy') return `${month}/${day}/${year}`;
	if (dateFormat === 'dmy') return `${day}/${month}/${year}`;
	return `${year}-${month}-${day}`;
}

function pickTimeOptions(
	options?: Intl.DateTimeFormatOptions
): Intl.DateTimeFormatOptions | undefined {
	if (!options) return undefined;
	const timeOptions: Intl.DateTimeFormatOptions = {};
	let hasTimeOptions = false;

	if (options.hour !== undefined) {
		timeOptions.hour = options.hour;
		hasTimeOptions = true;
	}
	if (options.minute !== undefined) {
		timeOptions.minute = options.minute;
		hasTimeOptions = true;
	}
	if (options.second !== undefined) {
		timeOptions.second = options.second;
		hasTimeOptions = true;
	}
	if (options.fractionalSecondDigits !== undefined) {
		timeOptions.fractionalSecondDigits = options.fractionalSecondDigits;
		hasTimeOptions = true;
	}
	if (options.hour12 !== undefined) {
		timeOptions.hour12 = options.hour12;
		hasTimeOptions = true;
	}
	if (options.hourCycle !== undefined) {
		timeOptions.hourCycle = options.hourCycle;
		hasTimeOptions = true;
	}
	if (options.timeZoneName !== undefined) {
		timeOptions.timeZoneName = options.timeZoneName;
		hasTimeOptions = true;
	}

	return hasTimeOptions ? timeOptions : undefined;
}

function formatTime(date: Date, timezone: string, options?: Intl.DateTimeFormatOptions): string {
	return date.toLocaleTimeString(undefined, {
		timeZone: timezone,
		...pickTimeOptions(options)
	});
}

/**
 * Formats a UTC timestamp as a full date and time in the given timezone.
 * Pass optional Intl options to customize the output format.
 *
 * @example
 * formatDateTime("2026-04-19T14:30:45.123Z", "Asia/Kuala_Lumpur")
 * // "4/19/2026, 10:30:45 PM"
 * formatDateTime("2026-04-19T14:30:45.123Z", "Asia/Kuala_Lumpur", { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
 * // "Apr 19, 10:30 PM"
 */
export function formatDateTime(
	timestamp: string | null | undefined,
	timezone: string,
	dateFormatOrOptions?: DateFormat | Intl.DateTimeFormatOptions,
	options?: Intl.DateTimeFormatOptions
): string {
	if (!timestamp) return '-';
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) return '-';
	const args = resolveDisplayArgs(dateFormatOrOptions, options);
	if (args.dateFormat === 'auto') {
		return date.toLocaleString(undefined, { timeZone: timezone, ...args.options });
	}
	return `${formatExplicitDate(date, timezone, args.dateFormat)}, ${formatTime(
		date,
		timezone,
		args.options
	)}`;
}

/**
 * Formats a UTC timestamp as a date (no time) in the given timezone.
 * Pass optional Intl options to customize the output format.
 *
 * @example
 * formatDate("2026-04-19T14:30:45.123Z", "Asia/Kuala_Lumpur")
 * // "4/19/2026"
 * formatDate("2026-04-19T14:30:45.123Z", "Asia/Kuala_Lumpur", { month: 'short', day: 'numeric', year: '2-digit' })
 * // "Apr 19, 26"
 */
export function formatDate(
	timestamp: string | null | undefined,
	timezone: string,
	dateFormatOrOptions?: DateFormat | Intl.DateTimeFormatOptions,
	options?: Intl.DateTimeFormatOptions
): string {
	if (!timestamp) return '-';
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) return '-';
	const args = resolveDisplayArgs(dateFormatOrOptions, options);
	if (args.dateFormat === 'auto') {
		return date.toLocaleDateString(undefined, { timeZone: timezone, ...args.options });
	}
	return formatExplicitDate(date, timezone, args.dateFormat);
}

/**
 * Formats a UTC timestamp with smart date labeling.
 * Shows "Today", "Yesterday", or a short date, followed by the time.
 *
 * @example
 * formatSmartDateTime("2026-04-19T14:30:45.123Z", "America/New_York")
 * // "Today, 10:30 AM"  (if today is Apr 19 in that timezone)
 * // "Yesterday, 10:30 AM"
 * // "Apr 19, 10:30 AM"
 */
export function formatSmartDateTime(
	timestamp: string | null | undefined,
	timezone: string,
	dateFormat: DateFormat = 'auto'
): string {
	if (!timestamp) return '-';
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) return '-';

	const now = new Date();

	// Format both dates as YYYY-MM-DD in the target timezone to compare calendar days
	const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone }); // en-CA gives YYYY-MM-DD
	const dateDay = fmt.format(date);
	const todayDay = fmt.format(now);

	const yesterday = new Date(now.getTime() - 86400000);
	const yesterdayDay = fmt.format(yesterday);

	const timeStr = date.toLocaleTimeString(undefined, {
		timeZone: timezone,
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	});

	if (dateDay === todayDay) return `Today, ${timeStr}`;
	if (dateDay === yesterdayDay) return `Yesterday, ${timeStr}`;

	const dateStr = formatDate(timestamp, timezone, dateFormat, {
		month: 'short',
		day: 'numeric'
	});

	return `${dateStr}, ${timeStr}`;
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
