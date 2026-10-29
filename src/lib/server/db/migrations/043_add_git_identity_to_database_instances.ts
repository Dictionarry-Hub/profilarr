import type { Migration } from '#db/migrations.ts';

/**
 * Migration 043: Add git_user_name and git_user_email to database_instances
 *
 * Stores per-database Git identity for commit authoring.
 */

export const migration: Migration = {
	version: 43,
	name: 'Add git_user_name and git_user_email to database_instances',

	up: `
		ALTER TABLE database_instances
		ADD COLUMN git_user_name TEXT;

		ALTER TABLE database_instances
		ADD COLUMN git_user_email TEXT;
	`,

	down: `
		-- SQLite doesn't support DROP COLUMN easily, so we recreate the table
		CREATE TABLE database_instances_backup (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			uuid TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL UNIQUE,
			repository_url TEXT NOT NULL,
			personal_access_token TEXT,
			is_private INTEGER NOT NULL DEFAULT 0,
			local_ops_enabled INTEGER NOT NULL DEFAULT 0,
			local_path TEXT NOT NULL,
			sync_strategy INTEGER NOT NULL DEFAULT 0,
			auto_pull INTEGER NOT NULL DEFAULT 0,
			enabled INTEGER NOT NULL DEFAULT 1,
			last_synced_at DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		INSERT INTO database_instances_backup
		SELECT id, uuid, name, repository_url, personal_access_token, is_private,
		       local_ops_enabled, local_path, sync_strategy, auto_pull, enabled,
		       last_synced_at, created_at, updated_at
		FROM database_instances;

		DROP TABLE database_instances;

		ALTER TABLE database_instances_backup RENAME TO database_instances;

		CREATE INDEX idx_database_instances_uuid ON database_instances(uuid);
	`
};
