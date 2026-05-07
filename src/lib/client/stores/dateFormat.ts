/**
 * Date format preference store.
 *
 * Holds the app-wide date display format from general settings. Set once from
 * layout server data and used with serverTimezone for all date display.
 */

import { writable } from 'svelte/store';
import type { DateFormat } from '$shared/utils/dates.ts';

function createDateFormatStore() {
	const { subscribe, set } = writable<DateFormat>('auto');

	return {
		subscribe,
		set
	};
}

export const dateFormat = createDateFormatStore();
