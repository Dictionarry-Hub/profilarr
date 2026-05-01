import type { Migration } from '../migrations.ts';

/**
 * Migration 064: Add fail-on-referenced-delete setting
 *
 * Controls whether deletes for custom formats and regular expressions are
 * blocked when other PCD entities still reference them.
 */

export const migration: Migration = {
	version: 64,
	name: 'Add fail-on-referenced-delete setting',

	up: `
		ALTER TABLE general_settings
		ADD COLUMN fail_on_referenced_delete INTEGER NOT NULL DEFAULT 1;
	`,

	down: `
		ALTER TABLE general_settings DROP COLUMN fail_on_referenced_delete;
	`
};
