import type { Migration } from '#db/migrations.ts';

/**
 * Migration 008: Create database_instances table
 *
 * Creates the table for storing linked Profilarr Compliant Database (PCD) repositories.
 * These databases contain configuration profiles that can be synced to arr instances.
 *
 * Fields:
 * - id: Auto-incrementing primary key
 * - uuid: Unique identifier used for filesystem storage path
 * - name: User-friendly name (unique)
 * - repository_url: Git repository URL
 * - local_path: Path where the repository is cloned (data/databases/{uuid})
 * - sync_strategy: 0 = manual check, >0 = auto-check every X minutes
 * - auto_pull: 0 = notify only, 1 = auto-pull updates
 * - enabled: Boolean flag (1=enabled, 0=disabled)
 * - last_synced_at: Timestamp of last successful sync
 * - created_at: Timestamp of creation
 * - updated_at: Timestamp of last update
 */

export const migration: Migration = {
	version: 8,
	name: 'Create database_instances table',

	up: `
		CREATE TABLE database_instances (
			id INTEGER PRIMARY KEY AUTOINCREMENT,

			-- Instance identification
			uuid TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL UNIQUE,

			-- Repository connection
			repository_url TEXT NOT NULL,

			-- Local storage
			local_path TEXT NOT NULL,

			-- Sync settings
			sync_strategy INTEGER NOT NULL DEFAULT 0,
			auto_pull INTEGER NOT NULL DEFAULT 0,

			-- Status
			enabled INTEGER NOT NULL DEFAULT 1,
			last_synced_at DATETIME,

			-- Metadata
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		-- Index for looking up by UUID
		CREATE INDEX idx_database_instances_uuid ON database_instances(uuid);
	`,

	down: `
		DROP INDEX IF EXISTS idx_database_instances_uuid;
		DROP TABLE IF EXISTS database_instances;
	`
};
