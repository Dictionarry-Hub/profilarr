/**
 * Persisted library view preferences.
 * Each store loads from localStorage on creation (defaults on the server),
 * validates via the parsers in `$shared/utils/libraryPrefs.ts`, and writes
 * back on every change.
 */

import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import {
	DEFAULT_LIBRARY_SORT,
	LIBRARY_DOWNLOAD_STATUSES,
	RADARR_CARD_DEFAULTS,
	RADARR_CARD_FIELDS,
	RADARR_DEFAULT_COLUMNS,
	RADARR_TOGGLEABLE_COLUMNS,
	SONARR_CARD_DEFAULTS,
	SONARR_CARD_FIELDS,
	SONARR_DEFAULT_COLUMNS,
	SONARR_TOGGLEABLE_COLUMNS,
	parseBooleanPref,
	parseLibraryDownloadStatusesPref,
	parseLibrarySortPref,
	parseStringSetPref,
	type LibraryDownloadStatus,
	type LibrarySort
} from '$shared/utils/libraryPrefs.ts';

export interface PersistedPref<T> extends Writable<T> {
	/** Storage key this preference is persisted under */
	readonly storageKey: string;
}

/**
 * Create a writable store backed by localStorage.
 * `parse` receives the raw stored string (or null when absent) and must return
 * a valid value; `serialize` converts a value to the stored string.
 */
export function createPersistedPref<T>(
	storageKey: string,
	parse: (raw: string | null) => T,
	serialize: (value: T) => string
): PersistedPref<T> {
	let raw: string | null = null;
	if (browser) {
		try {
			raw = localStorage.getItem(storageKey);
		} catch {
			// storage may be unavailable (private mode, quota); fall back to defaults
		}
	}

	const store = writable<T>(parse(raw));

	if (browser) {
		store.subscribe((value) => {
			try {
				localStorage.setItem(storageKey, serialize(value));
			} catch {
				// non-fatal
			}
		});
	}

	return { ...store, storageKey };
}

/**
 * Set-valued preference. Typed as `Set<string>` so the page can pass through
 * untyped keys from the action bar; parsing still restricts values to `allowed`.
 */
function createSetPref<T extends string>(
	storageKey: string,
	allowed: readonly T[],
	defaults: readonly T[]
): PersistedPref<Set<string>> {
	return createPersistedPref<Set<string>>(
		storageKey,
		(raw) => parseStringSetPref(raw, allowed, defaults),
		(value) => JSON.stringify([...value])
	);
}

/** Toggle membership of `key` in a set-valued preference. */
export function toggleSetPref<T extends string>(pref: Writable<Set<T>>, key: T): void {
	pref.update((current) => {
		const next = new Set(current);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		return next;
	});
}

// =============================================================================
// Library preference stores
// =============================================================================

export function createLibraryExpandAllPref(): PersistedPref<boolean> {
	return createPersistedPref(
		'profilarr-library-expand-all',
		(raw) => parseBooleanPref(raw, false),
		String
	);
}

export function createLibraryColumnsPref(instanceType: string): PersistedPref<Set<string>> {
	return instanceType === 'sonarr'
		? createSetPref(
				'profilarr-library-sonarr-columns',
				SONARR_TOGGLEABLE_COLUMNS,
				SONARR_DEFAULT_COLUMNS
			)
		: createSetPref('profilarr-library-columns', RADARR_TOGGLEABLE_COLUMNS, RADARR_DEFAULT_COLUMNS);
}

export function createLibraryCardFieldsPref(instanceType: string): PersistedPref<Set<string>> {
	return instanceType === 'sonarr'
		? createSetPref(
				'profilarr-library-card-fields-sonarr',
				SONARR_CARD_FIELDS,
				SONARR_CARD_DEFAULTS
			)
		: createSetPref('profilarr-library-card-fields', RADARR_CARD_FIELDS, RADARR_CARD_DEFAULTS);
}

export function createLibraryDownloadStatusesPref(
	instanceId: number
): PersistedPref<Set<LibraryDownloadStatus>> {
	return createPersistedPref<Set<LibraryDownloadStatus>>(
		`profilarr-library-download-status:${instanceId}`,
		parseLibraryDownloadStatusesPref,
		(value) => JSON.stringify([...value])
	);
}

export function createLibrarySortPref(
	instanceId: number,
	instanceType: string
): PersistedPref<LibrarySort> {
	return createPersistedPref(
		`profilarr-library-sort:${instanceId}`,
		(raw) => parseLibrarySortPref(raw, instanceType),
		JSON.stringify
	);
}

export { DEFAULT_LIBRARY_SORT, LIBRARY_DOWNLOAD_STATUSES };
