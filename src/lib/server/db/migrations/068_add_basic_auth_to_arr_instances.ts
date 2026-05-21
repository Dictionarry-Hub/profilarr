import type { Migration } from '../migrations.ts';

/**
 * Migration 068: Add optional Basic Auth credentials to Arr instances
 */

export const migration: Migration = {
	version: 68,
	name: 'Add Basic Auth credentials to Arr instances',

	up: `
		ALTER TABLE arr_instances ADD COLUMN basic_auth_username TEXT;
		ALTER TABLE arr_instances ADD COLUMN basic_auth_password TEXT;
	`,

	down: `
		ALTER TABLE arr_instances DROP COLUMN basic_auth_username;
		ALTER TABLE arr_instances DROP COLUMN basic_auth_password;
	`
};
