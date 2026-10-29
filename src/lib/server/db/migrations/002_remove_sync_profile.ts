import type { Migration } from '#db/migrations.ts';

/**
 * Migration 002: Remove sync_profile column
 *
 * Drops the sync_profile column from arr_instances table as it's not needed.
 */

export const migration: Migration = {
	version: 2,
	name: 'Remove sync_profile column from arr_instances',

	up: `
		ALTER TABLE arr_instances DROP COLUMN sync_profile;
	`,

	down: `
		ALTER TABLE arr_instances ADD COLUMN sync_profile TEXT;
	`
};
