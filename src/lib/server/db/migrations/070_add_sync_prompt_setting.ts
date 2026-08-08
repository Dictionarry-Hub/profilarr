import type { Migration } from '../migrations.ts';

/**
 * Migration 070: Add sync prompt setting
 *
 * Controls whether saving an entity prompts to sync affected Arr instances.
 */

export const migration: Migration = {
	version: 70,
	name: 'Add sync prompt setting',

	up: `
		ALTER TABLE general_settings
		ADD COLUMN sync_prompt_enabled INTEGER NOT NULL DEFAULT 1;
	`,

	down: `
		ALTER TABLE general_settings DROP COLUMN sync_prompt_enabled;
	`
};
