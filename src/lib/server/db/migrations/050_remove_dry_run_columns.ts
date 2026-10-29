import type { Migration } from '#db/migrations.ts';

/**
 * Migration 050: Remove dry_run columns from upgrade_configs and arr_rename_settings
 *
 * Dry run is now a per-run parameter (passed via job payload) rather than
 * a persistent config setting. The columns are no longer read or written.
 *
 * SQLite requires table recreation to drop columns.
 */

export const migration: Migration = {
	version: 50,
	name: 'Remove dry_run columns',

	up: `
		-- ===== upgrade_configs =====
		CREATE TABLE upgrade_configs_new (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			arr_instance_id INTEGER NOT NULL UNIQUE,
			enabled INTEGER NOT NULL DEFAULT 0,
			schedule INTEGER NOT NULL DEFAULT 360,
			filter_mode TEXT NOT NULL DEFAULT 'round_robin',
			filters TEXT NOT NULL DEFAULT '[]',
			current_filter_index INTEGER NOT NULL DEFAULT 0,
			last_run_at DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (arr_instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
		);

		INSERT INTO upgrade_configs_new
			(id, arr_instance_id, enabled, schedule, filter_mode, filters,
			 current_filter_index, last_run_at, created_at, updated_at)
		SELECT id, arr_instance_id, enabled, schedule, filter_mode, filters,
			   current_filter_index, last_run_at, created_at, updated_at
		FROM upgrade_configs;

		DROP TABLE upgrade_configs;
		ALTER TABLE upgrade_configs_new RENAME TO upgrade_configs;
		CREATE INDEX idx_upgrade_configs_arr_instance ON upgrade_configs(arr_instance_id);

		-- ===== arr_rename_settings =====
		CREATE TABLE arr_rename_settings_new (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			arr_instance_id INTEGER NOT NULL UNIQUE,
			rename_folders INTEGER NOT NULL DEFAULT 0,
			ignore_tag TEXT,
			summary_notifications INTEGER NOT NULL DEFAULT 1,
			enabled INTEGER NOT NULL DEFAULT 0,
			schedule INTEGER NOT NULL DEFAULT 1440,
			last_run_at DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (arr_instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
		);

		INSERT INTO arr_rename_settings_new
			(id, arr_instance_id, rename_folders, ignore_tag, summary_notifications,
			 enabled, schedule, last_run_at, created_at, updated_at)
		SELECT id, arr_instance_id, rename_folders, ignore_tag, summary_notifications,
			   enabled, schedule, last_run_at, created_at, updated_at
		FROM arr_rename_settings;

		DROP TABLE arr_rename_settings;
		ALTER TABLE arr_rename_settings_new RENAME TO arr_rename_settings;
		CREATE INDEX idx_arr_rename_settings_arr_instance ON arr_rename_settings(arr_instance_id);
	`,

	down: `
		ALTER TABLE upgrade_configs ADD COLUMN dry_run INTEGER NOT NULL DEFAULT 0;
		ALTER TABLE arr_rename_settings ADD COLUMN dry_run INTEGER NOT NULL DEFAULT 1;
	`
};
