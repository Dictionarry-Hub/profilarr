/**
 * Shared search utilities for entity list pages.
 * Handles text search, tag search, NOT: operator parsing, and persistent search field state.
 */

import { browser } from '$app/environment';

export type SearchMode = 'text' | 'tags';

/** A parsed search term: value and whether it's negated */
export interface ParsedTerm {
	value: string;
	negated: boolean;
}

export interface SearchFieldOption {
	value: string;
	label: string;
}

/** Parse a NOT: prefix from a string. */
export function parseTerm(raw: string): ParsedTerm {
	const trimmed = raw.trim();
	if (trimmed.toUpperCase().startsWith('NOT:')) {
		return { value: trimmed.slice(4).trim(), negated: true };
	}
	return { value: trimmed, negated: false };
}

/**
 * Filter items using text search across specified fields.
 * Supports NOT: prefix to negate the entire query.
 * Uses OR logic across enabled fields.
 */
export function filterByText<T>(
	items: T[],
	query: string,
	fieldAccessors: Record<string, (item: T) => string | string[] | null>,
	enabledKeys: string[]
): T[] {
	if (!query.trim()) return items;

	const { value, negated } = parseTerm(query);
	if (!value) return items;

	const queryLower = value.toLowerCase();

	return items.filter((item) => {
		const matches = enabledKeys.some((key) => {
			const accessor = fieldAccessors[key];
			if (!accessor) return false;
			const fieldValue = accessor(item);
			if (fieldValue == null) return false;
			if (Array.isArray(fieldValue)) {
				return fieldValue.some((v) => v.toLowerCase().includes(queryLower));
			}
			return fieldValue.toLowerCase().includes(queryLower);
		});
		return negated ? !matches : matches;
	});
}

/**
 * Filter items using tag-based search.
 * Positive tags use AND logic: item must match ALL.
 * NOT: tags use AND logic: item must not match ANY.
 */
export function filterByTags<T>(
	items: T[],
	searchTags: string[],
	getItemTags: (item: T) => string[]
): T[] {
	if (searchTags.length === 0) return items;

	const parsed = searchTags.map(parseTerm);
	const positiveTags = parsed.filter((t) => !t.negated).map((t) => t.value.toLowerCase());
	const negativeTags = parsed.filter((t) => t.negated).map((t) => t.value.toLowerCase());

	return items.filter((item) => {
		const itemTagNames = getItemTags(item).map((t) => t.toLowerCase());

		const matchesPositive = positiveTags.every((tag) => itemTagNames.includes(tag));
		const matchesNegative = negativeTags.some((tag) => itemTagNames.includes(tag));

		return matchesPositive && !matchesNegative;
	});
}

/**
 * Create persistent search field state.
 * Manages active field selection and tag chips, persisted to localStorage.
 */
export function createSearchFieldState(
	storageKey: string,
	fields: SearchFieldOption[],
	defaultField: string = 'name'
) {
	const fieldKey = `${storageKey}:field`;
	const tagsKey = `${storageKey}:tags`;

	function loadField(): string {
		if (!browser) return defaultField;
		const stored = localStorage.getItem(fieldKey);
		if (stored && fields.some((f) => f.value === stored)) return stored;
		return defaultField;
	}

	function loadTags(): string[] {
		if (!browser) return [];
		try {
			const stored = localStorage.getItem(tagsKey);
			if (stored) return JSON.parse(stored);
		} catch {
			/* localStorage may be unavailable */
		}
		return [];
	}

	function saveField(field: string) {
		if (browser) localStorage.setItem(fieldKey, field);
	}

	function saveTags(tags: string[]) {
		if (browser) localStorage.setItem(tagsKey, JSON.stringify(tags));
	}

	function clearTags() {
		if (browser) localStorage.removeItem(tagsKey);
	}

	return {
		initialField: loadField(),
		initialTags: loadTags(),
		saveField,
		saveTags,
		clearTags
	};
}
