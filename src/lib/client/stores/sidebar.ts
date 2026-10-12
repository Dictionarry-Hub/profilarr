import { writable } from 'svelte/store';
import { browser } from '$app/env';

const STORAGE_KEY = 'sidebar-collapsed';

function createSidebarStore() {
	// Get initial value from localStorage
	const initial = browser ? localStorage.getItem(STORAGE_KEY) === 'true' : false;
	const { subscribe, set, update } = writable(initial);

	return {
		subscribe,
		toggle: () =>
			update((collapsed) => {
				const newValue = !collapsed;
				if (browser) {
					localStorage.setItem(STORAGE_KEY, String(newValue));
				}
				return newValue;
			}),
		collapse: () => {
			set(true);
			if (browser) {
				localStorage.setItem(STORAGE_KEY, 'true');
			}
		},
		expand: () => {
			set(false);
			if (browser) {
				localStorage.setItem(STORAGE_KEY, 'false');
			}
		}
	};
}

export const sidebarCollapsed = createSidebarStore();
