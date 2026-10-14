import type { Migration } from '../migrations.ts';

/**
 * Migration 074: Add session confirmed_at
 *
 * The last time the session's owner proved their identity: set at sign-in,
 * refreshed by an explicit confirmation (password, or SSO re-authentication),
 * never by ordinary activity. Creating an API key requires it to be recent.
 * Existing sessions start unconfirmed and are asked once.
 */

export const migration: Migration = {
	version: 74,
	name: 'Add session confirmed_at',

	up: `
		ALTER TABLE sessions
		ADD COLUMN confirmed_at DATETIME;
	`,

	down: `
		ALTER TABLE sessions DROP COLUMN confirmed_at;
	`
};
