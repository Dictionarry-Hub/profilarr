/**
 * Global user preference for which filter bar to render on list pages.
 * `smart` = SmartFilterBar (typed field/value tags)
 * `simple` = SearchAction (plain text search)
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type FilterMode = 'smart' | 'simple';

const STORAGE_KEY = 'filterMode';

function loadFilterMode(): FilterMode {
	if (!browser) return 'smart';
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === 'smart' || stored === 'simple') return stored;
		return 'smart';
	} catch {
		return 'smart';
	}
}

export const filterMode = writable<FilterMode>(loadFilterMode());

if (browser) {
	filterMode.subscribe((value) => {
		try {
			localStorage.setItem(STORAGE_KEY, value);
		} catch {
			// storage may be unavailable (private mode, quota); non-fatal
		}
	});
}
