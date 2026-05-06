import type { Migration } from '../migrations.ts';

/**
 * Migration 066: Add date format setting
 *
 * Stores the app-wide date display preference used by the interface.
 */

export const migration: Migration = {
	version: 66,
	name: 'Add date format setting',

	up: `
		ALTER TABLE general_settings
		ADD COLUMN date_format TEXT NOT NULL DEFAULT 'auto'
		CHECK (date_format IN ('auto', 'mdy', 'dmy', 'ymd'));
	`,

	down: `
		ALTER TABLE general_settings DROP COLUMN date_format;
	`
};
