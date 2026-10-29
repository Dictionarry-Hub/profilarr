import type { Migration } from '#db/migrations.ts';

/**
 * Migration 001: Create arr_instances table
 *
 * Creates the initial table for storing *arr application instance configurations.
 * This includes Radarr, Sonarr, Readarr, Lidarr, Prowlarr, etc.
 *
 * Fields:
 * - id: Auto-incrementing primary key
 * - name: User-friendly name (unique)
 * - type: Instance type (radarr, sonarr, etc.)
 * - url: Base URL for the instance
 * - api_key: API key for authentication
 * - tags: JSON array of tags
 * - sync_profile: Optional sync profile identifier
 * - enabled: Boolean flag (1=enabled, 0=disabled)
 * - created_at: Timestamp of creation
 * - updated_at: Timestamp of last update
 */

export const migration: Migration = {
	version: 1,
	name: 'Create arr_instances table',

	up: `
		CREATE TABLE arr_instances (
			id INTEGER PRIMARY KEY AUTOINCREMENT,

			-- Instance identification
			name TEXT NOT NULL UNIQUE,
			type TEXT NOT NULL,

			-- Connection details
			url TEXT NOT NULL,
			api_key TEXT NOT NULL,

			-- Configuration
			tags TEXT,
			sync_profile TEXT,
			enabled INTEGER NOT NULL DEFAULT 1,

			-- Metadata
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);
	`,

	down: `
		DROP TABLE IF EXISTS arr_instances;
	`
};
