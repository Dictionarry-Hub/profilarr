/**
 * Data page store for managing search, view toggle, and filtering
 * Combines search functionality with view state persistence
 */

import { writable, derived, type Readable } from 'svelte/store';
import type { Component } from 'svelte';

import { browser } from '$app/env';

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

/** A row a card can show; the card rows picker lists these. */
export interface CardRowOption {
	key: string;
	label: string;
	icon: Component;
	/** Optional line under the label in the card rows picker. */
	description?: string;
	/** Whether the row shows before the user has chosen. */
	defaultVisible: boolean;
}

export interface CardRowsStore extends Readable<string[]> {
	toggle(key: string): void;
}

/**
 * Which card rows are visible, saved per browser. Only the user's choices are
 * stored, so a row added later starts at its default. Any list of toggles with
 * defaults can use it, such as the log levels on Settings › Logs.
 */
export function createCardRowsStore(
	storageKey: string,
	rows: readonly Pick<CardRowOption, 'key' | 'defaultVisible'>[]
): CardRowsStore {
	let choices: Record<string, boolean> = {};

	if (browser) {
		try {
			const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
			if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
				for (const [key, value] of Object.entries(stored)) {
					if (typeof value === 'boolean') choices[key] = value;
				}
			}
		} catch {
			choices = {};
		}
	}

	const visibleKeys = () =>
		rows.filter((row) => choices[row.key] ?? row.defaultVisible).map((row) => row.key);
	const { subscribe, set } = writable<string[]>(visibleKeys());

	return {
		subscribe,
		toggle(key: string) {
			const row = rows.find((candidate) => candidate.key === key);
			if (!row) return;
			choices = { ...choices, [key]: !(choices[key] ?? row.defaultVisible) };
			set(visibleKeys());
			if (browser) {
				try {
					localStorage.setItem(storageKey, JSON.stringify(choices));
				} catch {
					// Some browsers can deny storage access.
				}
			}
		}
	};
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
