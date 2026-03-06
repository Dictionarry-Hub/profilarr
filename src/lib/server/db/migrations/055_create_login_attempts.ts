import type { Migration } from '../migrations.ts';

/**
 * Migration 055: Create login_attempts table
 *
 * Tracks failed login attempts for rate limiting.
 * Persisted to SQLite so counters survive restarts.
 */

export const migration: Migration = {
	version: 55,
	name: 'Create login attempts table',

	up: `
		CREATE TABLE login_attempts (
			ip TEXT NOT NULL,
			endpoint TEXT NOT NULL,
			category TEXT NOT NULL DEFAULT 'unknown',
			failed_at DATETIME NOT NULL DEFAULT (datetime('now'))
		);

		CREATE INDEX idx_login_attempts_lookup
			ON login_attempts(ip, endpoint, failed_at);
	`,

	down: `
		DROP INDEX IF EXISTS idx_login_attempts_lookup;
		DROP TABLE IF EXISTS login_attempts;
	`
};
