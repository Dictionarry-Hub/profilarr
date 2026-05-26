/**
 * Data page store for managing search, view toggle, and filtering
 * Combines search functionality with view state persistence
 */

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { createSearchStore, getPersistentSearchStore, type SearchStore } from './search.ts';

export type ViewMode = 'table' | 'cards';

export interface ViewModeConfig {
	/** Key for localStorage persistence */
	storageKey: string;
	/** Default view mode when no saved preference exists */
	defaultView?: ViewMode;
	/** Mobile breakpoint in px, below which cards always win */
	mobileBreakpoint?: number;
}

export interface DataPageConfig<T> {
	/** Key for localStorage persistence */
	storageKey: string;
	/** Fields to search within items */
	searchKeys: (keyof T)[];
	/** Default view mode */
	defaultView?: ViewMode;
	/** Debounce time for search in ms */
	debounceMs?: number;
	/** Optional persistent search key */
	searchKey?: string;
	/** Optional external search store */
	searchStore?: SearchStore;
}

export interface DataPageStore<T> {
	/** Search store for SearchAction component */
	search: SearchStore;
	/** Current view mode ('table' | 'cards') */
	view: {
		subscribe: (fn: (value: ViewMode) => void) => () => void;
		set: (value: ViewMode) => void;
	};
	/** Filtered items based on search query */
	filtered: {
		subscribe: (fn: (value: T[]) => void) => () => void;
	};
	/** Update the items (e.g., when data changes) */
	setItems: (items: T[]) => void;
}

export function createViewModeStore(config: ViewModeConfig) {
	const { storageKey, defaultView = 'cards', mobileBreakpoint = 768 } = config;
	let initialView: ViewMode = defaultView;

	if (browser) {
		try {
			const stored = localStorage.getItem(storageKey);
			if (stored === 'cards' || stored === 'table') {
				initialView = stored;
			} else if (window.innerWidth < mobileBreakpoint) {
				initialView = 'cards';
			}
		} catch {
			if (window.innerWidth < mobileBreakpoint) {
				initialView = 'cards';
			}
		}
	}

	const view = writable<ViewMode>(initialView);

	if (browser) {
		view.subscribe((value) => {
			try {
				localStorage.setItem(storageKey, value);
			} catch {
				// Some browsers can deny storage access.
			}
		});
	}

	return view;
}

/**
 * Create a data page store for managing list pages
 *
 * @example
 * const { search, view, filtered } = createDataPageStore(data.profiles, {
 *   storageKey: 'qualityProfilesView',
 *   searchKeys: ['name', 'description']
 * });
 */
export function createDataPageStore<T>(
	initialItems: T[],
	config: DataPageConfig<T>
): DataPageStore<T> {
	const { storageKey, searchKeys, defaultView = 'cards', debounceMs = 300 } = config;

	// Items store
	const items = writable<T[]>(initialItems);

	// Search store
	const search =
		config.searchStore ??
		(config.searchKey
			? getPersistentSearchStore(config.searchKey, { debounceMs })
			: createSearchStore({ debounceMs }));

	const view = createViewModeStore({ storageKey, defaultView });

	// Filtered items derived from search
	const filtered = derived([items, search.debouncedQuery], ([$items, $query]) => {
		if (!$query) return $items;

		const queryLower = $query.toLowerCase();
		return $items.filter((item) =>
			searchKeys.some((key) => {
				const value = item[key];
				if (value == null) return false;
				return String(value).toLowerCase().includes(queryLower);
			})
		);
	});

	return {
		search,
		view: {
			subscribe: view.subscribe,
			set: view.set
		},
		filtered: {
			subscribe: filtered.subscribe
		},
		setItems: (newItems: T[]) => items.set(newItems)
	};
}

export type { SearchStore };
