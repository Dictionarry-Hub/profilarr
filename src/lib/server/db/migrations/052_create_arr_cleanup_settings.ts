import type { Migration } from '#db/migrations.ts';

/**
 * Migration 052: Create arr_cleanup_settings table
 *
 * Stores per-instance cleanup scheduling config.
 * Cleanup removes stale synced configs and media flagged as removed from TMDB/TVDB.
 */

export const migration: Migration = {
	version: 52,
	name: 'Create arr_cleanup_settings table',

	up: `
		CREATE TABLE arr_cleanup_settings (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			arr_instance_id INTEGER NOT NULL UNIQUE,
			enabled INTEGER NOT NULL DEFAULT 0,
			cron TEXT NOT NULL DEFAULT '0 0 * * 0',
			next_run_at TEXT,
			last_run_at TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (arr_instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
		);

		CREATE INDEX idx_arr_cleanup_settings_instance ON arr_cleanup_settings(arr_instance_id);
	`,

	down: `
		DROP INDEX IF EXISTS idx_arr_cleanup_settings_instance;
		DROP TABLE IF EXISTS arr_cleanup_settings;
	`
};
