/**
 * Server timezone store.
 *
 * Holds the IANA timezone string from the server's TZ configuration.
 * Initialized once on app startup from /api/v1/status. All date display
 * in the UI uses this value for timezone conversion.
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

function createTimezoneStore() {
	const { subscribe, set } = writable<string>('UTC');

	async function init() {
		if (!browser) return;
		try {
			const res = await fetch('/api/v1/status');
			if (res.ok) {
				const data = await res.json();
				if (data.timezone) set(data.timezone);
			}
		} catch {
			// Fall back to UTC
		}
	}

	return { subscribe, init };
}

export const serverTimezone = createTimezoneStore();
