/**
 * Server timezone store.
 *
 * Holds the IANA timezone string from the server's TZ configuration.
 * Set once from layout server data. All date display in the UI uses
 * this value for timezone conversion.
 */

import { writable } from 'svelte/store';

function createTimezoneStore() {
	const { subscribe, set } = writable<string>('UTC');

	return {
		subscribe,
		set
	};
}

export const serverTimezone = createTimezoneStore();
