/**
 * Library view preferences: option lists, defaults, and pure parsers for
 * values persisted in localStorage. Storage access lives in
 * `$stores/libraryPrefs.ts`; this module has no browser dependencies so it can
 * be unit tested.
 */

export type LibraryInstanceType = 'radarr' | 'sonarr';

// =============================================================================
// Columns
// =============================================================================

export const RADARR_RELEASE_DATE_KEYS = [
	'initialReleaseDate',
	'theatricalReleaseDate',
	'digitalReleaseDate',
	'physicalReleaseDate'
] as const;
export type RadarrReleaseDateKey = (typeof RADARR_RELEASE_DATE_KEYS)[number];

export const RADARR_TOGGLEABLE_COLUMNS = [
	'status',
	'qualityName',
	'score',
	'sizeOnDisk',
	'popularity',
	'dateAdded',
	...RADARR_RELEASE_DATE_KEYS,
	'releaseGroup'
] as const;
export type RadarrToggleableColumn = (typeof RADARR_TOGGLEABLE_COLUMNS)[number];
export const RADARR_DEFAULT_COLUMNS: readonly RadarrToggleableColumn[] =
	RADARR_TOGGLEABLE_COLUMNS.filter(
		(key) => !RADARR_RELEASE_DATE_KEYS.includes(key as RadarrReleaseDateKey)
	);

export const SONARR_TOGGLEABLE_COLUMNS = [
	'status',
	'episodes',
	'sizeOnDisk',
	'releaseGroups',
	'dateAdded',
	'firstAired',
	'previousAiring'
] as const;
export type SonarrToggleableColumn = (typeof SONARR_TOGGLEABLE_COLUMNS)[number];
export const SONARR_DEFAULT_COLUMNS: readonly SonarrToggleableColumn[] =
	SONARR_TOGGLEABLE_COLUMNS.filter((key) => key !== 'firstAired' && key !== 'previousAiring');

// =============================================================================
// Card fields
// =============================================================================

export const RADARR_CARD_FIELDS = [
	'monitored',
	'title',
	'profile',
	'size',
	'score',
	'quality',
	'year',
	'releaseGroup',
	'status',
	'popularity',
	'runtime',
	'rating',
	'dateAdded',
	...RADARR_RELEASE_DATE_KEYS
] as const;
export type RadarrCardField = (typeof RADARR_CARD_FIELDS)[number];
export const RADARR_CARD_DEFAULTS: readonly RadarrCardField[] = [
	'monitored',
	'profile',
	'size',
	'score'
];

export const SONARR_CARD_FIELDS = [
	'monitored',
	'title',
	'profile',
	'size',
	'episodes',
	'year',
	'releaseGroups',
	'status',
	'rating',
	'dateAdded',
	'firstAired',
	'previousAiring'
] as const;
export type SonarrCardField = (typeof SONARR_CARD_FIELDS)[number];
export const SONARR_CARD_DEFAULTS: readonly SonarrCardField[] = [
	'monitored',
	'profile',
	'size',
	'episodes'
];

// =============================================================================
// Sort
// =============================================================================

export type LibrarySortDirection = 'asc' | 'desc';

export interface LibrarySort {
	key: string;
	direction: LibrarySortDirection;
}

export interface LibrarySortOption {
	key: string;
	label: string;
}

const COMMON_SORT_OPTIONS: readonly LibrarySortOption[] = [
	{ key: 'title', label: 'Title' },
	{ key: 'size', label: 'Size' },
	{ key: 'dateAdded', label: 'Date Added' },
	{ key: 'year', label: 'Year' },
	{ key: 'score', label: 'Score' }
];

const RADARR_SORT_OPTIONS: readonly LibrarySortOption[] = [
	...COMMON_SORT_OPTIONS,
	{ key: 'initialReleaseDate', label: 'Initial Release' },
	{ key: 'theatricalReleaseDate', label: 'Theatrical Release' },
	{ key: 'digitalReleaseDate', label: 'Digital Release' },
	{ key: 'physicalReleaseDate', label: 'Physical Release' }
];

const SONARR_SORT_OPTIONS: readonly LibrarySortOption[] = [
	...COMMON_SORT_OPTIONS,
	{ key: 'firstAired', label: 'Series Premiere' },
	{ key: 'previousAiring', label: 'Latest Aired Episode' }
];

export const DEFAULT_LIBRARY_SORT: LibrarySort = { key: 'title', direction: 'asc' };

export function getLibrarySortOptions(instanceType: string): readonly LibrarySortOption[] {
	if (instanceType === 'radarr') return RADARR_SORT_OPTIONS;
	if (instanceType === 'sonarr') return SONARR_SORT_OPTIONS;
	return COMMON_SORT_OPTIONS;
}

// =============================================================================
// Download status
// =============================================================================

export type LibraryDownloadStatus = 'downloaded' | 'missing';
export const LIBRARY_DOWNLOAD_STATUSES: readonly LibraryDownloadStatus[] = [
	'downloaded',
	'missing'
];

// =============================================================================
// Parsers
// =============================================================================

/**
 * Parse a stored boolean. Only the literal string "true" is truthy.
 */
export function parseBooleanPref(raw: string | null, fallback: boolean): boolean {
	if (raw === null) return fallback;
	if (raw === 'true') return true;
	if (raw === 'false') return false;
	return fallback;
}

/**
 * Parse a stored JSON array into a set restricted to `allowed`.
 * Unknown entries are dropped so removed keys don't linger in storage. An
 * empty array is a valid selection. Malformed input returns `defaults`.
 */
export function parseStringSetPref<T extends string>(
	raw: string | null,
	allowed: readonly T[],
	defaults: readonly T[]
): Set<T> {
	if (raw === null) return new Set(defaults);
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return new Set(defaults);
		const result = new Set<T>();
		for (const value of parsed) {
			if (allowed.includes(value as T)) result.add(value as T);
		}
		return result;
	} catch {
		return new Set(defaults);
	}
}

/**
 * Parse a stored sort preference for the given instance type. Keys that are
 * not valid for the type (e.g. a Radarr release date on Sonarr) fall back to
 * the default sort.
 */
export function parseLibrarySortPref(raw: string | null, instanceType: string): LibrarySort {
	const fallback = { ...DEFAULT_LIBRARY_SORT };
	if (raw === null) return fallback;
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object') return fallback;
		const { key, direction } = parsed as Record<string, unknown>;
		if (typeof key !== 'string') return fallback;
		if (!getLibrarySortOptions(instanceType).some((o) => o.key === key)) return fallback;
		if (direction !== 'asc' && direction !== 'desc') return fallback;
		return { key, direction };
	} catch {
		return fallback;
	}
}

export function parseLibraryDownloadStatusesPref(raw: string | null): Set<LibraryDownloadStatus> {
	return parseStringSetPref(raw, LIBRARY_DOWNLOAD_STATUSES, LIBRARY_DOWNLOAD_STATUSES);
}
