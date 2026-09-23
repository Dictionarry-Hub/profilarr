import type { Migration } from '../migrations.ts';

/**
 * Migration 072: Create api_keys table
 *
 * Replaces the single global API key (#913) with named keys, each with its
 * own permissions and optional expiry. An existing key hash is carried over
 * as a full-access "Default" key that never expires, so current integrations
 * keep working. The old auth_settings.api_key column is dropped.
 */

export const migration: Migration = {
	version: 72,
	name: 'Create api_keys table',

	up: `
		CREATE TABLE api_keys (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			key_hash TEXT NOT NULL,
			key_hint TEXT,
			permissions TEXT NOT NULL,
			expires_at DATETIME,
			last_used_at DATETIME,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		CREATE UNIQUE INDEX idx_api_keys_name ON api_keys(name COLLATE NOCASE);

		INSERT INTO api_keys (name, key_hash, key_hint, permissions, expires_at)
		SELECT 'Default', api_key, NULL, '"all"', NULL
		FROM auth_settings
		WHERE id = 1 AND api_key IS NOT NULL;

		ALTER TABLE auth_settings DROP COLUMN api_key;
	`,

	down: `
		ALTER TABLE auth_settings ADD COLUMN api_key TEXT;

		UPDATE auth_settings
		SET api_key = (
			SELECT key_hash FROM api_keys
			WHERE permissions = '"all"'
			ORDER BY id
			LIMIT 1
		)
		WHERE id = 1;

		DROP INDEX IF EXISTS idx_api_keys_name;
		DROP TABLE IF EXISTS api_keys;
	`
};
