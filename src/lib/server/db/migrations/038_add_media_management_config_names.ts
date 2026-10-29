import type { Migration } from '#db/migrations.ts';

/**
 * Migration 038: Add config name columns to arr_sync_media_management
 *
 * With multi-config support, each database can have multiple naming, quality definitions,
 * and media settings configs. We need to store which specific config to use, not just
 * which database.
 *
 * Adds:
 * - naming_config_name: Name of the naming config to sync
 * - quality_definitions_config_name: Name of the quality definitions config to sync
 * - media_settings_config_name: Name of the media settings config to sync
 */

export const migration: Migration = {
	version: 38,
	name: 'Add media management config names',

	up: `
		ALTER TABLE arr_sync_media_management ADD COLUMN naming_config_name TEXT;
		ALTER TABLE arr_sync_media_management ADD COLUMN quality_definitions_config_name TEXT;
		ALTER TABLE arr_sync_media_management ADD COLUMN media_settings_config_name TEXT;
	`,

	down: `
		-- SQLite doesn't support DROP COLUMN directly, so we recreate the table
		CREATE TABLE arr_sync_media_management_new (
			instance_id INTEGER PRIMARY KEY,
			naming_database_id INTEGER,
			quality_definitions_database_id INTEGER,
			media_settings_database_id INTEGER,
			trigger TEXT NOT NULL DEFAULT 'none',
			cron TEXT,
			should_sync INTEGER NOT NULL DEFAULT 0,
			next_run_at TEXT,
			sync_status TEXT NOT NULL DEFAULT 'idle',
			last_error TEXT,
			last_synced_at TEXT,
			FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE,
			FOREIGN KEY (naming_database_id) REFERENCES database_instances(id) ON DELETE SET NULL,
			FOREIGN KEY (quality_definitions_database_id) REFERENCES database_instances(id) ON DELETE SET NULL,
			FOREIGN KEY (media_settings_database_id) REFERENCES database_instances(id) ON DELETE SET NULL
		);

		INSERT INTO arr_sync_media_management_new (
			instance_id, naming_database_id, quality_definitions_database_id,
			media_settings_database_id, trigger, cron, should_sync, next_run_at,
			sync_status, last_error, last_synced_at
		)
		SELECT
			instance_id, naming_database_id, quality_definitions_database_id,
			media_settings_database_id, trigger, cron, should_sync, next_run_at,
			sync_status, last_error, last_synced_at
		FROM arr_sync_media_management;

		DROP TABLE arr_sync_media_management;
		ALTER TABLE arr_sync_media_management_new RENAME TO arr_sync_media_management;
	`
};
