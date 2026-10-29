import type { Migration } from '#db/migrations.ts';

/**
 * Migration 016: Add should_sync flags to sync config tables
 *
 * Adds a should_sync boolean to each sync config table.
 * This flag is set to true when a sync should be triggered
 * (based on trigger type: on_pull, on_change, schedule).
 * The sync job checks this flag and syncs when true, then resets it.
 */

export const migration: Migration = {
	version: 16,
	name: 'Add should_sync flags',

	up: `
		ALTER TABLE arr_sync_quality_profiles_config ADD COLUMN should_sync INTEGER NOT NULL DEFAULT 0;
		ALTER TABLE arr_sync_delay_profiles_config ADD COLUMN should_sync INTEGER NOT NULL DEFAULT 0;
		ALTER TABLE arr_sync_media_management ADD COLUMN should_sync INTEGER NOT NULL DEFAULT 0;
	`,

	down: `
		ALTER TABLE arr_sync_quality_profiles_config DROP COLUMN should_sync;
		ALTER TABLE arr_sync_delay_profiles_config DROP COLUMN should_sync;
		ALTER TABLE arr_sync_media_management DROP COLUMN should_sync;
	`
};
