import type { Migration } from '#db/migrations.ts';

/**
 * Migration 053: Add library refresh columns to arr_instances
 *
 * Adds per-instance library cache refresh interval and tracking.
 * interval=0 means manual refresh only, >0 means auto-refresh every X minutes.
 */

export const migration: Migration = {
	version: 53,
	name: 'Add library refresh to arr_instances',

	up: `
		ALTER TABLE arr_instances ADD COLUMN library_refresh_interval INTEGER NOT NULL DEFAULT 0;
		ALTER TABLE arr_instances ADD COLUMN library_last_refreshed_at TEXT;
	`,

	down: `
		ALTER TABLE arr_instances DROP COLUMN library_refresh_interval;
		ALTER TABLE arr_instances DROP COLUMN library_last_refreshed_at;
	`
};
