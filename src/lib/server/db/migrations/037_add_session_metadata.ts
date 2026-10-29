import type { Migration } from '#db/migrations.ts';

/**
 * Migration 037: Add session metadata columns
 *
 * Adds rich session information for better session management UI:
 * - ip_address: Client IP address when session was created
 * - user_agent: Full user agent string
 * - browser: Parsed browser name and version (e.g., "Chrome 120")
 * - os: Parsed operating system (e.g., "Windows 11")
 * - device_type: Device category (Desktop, Mobile, Tablet)
 * - last_active_at: Updated on sliding expiration for activity tracking
 */

export const migration: Migration = {
	version: 37,
	name: 'Add session metadata',

	up: `
		ALTER TABLE sessions ADD COLUMN ip_address TEXT;
		ALTER TABLE sessions ADD COLUMN user_agent TEXT;
		ALTER TABLE sessions ADD COLUMN browser TEXT;
		ALTER TABLE sessions ADD COLUMN os TEXT;
		ALTER TABLE sessions ADD COLUMN device_type TEXT;
		ALTER TABLE sessions ADD COLUMN last_active_at DATETIME;
	`,

	down: `
		-- SQLite doesn't support DROP COLUMN directly, so we recreate the table
		CREATE TABLE sessions_new (
			id TEXT PRIMARY KEY,
			user_id INTEGER NOT NULL,
			expires_at DATETIME NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		);

		INSERT INTO sessions_new (id, user_id, expires_at, created_at)
		SELECT id, user_id, expires_at, created_at FROM sessions;

		DROP TABLE sessions;
		ALTER TABLE sessions_new RENAME TO sessions;

		CREATE INDEX idx_sessions_user_id ON sessions(user_id);
		CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
	`
};
