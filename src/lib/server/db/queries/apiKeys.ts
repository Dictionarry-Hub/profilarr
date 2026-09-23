import { db } from '../db.ts';
import { hash } from '@felix/bcrypt';
import { generateApiKey } from '$auth/apiKey.ts';
import { toUTC } from '$shared/utils/dates.ts';
import { parseApiKeyPermissions, type ApiKeyPermissions } from '$shared/apiKeys.ts';

/**
 * Types for api_keys table
 */
interface ApiKeyRow {
	id: number;
	name: string;
	key_hash: string;
	key_hint: string | null;
	permissions: string;
	expires_at: string | null;
	last_used_at: string | null;
	created_at: string;
}

export interface ApiKey {
	id: number;
	name: string;
	keyHint: string | null;
	permissions: ApiKeyPermissions;
	expiresAt: string | null;
	lastUsedAt: string | null;
	createdAt: string;
}

export interface ApiKeyHash {
	id: number;
	keyHash: string;
}

export interface CreateApiKeyInput {
	name: string;
	permissions: ApiKeyPermissions;
	expiresAt: string | null;
}

function rowToApiKey(row: ApiKeyRow): ApiKey {
	return {
		id: row.id,
		name: row.name,
		keyHint: row.key_hint,
		permissions: parseApiKeyPermissions(row.permissions),
		expiresAt: toUTC(row.expires_at),
		lastUsedAt: toUTC(row.last_used_at),
		createdAt: toUTC(row.created_at)!
	};
}

/**
 * All queries for api_keys table
 * Keys are only created and deleted; nothing about a key changes after
 * creation except last_used_at.
 */
export const apiKeysQueries = {
	/**
	 * List all keys, oldest first
	 */
	list(): ApiKey[] {
		return db.query<ApiKeyRow>('SELECT * FROM api_keys ORDER BY id').map(rowToApiKey);
	},

	/**
	 * Get a key by ID
	 */
	getById(id: number): ApiKey | undefined {
		const row = db.queryFirst<ApiKeyRow>('SELECT * FROM api_keys WHERE id = ?', id);
		return row ? rowToApiKey(row) : undefined;
	},

	/**
	 * Get every key's hash, for matching an incoming key
	 */
	getHashes(): ApiKeyHash[] {
		const rows = db.query<{ id: number; key_hash: string }>(
			'SELECT id, key_hash FROM api_keys ORDER BY id'
		);
		return rows.map((row) => ({ id: row.id, keyHash: row.key_hash }));
	},

	/**
	 * Check whether a key name is taken (case-insensitive)
	 */
	nameExists(name: string): boolean {
		const row = db.queryFirst<{ found: number }>(
			'SELECT 1 AS found FROM api_keys WHERE name = ? COLLATE NOCASE',
			name
		);
		return row !== undefined;
	},

	/**
	 * Create a key. Returns the plaintext key once; only its bcrypt hash and
	 * last 4 characters are stored.
	 */
	async create(input: CreateApiKeyInput): Promise<{ apiKey: ApiKey; key: string }> {
		const key = generateApiKey();
		const keyHash = await hash(key);

		db.execute(
			`INSERT INTO api_keys (name, key_hash, key_hint, permissions, expires_at, created_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			input.name,
			keyHash,
			key.slice(-4),
			JSON.stringify(input.permissions),
			input.expiresAt,
			new Date().toISOString()
		);

		const result = db.queryFirst<{ id: number }>('SELECT last_insert_rowid() as id');
		const apiKey = this.getById(result!.id)!;
		return { apiKey, key };
	},

	/**
	 * Delete a key
	 */
	delete(id: number): boolean {
		return db.execute('DELETE FROM api_keys WHERE id = ?', id) > 0;
	},

	/**
	 * Record that a key was just used
	 */
	touchLastUsed(id: number): void {
		db.execute('UPDATE api_keys SET last_used_at = ? WHERE id = ?', new Date().toISOString(), id);
	}
};
