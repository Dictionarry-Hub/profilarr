import type { Migration } from '#db/migrations.ts';

/**
 * Migration 018: Create app_info table
 *
 * Creates a singleton table to store application metadata.
 * Version is stored here and bumped via migrations on each release.
 */

export const migration: Migration = {
	version: 18,
	name: 'Create app_info table',

	up: `
		CREATE TABLE app_info (
			id INTEGER PRIMARY KEY CHECK (id = 1),
			version TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		-- Insert initial version
		INSERT INTO app_info (id, version) VALUES (1, '2.0.0');
	`,

	down: `
		DROP TABLE IF EXISTS app_info;
	`
};
