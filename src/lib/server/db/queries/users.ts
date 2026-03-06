import { db } from '../db.ts';

/**
 * Types for users table
 */
export interface User {
	id: number;
	username: string;
	password_hash: string;
	created_at: string;
	updated_at: string;
}

/**
 * All queries for users table
 * Single admin user - no multi-user support
 */
export const usersQueries = {
	/**
	 * Check if any users exist (for first-run setup detection)
	 */
	exists(): boolean {
		const result = db.queryFirst<{ count: number }>('SELECT COUNT(*) as count FROM users');
		return (result?.count ?? 0) > 0;
	},

	/**
	 * Check if any local (non-OIDC) users exist
	 * OIDC users have username starting with 'oidc:'
	 */
	existsLocal(): boolean {
		const result = db.queryFirst<{ count: number }>(
			"SELECT COUNT(*) as count FROM users WHERE username NOT LIKE 'oidc:%'"
		);
		return (result?.count ?? 0) > 0;
	},

	/**
	 * Get user by ID
	 */
	getById(id: number): User | undefined {
		return db.queryFirst<User>('SELECT * FROM users WHERE id = ?', id);
	},

	/**
	 * Get user by username
	 */
	getByUsername(username: string): User | undefined {
		return db.queryFirst<User>('SELECT * FROM users WHERE username = ?', username);
	},

	/**
	 * Get all usernames (for login analysis - typo detection)
	 * Excludes OIDC users since they can't login with password
	 */
	getAllUsernames(): string[] {
		const results = db.query<{ username: string }>(
			"SELECT username FROM users WHERE username NOT LIKE 'oidc:%'"
		);
		return results.map((r) => r.username);
	},

	/**
	 * Create a new user (should only be called once during setup)
	 */
	create(username: string, passwordHash: string): number {
		db.execute('INSERT INTO users (username, password_hash) VALUES (?, ?)', username, passwordHash);

		const result = db.queryFirst<{ id: number }>('SELECT last_insert_rowid() as id');
		return result?.id ?? 0;
	},

	/**
	 * Update user's password
	 */
	updatePassword(id: number, passwordHash: string): boolean {
		const affected = db.execute(
			'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
			passwordHash,
			id
		);
		return affected > 0;
	},

	/**
	 * Update username
	 */
	updateUsername(id: number, username: string): boolean {
		const affected = db.execute(
			'UPDATE users SET username = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
			username,
			id
		);
		return affected > 0;
	},

	/**
	 * Get or create OIDC user
	 * OIDC users have no password (placeholder hash)
	 */
	getOrCreateOidcUser(identifier: string): number {
		const username = `oidc:${identifier}`;
		const existing = this.getByUsername(username);
		if (existing) {
			return existing.id;
		}

		// Create with placeholder - OIDC users can't login with password
		db.execute(
			'INSERT INTO users (username, password_hash) VALUES (?, ?)',
			username,
			'OIDC_NO_PASSWORD'
		);

		const result = db.queryFirst<{ id: number }>('SELECT last_insert_rowid() as id');
		return result?.id ?? 0;
	}
};
