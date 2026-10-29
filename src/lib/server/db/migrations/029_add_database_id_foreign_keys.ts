import type { Migration } from '#db/migrations.ts';

/**
 * Migration 029: Add foreign key constraints for database_id columns
 *
 * Fixes orphaned sync config entries when databases are deleted.
 * SQLite requires recreating tables to add foreign keys.
 *
 * Tables affected:
 * - arr_sync_quality_profiles: CASCADE DELETE (remove sync selections)
 * - arr_sync_delay_profiles_config: SET NULL (keep config, clear reference)
 * - arr_sync_media_management: SET NULL (keep config, clear references)
 */

export const migration: Migration = {
	version: 29,
	name: 'Add database_id foreign key constraints',

	up: `
		-- ============================================================
		-- arr_sync_quality_profiles: Add FK with CASCADE DELETE
		-- ============================================================

		-- Create new table with foreign key
		CREATE TABLE arr_sync_quality_profiles_new (
			instance_id INTEGER NOT NULL,
			database_id INTEGER NOT NULL,
			profile_id INTEGER NOT NULL,
			PRIMARY KEY (instance_id, database_id, profile_id),
			FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE,
			FOREIGN KEY (database_id) REFERENCES database_instances(id) ON DELETE CASCADE
		);

		-- Copy only valid data (where database still exists)
		INSERT INTO arr_sync_quality_profiles_new (instance_id, database_id, profile_id)
		SELECT qp.instance_id, qp.database_id, qp.profile_id
		FROM arr_sync_quality_profiles qp
		INNER JOIN database_instances di ON qp.database_id = di.id;

		-- Drop old table and rename
		DROP TABLE arr_sync_quality_profiles;
		ALTER TABLE arr_sync_quality_profiles_new RENAME TO arr_sync_quality_profiles;

		-- Recreate index
		CREATE INDEX idx_arr_sync_quality_profiles_instance ON arr_sync_quality_profiles(instance_id);

		-- ============================================================
		-- arr_sync_delay_profiles_config: Add FK with SET NULL
		-- ============================================================

		-- Create new table with foreign key
		CREATE TABLE arr_sync_delay_profiles_config_new (
			instance_id INTEGER PRIMARY KEY,
			trigger TEXT NOT NULL DEFAULT 'none',
			cron TEXT,
			should_sync INTEGER NOT NULL DEFAULT 0,
			next_run_at TEXT,
			database_id INTEGER,
			profile_id INTEGER,
			FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE,
			FOREIGN KEY (database_id) REFERENCES database_instances(id) ON DELETE SET NULL
		);

		-- Copy data, setting database_id to NULL if database doesn't exist
		INSERT INTO arr_sync_delay_profiles_config_new (instance_id, trigger, cron, should_sync, next_run_at, database_id, profile_id)
		SELECT
			dpc.instance_id,
			dpc.trigger,
			dpc.cron,
			dpc.should_sync,
			dpc.next_run_at,
			CASE WHEN di.id IS NOT NULL THEN dpc.database_id ELSE NULL END,
			CASE WHEN di.id IS NOT NULL THEN dpc.profile_id ELSE NULL END
		FROM arr_sync_delay_profiles_config dpc
		LEFT JOIN database_instances di ON dpc.database_id = di.id;

		-- Drop old table and rename
		DROP TABLE arr_sync_delay_profiles_config;
		ALTER TABLE arr_sync_delay_profiles_config_new RENAME TO arr_sync_delay_profiles_config;

		-- ============================================================
		-- arr_sync_media_management: Add FKs with SET NULL
		-- ============================================================

		-- Create new table with foreign keys
		CREATE TABLE arr_sync_media_management_new (
			instance_id INTEGER PRIMARY KEY,
			naming_database_id INTEGER,
			quality_definitions_database_id INTEGER,
			media_settings_database_id INTEGER,
			trigger TEXT NOT NULL DEFAULT 'none',
			cron TEXT,
			should_sync INTEGER NOT NULL DEFAULT 0,
			next_run_at TEXT,
			FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE,
			FOREIGN KEY (naming_database_id) REFERENCES database_instances(id) ON DELETE SET NULL,
			FOREIGN KEY (quality_definitions_database_id) REFERENCES database_instances(id) ON DELETE SET NULL,
			FOREIGN KEY (media_settings_database_id) REFERENCES database_instances(id) ON DELETE SET NULL
		);

		-- Copy data, setting database_ids to NULL if databases don't exist
		INSERT INTO arr_sync_media_management_new (
			instance_id, naming_database_id, quality_definitions_database_id,
			media_settings_database_id, trigger, cron, should_sync, next_run_at
		)
		SELECT
			mm.instance_id,
			CASE WHEN di1.id IS NOT NULL THEN mm.naming_database_id ELSE NULL END,
			CASE WHEN di2.id IS NOT NULL THEN mm.quality_definitions_database_id ELSE NULL END,
			CASE WHEN di3.id IS NOT NULL THEN mm.media_settings_database_id ELSE NULL END,
			mm.trigger,
			mm.cron,
			mm.should_sync,
			mm.next_run_at
		FROM arr_sync_media_management mm
		LEFT JOIN database_instances di1 ON mm.naming_database_id = di1.id
		LEFT JOIN database_instances di2 ON mm.quality_definitions_database_id = di2.id
		LEFT JOIN database_instances di3 ON mm.media_settings_database_id = di3.id;

		-- Drop old table and rename
		DROP TABLE arr_sync_media_management;
		ALTER TABLE arr_sync_media_management_new RENAME TO arr_sync_media_management;
	`,

	down: `
		-- Recreate tables without database_id foreign keys
		-- (Cannot easily remove FK constraints in SQLite)

		-- arr_sync_quality_profiles
		CREATE TABLE arr_sync_quality_profiles_new (
			instance_id INTEGER NOT NULL,
			database_id INTEGER NOT NULL,
			profile_id INTEGER NOT NULL,
			PRIMARY KEY (instance_id, database_id, profile_id),
			FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
		);
		INSERT INTO arr_sync_quality_profiles_new SELECT * FROM arr_sync_quality_profiles;
		DROP TABLE arr_sync_quality_profiles;
		ALTER TABLE arr_sync_quality_profiles_new RENAME TO arr_sync_quality_profiles;
		CREATE INDEX idx_arr_sync_quality_profiles_instance ON arr_sync_quality_profiles(instance_id);

		-- arr_sync_delay_profiles_config
		CREATE TABLE arr_sync_delay_profiles_config_new (
			instance_id INTEGER PRIMARY KEY,
			trigger TEXT NOT NULL DEFAULT 'none',
			cron TEXT,
			should_sync INTEGER NOT NULL DEFAULT 0,
			next_run_at TEXT,
			database_id INTEGER,
			profile_id INTEGER,
			FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
		);
		INSERT INTO arr_sync_delay_profiles_config_new SELECT * FROM arr_sync_delay_profiles_config;
		DROP TABLE arr_sync_delay_profiles_config;
		ALTER TABLE arr_sync_delay_profiles_config_new RENAME TO arr_sync_delay_profiles_config;

		-- arr_sync_media_management
		CREATE TABLE arr_sync_media_management_new (
			instance_id INTEGER PRIMARY KEY,
			naming_database_id INTEGER,
			quality_definitions_database_id INTEGER,
			media_settings_database_id INTEGER,
			trigger TEXT NOT NULL DEFAULT 'none',
			cron TEXT,
			should_sync INTEGER NOT NULL DEFAULT 0,
			next_run_at TEXT,
			FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
		);
		INSERT INTO arr_sync_media_management_new SELECT * FROM arr_sync_media_management;
		DROP TABLE arr_sync_media_management;
		ALTER TABLE arr_sync_media_management_new RENAME TO arr_sync_media_management;
	`
};
