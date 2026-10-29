import type { Migration } from '#db/migrations.ts';

/**
 * Migration 012: Add last_run_at to upgrade_configs
 *
 * Adds timestamp tracking for when each upgrade config was last executed.
 * Used by the upgrade manager job to determine if enough time has passed
 * based on the config's schedule.
 */

export const migration: Migration = {
	version: 12,
	name: 'Add last_run_at to upgrade_configs',

	up: `
		ALTER TABLE upgrade_configs
		ADD COLUMN last_run_at DATETIME;
	`,

	down: `
		-- SQLite doesn't support DROP COLUMN easily, so we recreate the table
		CREATE TABLE upgrade_configs_backup (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			arr_instance_id INTEGER NOT NULL UNIQUE,
			enabled INTEGER NOT NULL DEFAULT 0,
			schedule INTEGER NOT NULL DEFAULT 360,
			filter_mode TEXT NOT NULL DEFAULT 'round_robin',
			filters TEXT NOT NULL DEFAULT '[]',
			current_filter_index INTEGER NOT NULL DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (arr_instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
		);

		INSERT INTO upgrade_configs_backup
		SELECT id, arr_instance_id, enabled, schedule, filter_mode, filters,
		       current_filter_index, created_at, updated_at
		FROM upgrade_configs;

		DROP TABLE upgrade_configs;

		ALTER TABLE upgrade_configs_backup RENAME TO upgrade_configs;

		CREATE INDEX idx_upgrade_configs_arr_instance ON upgrade_configs(arr_instance_id);
	`
};
