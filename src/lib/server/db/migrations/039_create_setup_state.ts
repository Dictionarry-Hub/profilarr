import type { Migration } from '#db/migrations.ts';

/**
 * Migration 039: Create setup_state table
 *
 * Tracks one-time setup operations like auto-linking the default database.
 * Uses singleton pattern (id=1) to ensure only one row exists.
 */

export const migration: Migration = {
	version: 39,
	name: 'Create setup_state table',

	up: `
		CREATE TABLE setup_state (
			id INTEGER PRIMARY KEY CHECK (id = 1),
			default_database_linked INTEGER NOT NULL DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		-- Initialize with defaults
		INSERT INTO setup_state (id, default_database_linked) VALUES (1, 0);
	`,

	down: `
		DROP TABLE setup_state;
	`
};
