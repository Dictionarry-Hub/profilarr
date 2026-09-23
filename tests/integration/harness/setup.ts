/**
 * Test setup helpers — create users, login, set API keys, manipulate DB state.
 */

import { TestClient } from '$test-harness/client.ts';
import { openDb } from '$test-harness/db.ts';
import { hash } from '@felix/bcrypt';
import { log } from '$test-harness/log.ts';

/**
 * Create the first user via the /auth/setup form action.
 * Only works when no users exist yet.
 */
export async function createUser(
	client: TestClient,
	username: string,
	password: string,
	origin: string
): Promise<Response> {
	log.setup(`Creating user "${username}"`);
	return client.postForm(
		'/auth/setup',
		{
			username,
			password,
			confirmPassword: password
		},
		{
			headers: { Origin: origin }
		}
	);
}

/**
 * Login via the /auth/login form action.
 * Returns the response (303 redirect on success, 400/429 on failure).
 */
export async function login(
	client: TestClient,
	username: string,
	password: string,
	origin: string
): Promise<Response> {
	log.setup(`Logging in as "${username}"`);
	return client.postForm(
		'/auth/login',
		{ username, password },
		{
			headers: { Origin: origin }
		}
	);
}

/**
 * Create a user directly in the database (bypasses form action / CSRF).
 * Use when the server's ORIGIN doesn't match the request URL (e.g. behind a proxy).
 */
export async function createUserDirect(
	dbPath: string,
	username: string,
	password: string
): Promise<void> {
	log.setup(`Creating user "${username}" directly in DB`);
	const passwordHash = await hash(password);
	const db = openDb(dbPath);
	try {
		db.exec('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, passwordHash]);
	} finally {
		db.close();
	}
}

export interface ApiKeyOptions {
	/** Defaults to `test-<last 4 chars>`, so several keys per spec don't collide */
	name?: string;
	/** Stored permissions: `'all'` (default) or an area -> access map */
	permissions?: 'all' | Record<string, string>;
	/** ISO timestamp; null (default) never expires */
	expiresAt?: string | null;
}

/**
 * Add an API key directly in the database (bcrypt-hashed). Full access and
 * no expiry unless options say otherwise.
 */
export async function setApiKey(
	dbPath: string,
	apiKey: string,
	options: ApiKeyOptions = {}
): Promise<void> {
	const name = options.name ?? `test-${apiKey.slice(-4)}`;
	log.setup(`Adding API key "${name}" in DB`);
	const hashed = await hash(apiKey);
	const db = openDb(dbPath);
	try {
		db.exec(
			`INSERT INTO api_keys (name, key_hash, key_hint, permissions, expires_at, created_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[
				name,
				hashed,
				apiKey.slice(-4),
				JSON.stringify(options.permissions ?? 'all'),
				options.expiresAt ?? null,
				new Date().toISOString()
			]
		);
	} finally {
		db.close();
	}
}

/**
 * Delete an API key by name directly in the database.
 */
export function deleteApiKey(dbPath: string, name: string): void {
	log.setup(`Deleting API key "${name}" in DB`);
	const db = openDb(dbPath);
	try {
		db.exec('DELETE FROM api_keys WHERE name = ?', [name]);
	} finally {
		db.close();
	}
}

/**
 * Expire a session by setting its expires_at to the past.
 */
export function expireSession(dbPath: string, sessionId: string): void {
	log.setup(`Expiring session ${sessionId.slice(0, 8)}...`);
	const db = openDb(dbPath);
	try {
		db.exec("UPDATE sessions SET expires_at = datetime('now', '-1 hour') WHERE id = ?", [
			sessionId
		]);
	} finally {
		db.close();
	}
}

/**
 * Insert expired login attempts for rate limit testing.
 */
export function insertExpiredAttempts(
	dbPath: string,
	ip: string,
	category: string,
	count: number,
	minutesAgo: number
): void {
	log.setup(`Inserting ${count} expired "${category}" attempts (${minutesAgo}m ago)`);
	const db = openDb(dbPath);
	try {
		for (let i = 0; i < count; i++) {
			db.exec(
				`INSERT INTO login_attempts (ip, endpoint, category, failed_at)
				 VALUES (?, '/auth/login', ?, datetime('now', '-${minutesAgo} minutes'))`,
				[ip, category]
			);
		}
	} finally {
		db.close();
	}
}

/**
 * Set a session's expires_at to a specific number of minutes from now.
 * Used for sliding expiration tests.
 */
export function setSessionExpiry(dbPath: string, sessionId: string, minutesFromNow: number): void {
	log.setup(`Setting session ${sessionId.slice(0, 8)}... to expire in ${minutesFromNow}m`);
	const db = openDb(dbPath);
	try {
		db.exec("UPDATE sessions SET expires_at = datetime('now', ? || ' minutes') WHERE id = ?", [
			String(minutesFromNow),
			sessionId
		]);
	} finally {
		db.close();
	}
}

/**
 * Get a session's expires_at timestamp from the database.
 */
export function getSessionExpiry(dbPath: string, sessionId: string): string | null {
	log.setup(`Reading session ${sessionId.slice(0, 8)}... expiry`);
	const db = openDb(dbPath);
	try {
		const stmt = db.prepare('SELECT expires_at FROM sessions WHERE id = ?');
		const row = stmt.get(sessionId) as { expires_at: string } | undefined;
		return row?.expires_at ?? null;
	} finally {
		db.close();
	}
}

/**
 * Clear all login attempts from the database.
 */
export function clearLoginAttempts(dbPath: string): void {
	log.setup('Clearing all login attempts');
	const db = openDb(dbPath);
	try {
		db.exec('DELETE FROM login_attempts');
	} finally {
		db.close();
	}
}

/**
 * Read a value from the database.
 */
export function queryDb(dbPath: string, sql: string, params: unknown[] = []): unknown[] {
	const db = openDb(dbPath);
	try {
		const stmt = db.prepare(sql);
		return stmt.all(...params);
	} finally {
		db.close();
	}
}
