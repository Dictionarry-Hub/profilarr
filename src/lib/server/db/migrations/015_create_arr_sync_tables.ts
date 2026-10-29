import type { Migration } from '#db/migrations.ts';

/**
 * Migration 015: Create arr sync tables
 *
 * Creates tables for storing sync configuration per arr instance.
 * - Quality profile selections and trigger config
 * - Delay profile selections and trigger config
 * - Media management settings and trigger config
 *
 * Trigger types: 'none' | 'manual' | 'on_pull' | 'on_change' | 'schedule'
 */

export const migration: Migration = {
	version: 15,
	name: 'Create arr sync tables',

	up: `
		-- Quality profile selections (many-to-many)
		CREATE TABLE arr_sync_quality_profiles (
			instance_id INTEGER NOT NULL,
			database_id INTEGER NOT NULL,
			profile_id INTEGER NOT NULL,
			PRIMARY KEY (instance_id, database_id, profile_id),
			FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
		);

		-- Quality profile trigger config (one per instance)
		CREATE TABLE arr_sync_quality_profiles_config (
			instance_id INTEGER PRIMARY KEY,
			trigger TEXT NOT NULL DEFAULT 'none',
			cron TEXT,
			FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
		);

		-- Delay profile selections (many-to-many)
		CREATE TABLE arr_sync_delay_profiles (
			instance_id INTEGER NOT NULL,
			database_id INTEGER NOT NULL,
			profile_id INTEGER NOT NULL,
			PRIMARY KEY (instance_id, database_id, profile_id),
			FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
		);

		-- Delay profile trigger config (one per instance)
		CREATE TABLE arr_sync_delay_profiles_config (
			instance_id INTEGER PRIMARY KEY,
			trigger TEXT NOT NULL DEFAULT 'none',
			cron TEXT,
			FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
		);

		-- Media management (one row per instance)
		CREATE TABLE arr_sync_media_management (
			instance_id INTEGER PRIMARY KEY,
			naming_database_id INTEGER,
			quality_definitions_database_id INTEGER,
			media_settings_database_id INTEGER,
			trigger TEXT NOT NULL DEFAULT 'none',
			cron TEXT,
			FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE
		);

		-- Indexes for faster lookups
		CREATE INDEX idx_arr_sync_quality_profiles_instance ON arr_sync_quality_profiles(instance_id);
		CREATE INDEX idx_arr_sync_delay_profiles_instance ON arr_sync_delay_profiles(instance_id);
	`,

	down: `
		DROP INDEX IF EXISTS idx_arr_sync_delay_profiles_instance;
		DROP INDEX IF EXISTS idx_arr_sync_quality_profiles_instance;
		DROP TABLE IF EXISTS arr_sync_media_management;
		DROP TABLE IF EXISTS arr_sync_delay_profiles_config;
		DROP TABLE IF EXISTS arr_sync_delay_profiles;
		DROP TABLE IF EXISTS arr_sync_quality_profiles_config;
		DROP TABLE IF EXISTS arr_sync_quality_profiles;
	`
};
