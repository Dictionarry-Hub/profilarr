import type { Migration } from '../migrations.ts';

/**
 * Migration 071: Remove local bypass from auth settings
 *
 * The local bypass feature is removed (#601): its behavior depended on
 * deployment topology (any private-range TCP peer counted as "local",
 * including reverse proxy containers), and AUTH=off covers the setups
 * that genuinely want unauthenticated local access.
 */

export const migration: Migration = {
	version: 71,
	name: 'Remove local bypass from auth settings',

	up: `
		ALTER TABLE auth_settings DROP COLUMN local_bypass_enabled;
	`,

	down: `
		ALTER TABLE auth_settings ADD COLUMN local_bypass_enabled INTEGER NOT NULL DEFAULT 0;
	`
};
