import type { Migration } from '../migrations.ts';

/**
 * Migration 057: Clear existing plaintext API key
 *
 * The API key is now bcrypt-hashed before storage.
 * Existing plaintext keys are invalidated — users generate a new one via the security page.
 */

export const migration: Migration = {
	version: 57,
	name: 'Hash API key (clear existing plaintext)',

	up: `
		UPDATE auth_settings SET api_key = NULL WHERE id = 1;
	`
};
