import type { Migration } from '#db/migrations.ts';

/**
 * Migration 036: Create authentication tables
 *
 * Creates all auth-related tables:
 * - users: Single admin user (this is a single-user app)
 * - sessions: Multiple sessions per user (allows login from multiple devices)
 * - auth_settings: Singleton for session duration and API key
 */

export const migration: Migration = {
	version: 36,
	name: 'Create auth tables',

	up: `
		-- Users table (single admin user)
		CREATE TABLE users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		-- Sessions table (multiple sessions per user)
		CREATE TABLE sessions (
			id TEXT PRIMARY KEY,
			user_id INTEGER NOT NULL,
			expires_at DATETIME NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		);

		CREATE INDEX idx_sessions_user_id ON sessions(user_id);
		CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

		-- Auth settings table (singleton)
		CREATE TABLE auth_settings (
			id INTEGER PRIMARY KEY CHECK (id = 1),
			session_duration_hours INTEGER NOT NULL DEFAULT 168,
			api_key TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		-- Insert default auth settings with generated API key
		INSERT INTO auth_settings (id, api_key) VALUES (1, lower(hex(randomblob(16))));
	`,

	down: `
		DROP TABLE IF EXISTS auth_settings;
		DROP INDEX IF EXISTS idx_sessions_expires_at;
		DROP INDEX IF EXISTS idx_sessions_user_id;
		DROP TABLE IF EXISTS sessions;
		DROP TABLE IF EXISTS users;
	`
};
