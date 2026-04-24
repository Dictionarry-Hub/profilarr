import type { Migration } from '../migrations.ts';

/**
 * Migration 062: Drop onboarding_shown from general_settings
 *
 * The first-run cutscene prompt (migration 058) has been replaced by the
 * announcement system, so the server-persisted flag and its endpoint are gone.
 * The down migration re-adds the column with its original default so rollback
 * to a pre-062 codebase finds what it expects.
 */

export const migration: Migration = {
	version: 62,
	name: 'Drop onboarding_shown from general_settings',

	up: `
		ALTER TABLE general_settings DROP COLUMN onboarding_shown;
	`,

	down: `
		ALTER TABLE general_settings ADD COLUMN onboarding_shown INTEGER NOT NULL DEFAULT 0;
	`
};
