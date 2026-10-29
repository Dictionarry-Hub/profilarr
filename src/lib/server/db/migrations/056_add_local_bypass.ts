import process from 'node:process';
import type { Migration } from '#db/migrations.ts';
import { db } from '#db/db.ts';

/**
 * Migration 056: Add local bypass toggle to auth settings
 *
 * Moves AUTH=local from env var to a DB-backed toggle.
 * Defaults to false (off). Auto-migrates existing AUTH=local users.
 */

export const migration: Migration = {
	version: 56,
	name: 'Add local bypass to auth settings',

	up: `
		ALTER TABLE auth_settings ADD COLUMN local_bypass_enabled INTEGER NOT NULL DEFAULT 0;
	`,

	down: `
		ALTER TABLE auth_settings DROP COLUMN local_bypass_enabled;
	`,

	afterUp() {
		const authEnv = (process.env.AUTH || '').toLowerCase();
		if (authEnv === 'local') {
			db.execute('UPDATE auth_settings SET local_bypass_enabled = 1 WHERE id = 1');
		}
	}
};
