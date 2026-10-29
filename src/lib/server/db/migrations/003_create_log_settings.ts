import type { Migration } from '#db/migrations.ts';

/**
 * Migration 003: Create log_settings table
 *
 * Creates a table to store configurable logging settings.
 * Uses a singleton pattern (single row with id=1).
 *
 * Settings:
 * - rotationStrategy: How to rotate logs ('daily', 'size', or 'both')
 * - retentionDays: How many days to keep logs before deletion
 * - maxFileSize: Maximum log file size in MB before rotation
 * - minLevel: Minimum log level to write (DEBUG, INFO, WARN, ERROR)
 * - enabled: Master switch for all logging
 * - fileLogging: Enable/disable file logging
 * - consoleLogging: Enable/disable console logging
 */

export const migration: Migration = {
	version: 3,
	name: 'Create log_settings table',

	up: `
		CREATE TABLE log_settings (
			id INTEGER PRIMARY KEY CHECK (id = 1),

			-- Rotation & Retention
			rotation_strategy TEXT NOT NULL DEFAULT 'daily' CHECK (rotation_strategy IN ('daily', 'size', 'both')),
			retention_days INTEGER NOT NULL DEFAULT 30,
			max_file_size INTEGER NOT NULL DEFAULT 100,

			-- Log Level
			min_level TEXT NOT NULL DEFAULT 'INFO' CHECK (min_level IN ('DEBUG', 'INFO', 'WARN', 'ERROR')),

			-- Enable/Disable
			enabled INTEGER NOT NULL DEFAULT 1,
			file_logging INTEGER NOT NULL DEFAULT 1,
			console_logging INTEGER NOT NULL DEFAULT 1,

			-- Metadata
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		-- Insert default settings
		INSERT INTO log_settings (id) VALUES (1);
	`,

	down: `
		DROP TABLE IF EXISTS log_settings;
	`
};
