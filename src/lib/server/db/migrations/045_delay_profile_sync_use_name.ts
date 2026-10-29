import type { Migration } from '#db/migrations.ts';

/**
 * Migration 045: Change delay profile sync to use profile_name instead of profile_id
 *
 * The PCD schema uses name as the stable key for delay profiles. The sync table
 * was using the ephemeral auto-increment id, which could break across cache rebuilds.
 * This aligns delay profile sync with the media management pattern (config_name TEXT).
 *
 * Since we can't look up profile names from the PCD cache at migration time,
 * existing profile_id references are dropped. Users will need to re-select
 * their delay profile in sync config once.
 */

export const migration: Migration = {
	version: 45,
	name: 'Change delay profile sync to use profile_name',

	up: `
		CREATE TABLE arr_sync_delay_profiles_config_new (
			instance_id INTEGER PRIMARY KEY,
			trigger TEXT NOT NULL DEFAULT 'none',
			cron TEXT,
			should_sync INTEGER NOT NULL DEFAULT 0,
			next_run_at TEXT,
			database_id INTEGER,
			profile_name TEXT,
			sync_status TEXT NOT NULL DEFAULT 'idle',
			last_error TEXT,
			last_synced_at TEXT,
			FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE,
			FOREIGN KEY (database_id) REFERENCES database_instances(id) ON DELETE SET NULL
		);

		INSERT INTO arr_sync_delay_profiles_config_new (
			instance_id, trigger, cron, should_sync, next_run_at,
			database_id, profile_name, sync_status, last_error, last_synced_at
		)
		SELECT
			instance_id, trigger, cron, should_sync, next_run_at,
			database_id, NULL, sync_status, last_error, last_synced_at
		FROM arr_sync_delay_profiles_config;

		DROP TABLE arr_sync_delay_profiles_config;
		ALTER TABLE arr_sync_delay_profiles_config_new RENAME TO arr_sync_delay_profiles_config;
	`
};
