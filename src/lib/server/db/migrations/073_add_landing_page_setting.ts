import type { Migration } from '#db/migrations.ts';

/**
 * Migration 073: Add landing page setting
 *
 * Stores the page `/` opens. NULL means automatic: Quality Profiles once a
 * database is linked, otherwise Databases. Values are validated in app code
 * against `LANDING_PAGES`, so adding a page doesn't need a table rebuild.
 */

export const migration: Migration = {
	version: 73,
	name: 'Add landing page setting',

	up: `
		ALTER TABLE general_settings
		ADD COLUMN landing_page TEXT;
	`,

	down: `
		ALTER TABLE general_settings DROP COLUMN landing_page;
	`
};
