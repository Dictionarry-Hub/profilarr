/**
 * Form dirty state tracking with snapshot comparison
 *
 * Stores original data and compares against current state.
 * Change and change back = not dirty.
 * New mode = always dirty.
 */

import { writable, derived, get } from 'svelte/store';

type FormData = Record<string, unknown>;

// Internal stores
const originalSnapshot = writable<FormData | null>(null);
const currentData = writable<FormData>({});
const isNewMode = writable(false);
const showWarningModal = writable(false);
let resolveNavigation: ((value: boolean) => void) | null = null;

/**
 * Deep equality check (order-sensitive for arrays)
 */
function deepEquals(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (typeof a !== typeof b) return false;
	if (a === null || b === null) return a === b;

	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		return a.every((item, i) => deepEquals(item, b[i]));
	}

	if (typeof a === 'object' && typeof b === 'object') {
		const aObj = a as Record<string, unknown>;
		const bObj = b as Record<string, unknown>;
		const aKeys = Object.keys(aObj);
		const bKeys = Object.keys(bObj);
		if (aKeys.length !== bKeys.length) return false;
		return aKeys.every((key) => deepEquals(aObj[key], bObj[key]));
	}

	return false;
}

// Derived store for isDirty
export const isDirty = derived(
	[originalSnapshot, currentData, isNewMode],
	([$original, $current, $isNew]) => {
		if ($isNew) return true;
		return !deepEquals($original, $current);
	}
);

// Export stores for reactive access
export const current = currentData;
export const showModal = showWarningModal;

/**
 * Initialize for edit mode - snapshot from server data
 */
export function initEdit<T extends FormData>(serverData: T) {
	isNewMode.set(false);
	originalSnapshot.set(structuredClone(serverData));
	currentData.set(structuredClone(serverData));
}

/**
 * Initialize for create mode - dirty when user changes something
 */
export function initCreate<T extends FormData>(defaults: T) {
	isNewMode.set(false);
	originalSnapshot.set(structuredClone(defaults));
	currentData.set(structuredClone(defaults));
}

/**
 * Update a single field
 */
export function update<T extends FormData, K extends keyof T>(field: K, value: T[K]) {
	currentData.update((data) => ({ ...data, [field]: value }));
}

/**
 * Reset snapshot after save + refetch from server
 */
export function resetFromServer<T extends FormData>(newServerData: T) {
	isNewMode.set(false);
	originalSnapshot.set(structuredClone(newServerData));
	currentData.set(structuredClone(newServerData));
}

/**
 * Clear all state (call on unmount/navigation away)
 * Sets both stores to same empty object so isDirty = false
 */
export function clear() {
	isNewMode.set(false);
	const empty = {};
	originalSnapshot.set(empty);
	currentData.set(empty);
}

/**
 * Request navigation confirmation
 * Returns promise that resolves to true if navigation should proceed
 */
export function confirmNavigation(): Promise<boolean> {
	if (!get(isDirty)) {
		return Promise.resolve(true);
	}

	showWarningModal.set(true);

	return new Promise((resolve) => {
		resolveNavigation = resolve;
	});
}

/**
 * User confirmed discarding changes
 */
export function confirmDiscard() {
	showWarningModal.set(false);
	// Set original = current so isDirty becomes false, allowing navigation to proceed
	isNewMode.set(false);
	currentData.update((data) => {
		originalSnapshot.set(structuredClone(data));
		return data;
	});
	if (resolveNavigation) {
		resolveNavigation(true);
		resolveNavigation = null;
	}
}

/**
 * User cancelled navigation (stay on page)
 */
export function cancelDiscard() {
	showWarningModal.set(false);
	if (resolveNavigation) {
		resolveNavigation(false);
		resolveNavigation = null;
	}
}
