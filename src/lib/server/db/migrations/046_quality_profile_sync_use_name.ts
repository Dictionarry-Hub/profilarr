import type { Migration } from '#db/migrations.ts';

/**
 * Migration 046: Change quality profile sync to use profile_name instead of profile_id
 *
 * The PCD schema uses name as the stable key for quality profiles. The sync table
 * was using the ephemeral auto-increment id, which could break across cache rebuilds.
 *
 * Since we can't look up profile names from the PCD cache at migration time,
 * existing selections are dropped. Users will need to re-select their quality
 * profiles in sync config once.
 */

export const migration: Migration = {
	version: 46,
	name: 'Change quality profile sync to use profile_name',

	up: `
		CREATE TABLE arr_sync_quality_profiles_new (
			instance_id INTEGER NOT NULL,
			database_id INTEGER NOT NULL,
			profile_name TEXT NOT NULL,
			PRIMARY KEY (instance_id, database_id, profile_name),
			FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
		);

		DROP TABLE arr_sync_quality_profiles;
		ALTER TABLE arr_sync_quality_profiles_new RENAME TO arr_sync_quality_profiles;
		CREATE INDEX idx_arr_sync_quality_profiles_instance ON arr_sync_quality_profiles(instance_id);
	`
};
