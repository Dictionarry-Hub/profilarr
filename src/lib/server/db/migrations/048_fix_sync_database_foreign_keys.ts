import type { Migration } from '#db/migrations.ts';

/**
 * Migration 048: Restore missing database_id foreign key on arr_sync_quality_profiles
 *
 * Migration 046 recreated the table but dropped the FK on database_id that
 * migration 029 had added. This means deleting a database doesn't cascade to
 * sync selections, leaving stale references.
 *
 * Also cleans up any stale rows referencing deleted databases.
 */

export const migration: Migration = {
	version: 48,
	name: 'Restore database_id FK on arr_sync_quality_profiles',

	up: `
		-- Remove stale references to deleted databases
		DELETE FROM arr_sync_quality_profiles
		WHERE database_id NOT IN (SELECT id FROM database_instances);

		-- Recreate with both FKs
		CREATE TABLE arr_sync_quality_profiles_new (
			instance_id INTEGER NOT NULL,
			database_id INTEGER NOT NULL,
			profile_name TEXT NOT NULL,
			PRIMARY KEY (instance_id, database_id, profile_name),
			FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE,
			FOREIGN KEY (database_id) REFERENCES database_instances(id) ON DELETE CASCADE
		);

		INSERT INTO arr_sync_quality_profiles_new
		SELECT * FROM arr_sync_quality_profiles;

		DROP TABLE arr_sync_quality_profiles;
		ALTER TABLE arr_sync_quality_profiles_new RENAME TO arr_sync_quality_profiles;
		CREATE INDEX idx_arr_sync_quality_profiles_instance ON arr_sync_quality_profiles(instance_id);
	`
};
