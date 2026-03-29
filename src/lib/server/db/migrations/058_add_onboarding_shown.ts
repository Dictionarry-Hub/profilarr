import type { Migration } from '../migrations.ts';

export const migration: Migration = {
	version: 58,
	name: 'Add onboarding_shown to general_settings',
	up: `
		ALTER TABLE general_settings ADD COLUMN onboarding_shown INTEGER NOT NULL DEFAULT 0;
	`,
	down: `
		ALTER TABLE general_settings DROP COLUMN onboarding_shown;
	`
};
