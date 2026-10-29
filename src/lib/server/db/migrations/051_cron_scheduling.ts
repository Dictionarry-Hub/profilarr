import type { Migration } from '#db/migrations.ts';

/**
 * Migration 051: Replace schedule INTEGER with cron TEXT + next_run_at TEXT
 *
 * Upgrades and renames move from fixed minute intervals to cron-based scheduling,
 * matching the pattern already used by arr syncs.
 *
 * Existing minute values are converted to equivalent cron expressions.
 */

export const migration: Migration = {
	version: 51,
	name: 'Cron scheduling for upgrades and renames',

	up: `
		-- ===== upgrade_configs =====
		CREATE TABLE upgrade_configs_new (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			arr_instance_id INTEGER NOT NULL UNIQUE,
			enabled INTEGER NOT NULL DEFAULT 0,
			cron TEXT NOT NULL DEFAULT '0 */6 * * *',
			next_run_at TEXT,
			filter_mode TEXT NOT NULL DEFAULT 'round_robin',
			filters TEXT NOT NULL DEFAULT '[]',
			current_filter_index INTEGER NOT NULL DEFAULT 0,
			last_run_at DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (arr_instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
		);

		INSERT INTO upgrade_configs_new
			(id, arr_instance_id, enabled, cron, next_run_at, filter_mode, filters,
			 current_filter_index, last_run_at, created_at, updated_at)
		SELECT id, arr_instance_id, enabled,
			CASE
				WHEN schedule <= 60 THEN '*/' || schedule || ' * * * *'
				WHEN schedule = 1440 THEN '0 0 * * *'
				WHEN schedule = 2880 THEN '0 0 */2 * *'
				WHEN schedule = 10080 THEN '0 0 * * 0'
				ELSE '0 */' || (schedule / 60) || ' * * *'
			END,
			NULL, filter_mode, filters,
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
			cron TEXT NOT NULL DEFAULT '0 0 * * *',
			next_run_at TEXT,
			last_run_at DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (arr_instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
		);

		INSERT INTO arr_rename_settings_new
			(id, arr_instance_id, rename_folders, ignore_tag, summary_notifications,
			 enabled, cron, next_run_at, last_run_at, created_at, updated_at)
		SELECT id, arr_instance_id, rename_folders, ignore_tag, summary_notifications,
			enabled,
			CASE
				WHEN schedule <= 60 THEN '*/' || schedule || ' * * * *'
				WHEN schedule = 1440 THEN '0 0 * * *'
				WHEN schedule = 2880 THEN '0 0 */2 * *'
				WHEN schedule = 10080 THEN '0 0 * * 0'
				ELSE '0 */' || (schedule / 60) || ' * * *'
			END,
			NULL, last_run_at, created_at, updated_at
		FROM arr_rename_settings;

		DROP TABLE arr_rename_settings;
		ALTER TABLE arr_rename_settings_new RENAME TO arr_rename_settings;
		CREATE INDEX idx_arr_rename_settings_arr_instance ON arr_rename_settings(arr_instance_id);

		-- ===== upgrade_runs: rename schedule column to cron =====
		ALTER TABLE upgrade_runs RENAME COLUMN schedule TO cron;
	`,

	down: `
		-- Reverting requires table recreation to add schedule back
		-- This is a simplified rollback that adds the column with default
		ALTER TABLE upgrade_configs ADD COLUMN schedule INTEGER NOT NULL DEFAULT 360;
		ALTER TABLE arr_rename_settings ADD COLUMN schedule INTEGER NOT NULL DEFAULT 1440;
	`
};
