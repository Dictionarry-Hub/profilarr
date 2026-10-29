import type { Migration } from '#db/migrations.ts';

/**
 * Migration 013: Add dry_run to upgrade_configs
 *
 * Adds a dry_run flag that allows running upgrade jobs in test mode.
 * When enabled, the job will log what it would do without actually
 * triggering searches in the arr instance.
 */

export const migration: Migration = {
	version: 13,
	name: 'Add dry_run to upgrade_configs',

	up: `
		ALTER TABLE upgrade_configs
		ADD COLUMN dry_run INTEGER NOT NULL DEFAULT 0;
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
			last_run_at DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (arr_instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
		);

		INSERT INTO upgrade_configs_backup
		SELECT id, arr_instance_id, enabled, schedule, filter_mode, filters,
		       current_filter_index, last_run_at, created_at, updated_at
		FROM upgrade_configs;

		DROP TABLE upgrade_configs;

		ALTER TABLE upgrade_configs_backup RENAME TO upgrade_configs;

		CREATE INDEX idx_upgrade_configs_arr_instance ON upgrade_configs(arr_instance_id);
	`
};
