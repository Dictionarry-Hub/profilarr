import type { Migration } from '#db/migrations.ts';

/**
 * Migration 011: Create upgrade_configs table
 *
 * Creates the table for storing upgrade configuration per arr instance.
 * Each arr instance can have one upgrade config that controls automatic
 * quality upgrade searching.
 *
 * Fields:
 * - id: Auto-incrementing primary key
 * - arr_instance_id: Foreign key to arr_instances (unique - one config per instance)
 * - enabled: Whether upgrade searching is enabled
 * - schedule: Interval in minutes between upgrade runs
 * - filter_mode: How to cycle through filters ('round_robin' | 'random')
 * - filters: JSON array of FilterConfig objects
 * - current_filter_index: Tracks position for round-robin mode
 * - created_at: Timestamp of creation
 * - updated_at: Timestamp of last update
 */

export const migration: Migration = {
	version: 11,
	name: 'Create upgrade_configs table',

	up: `
		CREATE TABLE upgrade_configs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,

			-- Relationship
			arr_instance_id INTEGER NOT NULL UNIQUE,

			-- Core settings
			enabled INTEGER NOT NULL DEFAULT 0,
			schedule INTEGER NOT NULL DEFAULT 360,
			filter_mode TEXT NOT NULL DEFAULT 'round_robin',

			-- Filters (stored as JSON)
			filters TEXT NOT NULL DEFAULT '[]',

			-- State tracking
			current_filter_index INTEGER NOT NULL DEFAULT 0,

			-- Metadata
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

			FOREIGN KEY (arr_instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
		);

		CREATE INDEX idx_upgrade_configs_arr_instance ON upgrade_configs(arr_instance_id);
	`,

	down: `
		DROP INDEX IF EXISTS idx_upgrade_configs_arr_instance;
		DROP TABLE IF EXISTS upgrade_configs;
	`
};
