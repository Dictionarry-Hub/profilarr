import type { Migration } from '#db/migrations.ts';

/**
 * Create general_settings table for app-wide settings
 * Initial setting: apply_default_delay_profiles (ON by default)
 */
export const migration: Migration = {
	version: 30,
	name: 'Create general_settings table',

	up: `
		-- General settings table (singleton pattern)
		CREATE TABLE IF NOT EXISTS general_settings (
			id INTEGER PRIMARY KEY CHECK (id = 1),

			-- Default delay profile settings
			apply_default_delay_profiles INTEGER NOT NULL DEFAULT 1,  -- 1=apply defaults when adding arr, 0=don't

			-- Metadata
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		-- Insert default row
		INSERT INTO general_settings (id) VALUES (1);
	`,

	down: `
		DROP TABLE IF EXISTS general_settings;
	`
};
