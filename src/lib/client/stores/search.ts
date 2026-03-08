/**
 * Search store for managing search and filter state
 */

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';

export interface SearchState {
	query: string;
	filters: Record<string, unknown>;
	isActive: boolean;
}

export interface SearchStoreConfig {
	debounceMs?: number;
	caseSensitive?: boolean;
}

const persistentStores = new Map<string, SearchStore>();

export function createSearchStore(config: SearchStoreConfig = {}) {
	const { debounceMs = 300, caseSensitive = false } = config;

	const state = writable<SearchState>({
		query: '',
		filters: {},
		isActive: false
	});

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	// Derived store for the debounced query
	const debouncedQuery = writable('');

	function setQuery(query: string) {
		state.update((s) => ({ ...s, query, isActive: query.length > 0 }));

		// Debounce the query update
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		debounceTimer = setTimeout(() => {
			debouncedQuery.set(query);
		}, debounceMs);
	}

	function setFilter(key: string, value: unknown) {
		state.update((s) => ({
			...s,
			filters: { ...s.filters, [key]: value },
			isActive: true
		}));
	}

	function removeFilter(key: string) {
		state.update((s) => {
			const { [key]: _, ...rest } = s.filters;
			return {
				...s,
				filters: rest,
				isActive: s.query.length > 0 || Object.keys(rest).length > 0
			};
		});
	}

	function clearFilters() {
		state.update((s) => ({
			...s,
			filters: {},
			isActive: s.query.length > 0
		}));
	}

	function clear() {
		state.set({
			query: '',
			filters: {},
			isActive: false
		});
		debouncedQuery.set('');
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}
	}

	// Helper function to filter an array of items
	function filterItems<T>(
		items: T[],
		searchFields: (keyof T)[],
		additionalFilter?: (item: T, filters: Record<string, unknown>) => boolean
	): T[] {
		const currentState = get(state);
		const query = get(debouncedQuery);

		if (!currentState.isActive) {
			return items;
		}

		return items.filter((item) => {
			// Search query filter
			if (query) {
				const matchesQuery = searchFields.some((field) => {
					const value = String(item[field] ?? '');
					return caseSensitive
						? value.includes(query)
						: value.toLowerCase().includes(query.toLowerCase());
				});

				if (!matchesQuery) {
					return false;
				}
			}

			// Additional custom filters
			if (additionalFilter && Object.keys(currentState.filters).length > 0) {
				return additionalFilter(item, currentState.filters);
			}

			return true;
		});
	}

	// Derived store for easy access to whether search is active
	const isActive = derived(state, ($state) => $state.isActive);

	// Derived store for filter count
	const filterCount = derived(state, ($state) => Object.keys($state.filters).length);

	return {
		subscribe: state.subscribe,
		debouncedQuery: { subscribe: debouncedQuery.subscribe },
		isActive: { subscribe: isActive.subscribe },
		filterCount: { subscribe: filterCount.subscribe },
		setQuery,
		setFilter,
		removeFilter,
		clearFilters,
		clear,
		filterItems
	};
}

export type SearchStore = ReturnType<typeof createSearchStore>;

export function getPersistentSearchStore(key: string, config: SearchStoreConfig = {}): SearchStore {
	const existing = persistentStores.get(key);
	if (existing) return existing;

	const store = createSearchStore(config);
	if (browser) {
		const saved = localStorage.getItem(key);
		if (saved) {
			store.setQuery(saved);
		}
		store.subscribe((state) => {
			if (state.query) {
				localStorage.setItem(key, state.query);
			} else {
				localStorage.removeItem(key);
			}
		});
	}

	persistentStores.set(key, store);
	return store;
}
