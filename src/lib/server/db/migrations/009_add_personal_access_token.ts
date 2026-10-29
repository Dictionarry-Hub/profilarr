import type { Migration } from '#db/migrations.ts';

/**
 * Migration 009: Add personal_access_token to database_instances
 *
 * Adds support for Personal Access Tokens (PAT) to enable:
 * - Cloning private repositories
 * - Push access for developers working on database content
 */

export const migration: Migration = {
	version: 9,
	name: 'Add personal_access_token to database_instances',

	up: `
		ALTER TABLE database_instances
		ADD COLUMN personal_access_token TEXT;
	`,

	down: `
		-- SQLite doesn't support DROP COLUMN easily, so we recreate the table
		CREATE TABLE database_instances_backup (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			uuid TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL UNIQUE,
			repository_url TEXT NOT NULL,
			local_path TEXT NOT NULL,
			sync_strategy INTEGER NOT NULL DEFAULT 0,
			auto_pull INTEGER NOT NULL DEFAULT 0,
			enabled INTEGER NOT NULL DEFAULT 1,
			last_synced_at DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		INSERT INTO database_instances_backup
		SELECT id, uuid, name, repository_url, local_path, sync_strategy,
		       auto_pull, enabled, last_synced_at, created_at, updated_at
		FROM database_instances;

		DROP TABLE database_instances;

		ALTER TABLE database_instances_backup RENAME TO database_instances;

		CREATE INDEX idx_database_instances_uuid ON database_instances(uuid);
	`
};
