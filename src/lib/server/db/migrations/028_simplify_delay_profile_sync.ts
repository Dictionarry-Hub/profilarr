import type { Migration } from '#db/migrations.ts';

/**
 * Migration 028: Simplify delay profile sync to single profile
 *
 * Only one delay profile can be synced per arr instance (updates id=1).
 */

export const migration: Migration = {
	version: 28,
	name: 'Simplify delay profile sync to single profile',

	up: `
		-- Drop the multi-select table
		DROP INDEX IF EXISTS idx_arr_sync_delay_profiles_instance;
		DROP TABLE IF EXISTS arr_sync_delay_profiles;

		-- Add single profile reference to config table
		ALTER TABLE arr_sync_delay_profiles_config ADD COLUMN database_id INTEGER;
		ALTER TABLE arr_sync_delay_profiles_config ADD COLUMN profile_id INTEGER;
	`,

	down: `
		-- Recreate multi-select table
		CREATE TABLE arr_sync_delay_profiles (
			instance_id INTEGER NOT NULL,
			database_id INTEGER NOT NULL,
			profile_id INTEGER NOT NULL,
			PRIMARY KEY (instance_id, database_id, profile_id),
			FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
		);
		CREATE INDEX idx_arr_sync_delay_profiles_instance ON arr_sync_delay_profiles(instance_id);

		-- Note: Cannot easily remove columns in SQLite, leaving them
	`
};
