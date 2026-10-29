import type { Migration } from '#db/migrations.ts';

/**
 * Migration 076: Add a quality definitions override to arr_sync_quality_profiles
 *
 * Sonarr v5 keeps quality size limits on each quality profile, so a synced
 * profile can take its sizes from a quality definitions config of its own
 * instead of the instance-wide selection in arr_sync_media_management. The
 * config must come from the same database as the profile, which the row
 * already names, so only the config name is stored. NULL means "use the
 * instance's selection". Ignored on Arrs that keep sizes globally.
 */

export const migration: Migration = {
	version: 76,
	name: 'Add quality definitions override to arr_sync_quality_profiles',

	up: `
		ALTER TABLE arr_sync_quality_profiles ADD COLUMN quality_definitions_config_name TEXT;
	`,

	down: `
		ALTER TABLE arr_sync_quality_profiles DROP COLUMN quality_definitions_config_name;
	`
};
