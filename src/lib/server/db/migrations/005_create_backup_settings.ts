import type { Migration } from '#db/migrations.ts';

/**
 * Migration 005: Create backup_settings table
 *
 * Creates a table to store configurable backup settings.
 * Uses a singleton pattern (single row with id=1).
 *
 * Settings:
 * - schedule: Cron-like schedule for automatic backups (e.g., 'daily', 'weekly')
 * - retentionDays: How many days to keep backups before deletion
 * - enabled: Master switch for automatic backups
 * - includeDatabase: Include database in backups
 * - compressionEnabled: Enable compression for backups
 */

export const migration: Migration = {
	version: 5,
	name: 'Create backup_settings table',

	up: `
		CREATE TABLE backup_settings (
			id INTEGER PRIMARY KEY CHECK (id = 1),

			-- Backup Configuration
			schedule TEXT NOT NULL DEFAULT 'daily',
			retention_days INTEGER NOT NULL DEFAULT 30,
			enabled INTEGER NOT NULL DEFAULT 1,
			include_database INTEGER NOT NULL DEFAULT 1,
			compression_enabled INTEGER NOT NULL DEFAULT 1,

			-- Metadata
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		-- Insert default settings
		INSERT INTO backup_settings (id) VALUES (1);
	`,

	down: `
		DROP TABLE IF EXISTS backup_settings;
	`
};
