import type { Migration } from '#db/migrations.ts';

/**
 * Migration 024: Create arr_rename_settings table
 *
 * Creates the table for storing rename configuration per arr instance.
 * Each arr instance can have one rename config that controls bulk file/folder
 * renaming based on the Arr's naming format.
 *
 * Fields:
 * - id: Auto-incrementing primary key
 * - arr_instance_id: Foreign key to arr_instances (unique - one config per instance)
 * - dry_run: Preview changes without making them (default: true for safety)
 * - rename_folders: Also rename containing folders, not just files
 * - ignore_tag: Tag name to skip (items with this tag won't be renamed)
 * - enabled: Whether scheduled rename job is enabled
 * - schedule: Interval in minutes between rename runs (default: 24 hours)
 * - last_run_at: Timestamp of last job run
 * - created_at: Timestamp of creation
 * - updated_at: Timestamp of last update
 */

export const migration: Migration = {
	version: 24,
	name: 'Create arr_rename_settings table',

	up: `
		CREATE TABLE arr_rename_settings (
			id INTEGER PRIMARY KEY AUTOINCREMENT,

			-- Relationship
			arr_instance_id INTEGER NOT NULL UNIQUE,

			-- Settings
			dry_run INTEGER NOT NULL DEFAULT 1,
			rename_folders INTEGER NOT NULL DEFAULT 0,
			ignore_tag TEXT,

			-- Job scheduling
			enabled INTEGER NOT NULL DEFAULT 0,
			schedule INTEGER NOT NULL DEFAULT 1440,
			last_run_at DATETIME,

			-- Metadata
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

			FOREIGN KEY (arr_instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
		);

		CREATE INDEX idx_arr_rename_settings_arr_instance ON arr_rename_settings(arr_instance_id);
	`,

	down: `
		DROP INDEX IF EXISTS idx_arr_rename_settings_arr_instance;
		DROP TABLE IF EXISTS arr_rename_settings;
	`
};
