import type { Migration } from '#db/migrations.ts';

/**
 * Migration 020: Create tmdb_settings table
 *
 * Creates a table to store TMDB API configuration.
 * Uses a singleton pattern (single row with id=1).
 *
 * Settings:
 * - api_key: TMDB API key for authentication
 */

export const migration: Migration = {
	version: 20,
	name: 'Create tmdb_settings table',

	up: `
		CREATE TABLE tmdb_settings (
			id INTEGER PRIMARY KEY CHECK (id = 1),

			-- TMDB Configuration
			api_key TEXT NOT NULL DEFAULT '',

			-- Metadata
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		-- Insert default settings
		INSERT INTO tmdb_settings (id) VALUES (1);
	`,

	down: `
		DROP TABLE IF EXISTS tmdb_settings;
	`
};
