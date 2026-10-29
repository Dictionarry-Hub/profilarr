import type { Migration } from '#db/migrations.ts';

/**
 * Migration 022: Add next_run_at to sync config tables
 *
 * Stores when each scheduled config should next trigger.
 * Enables simple timestamp comparison instead of cron parsing on every evaluation.
 */

export const migration: Migration = {
	version: 22,
	name: 'Add next_run_at to sync configs',

	up: `
		ALTER TABLE arr_sync_quality_profiles_config ADD COLUMN next_run_at TEXT;
		ALTER TABLE arr_sync_delay_profiles_config ADD COLUMN next_run_at TEXT;
		ALTER TABLE arr_sync_media_management ADD COLUMN next_run_at TEXT;
	`,

	down: `
		ALTER TABLE arr_sync_quality_profiles_config DROP COLUMN next_run_at;
		ALTER TABLE arr_sync_delay_profiles_config DROP COLUMN next_run_at;
		ALTER TABLE arr_sync_media_management DROP COLUMN next_run_at;
	`
};
