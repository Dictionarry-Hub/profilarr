import type { Migration } from '#db/migrations.ts';

/**
 * Migration 006: Simplify log settings to daily-only rotation
 *
 * Removes rotation_strategy and max_file_size columns.
 * Logs will now always use daily rotation (YYYY-MM-DD.log format).
 */

export const migration: Migration = {
	version: 6,
	name: 'Simplify log settings to daily-only rotation',

	up: `
		-- Remove rotation strategy and max file size columns
		-- SQLite doesn't support DROP COLUMN directly in all versions,
		-- so we need to recreate the table

		-- Create new table with updated schema
		CREATE TABLE log_settings_new (
			id INTEGER PRIMARY KEY CHECK (id = 1),

			-- Retention
			retention_days INTEGER NOT NULL DEFAULT 30,

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

		-- Copy data from old table (excluding removed columns)
		INSERT INTO log_settings_new (
			id,
			retention_days,
			min_level,
			enabled,
			file_logging,
			console_logging,
			created_at,
			updated_at
		)
		SELECT
			id,
			retention_days,
			min_level,
			enabled,
			file_logging,
			console_logging,
			created_at,
			updated_at
		FROM log_settings;

		-- Drop old table
		DROP TABLE log_settings;

		-- Rename new table to original name
		ALTER TABLE log_settings_new RENAME TO log_settings;
	`,

	down: `
		-- Recreate table with rotation_strategy and max_file_size columns

		CREATE TABLE log_settings_new (
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

		-- Copy data back, adding default values for removed columns
		INSERT INTO log_settings_new (
			id,
			rotation_strategy,
			retention_days,
			max_file_size,
			min_level,
			enabled,
			file_logging,
			console_logging,
			created_at,
			updated_at
		)
		SELECT
			id,
			'daily',
			retention_days,
			100,
			min_level,
			enabled,
			file_logging,
			console_logging,
			created_at,
			updated_at
		FROM log_settings;

		DROP TABLE log_settings;
		ALTER TABLE log_settings_new RENAME TO log_settings;
	`
};
