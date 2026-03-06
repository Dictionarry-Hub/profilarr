/**
 * Integration tests: API secret exposure in page responses
 *
 * All routes tested here ARE behind authentication — an unauthenticated
 * request gets redirected to /auth/login. The concern is defense in depth:
 * if an attacker gains a session (XSS, session theft, auth bypass bug),
 * they should NOT be able to extract secrets like arr API keys, GitHub PATs,
 * or webhook URLs from page responses. Secrets should only be accessible
 * via direct filesystem access to the SQLite database.
 *
 * These tests FAIL now (proving the exposure), then pass after secrets
 * are stripped from page data.
 *
 * Exposure points:
 * - arr/[id]/+layout.server.ts → api_key to all /arr/[id]/* pages
 * - arr/[id]/upgrades,logs,rename,sync/+page.server.ts → api_key via re-fetch
 * - arr/+page.server.ts → api_key in instance list
 * - databases/[id]/+layout.server.ts → personal_access_token to all /databases/[id]/* pages
 * - databases/+page.server.ts → personal_access_token in database list
 * - settings/general/+page.server.ts → TMDB + AI api_key
 * - settings/security/+page.server.ts → Profilarr api_key
 * - settings/notifications/+page.server.ts → webhook_url in config JSON
 * - settings/notifications/edit/[id]/+page.server.ts → webhook_url in edit form
 * - 12 pages using pcdManager.getAll() → PATs (quality-profiles, custom-formats,
 *   delay-profiles, regular-expressions, media-management, arr/[id]/sync)
 *
 * Tests:
 * 1. /arr list does not expose arr API keys
 * 2. /arr/[id]/upgrades does not expose arr API key
 * 3. /arr/[id]/rename does not expose arr API key
 * 4. /arr/[id]/sync does not expose arr API key
 * 5. /databases list does not expose PATs
 * 6. /databases/[id]/tweaks does not expose PAT
 * 7. /quality-profiles/[databaseId] list does not expose PATs
 * 8. /custom-formats/[databaseId] list does not expose PATs
 * 9. /delay-profiles/[databaseId] list does not expose PATs
 * 10. /regular-expressions/[databaseId] list does not expose PATs
 * 11. /media-management/[databaseId] layout does not expose PATs
 * 12. /settings/general does not expose TMDB API key
 * 13. /settings/general does not expose AI API key
 * 14. /settings/security does not expose Profilarr API key
 * 15. /settings/notifications list does not expose webhook URLs
 * 16. /settings/notifications/edit/[id] does not expose webhook URL
 */

import { assertEquals } from '@std/assert';
import { TestClient } from '../harness/client.ts';
import { startServer, stopServer, getDbPath } from '../harness/server.ts';
import { createUserDirect, login } from '../harness/setup.ts';
import { setup, teardown, test, run } from '../harness/runner.ts';
import { Database } from 'jsr:@db/sqlite@0.12';
import { hash } from '@felix/bcrypt';

const PORT = 7016;
const ORIGIN = `http://localhost:${PORT}`;

// Known secrets — we insert these and check they don't appear in responses
const ARR_API_KEY = 'sonarr-secret-key-abc123def456';
const DB_PAT = 'ghp-secret-pat-token-uvw567xyz890';
const TMDB_API_KEY = 'tmdb-secret-key-xyz789ghi012';
const AI_API_KEY = 'sk-ai-secret-key-jkl345mno678';
const PROFILARR_API_KEY = 'profilarr-secret-key-pqr901stu234';
const WEBHOOK_URL = 'https://discord.com/api/webhooks/secret-webhook-id/secret-webhook-token';

let arrInstanceId: number;
let databaseId: number;
let pcdDatabaseId: number;
let notificationServiceId: string;

async function seedSecrets(dbPath: string) {
	const db = new Database(dbPath);
	try {
		// Arr instance with known API key
		db.exec(
			`INSERT INTO arr_instances (name, type, url, api_key, enabled)
			 VALUES ('Test Sonarr', 'sonarr', 'http://localhost:8989', ?, 1)`,
			[ARR_API_KEY]
		);
		const arrRow = db.prepare('SELECT id FROM arr_instances WHERE name = ?').get('Test Sonarr') as {
			id: number;
		};
		arrInstanceId = arrRow.id;

		// Database instance with known PAT
		const uuid = crypto.randomUUID();
		db.exec(
			`INSERT INTO database_instances (uuid, name, repository_url, personal_access_token, local_path, enabled)
			 VALUES (?, 'Test DB', 'https://github.com/test/repo', ?, ?, 1)`,
			[uuid, DB_PAT, `./data/databases/${uuid}`]
		);
		const dbRow = db.prepare('SELECT id FROM database_instances WHERE name = ?').get('Test DB') as {
			id: number;
		};
		databaseId = dbRow.id;

		// TMDB API key
		db.exec('UPDATE tmdb_settings SET api_key = ? WHERE id = 1', [TMDB_API_KEY]);

		// AI API key (may not exist if feature disabled)
		const aiRow = db.prepare('SELECT COUNT(*) as count FROM ai_settings').get() as {
			count: number;
		};
		if (aiRow.count > 0) {
			db.exec('UPDATE ai_settings SET api_key = ? WHERE id = 1', [AI_API_KEY]);
		}

		// Profilarr API key (bcrypt-hashed)
		const hashedApiKey = await hash(PROFILARR_API_KEY);
		db.exec('UPDATE auth_settings SET api_key = ? WHERE id = 1', [hashedApiKey]);

		// Set PAT on auto-linked Dictionarry database so entity pages return 200
		// (the server auto-links this PCD on first startup, giving it a compiled cache)
		const autoLinked = db
			.prepare("SELECT id FROM database_instances WHERE name = 'Dictionarry'")
			.get() as { id: number } | undefined;
		if (autoLinked) {
			pcdDatabaseId = autoLinked.id;
			db.exec('UPDATE database_instances SET personal_access_token = ? WHERE id = ?', [
				DB_PAT,
				pcdDatabaseId
			]);
		} else {
			// Fallback to seeded database if auto-link didn't happen (no network)
			pcdDatabaseId = databaseId;
		}

		// Notification service with webhook URL
		notificationServiceId = crypto.randomUUID();
		db.exec(
			`INSERT INTO notification_services (id, name, service_type, enabled, config, enabled_types)
			 VALUES (?, 'Test Discord', 'discord', 1, ?, '[]')`,
			[notificationServiceId, JSON.stringify({ webhook_url: WEBHOOK_URL, username: 'Profilarr' })]
		);
	} finally {
		db.close();
	}
}

/** Login and fetch a page, return the body text */
async function fetchPage(path: string): Promise<string> {
	const client = new TestClient(ORIGIN);
	await login(client, 'admin', 'password123', ORIGIN);
	const res = await client.get(path, { followRedirects: true });
	return await res.text();
}

function assertNotExposed(body: string, secret: string, label: string) {
	assertEquals(body.includes(secret), false, `Response body contains ${label}: ${secret}`);
}

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');
	await createUserDirect(getDbPath(PORT), 'admin', 'password123');
	await seedSecrets(getDbPath(PORT));
});

teardown(async () => {
	await stopServer(PORT);
});

// --- Arr API keys ---

test('/arr list does not expose arr API keys', async () => {
	const body = await fetchPage('/arr');
	assertNotExposed(body, ARR_API_KEY, 'arr API key');
});

test('/arr/[id]/upgrades does not expose arr API key', async () => {
	const body = await fetchPage(`/arr/${arrInstanceId}/upgrades`);
	assertNotExposed(body, ARR_API_KEY, 'arr API key');
});

test('/arr/[id]/rename does not expose arr API key', async () => {
	const body = await fetchPage(`/arr/${arrInstanceId}/rename`);
	assertNotExposed(body, ARR_API_KEY, 'arr API key');
});

test('/arr/[id]/sync does not expose arr API key', async () => {
	const body = await fetchPage(`/arr/${arrInstanceId}/sync`);
	assertNotExposed(body, ARR_API_KEY, 'arr API key');
});

// --- Database PATs ---

test('/databases list does not expose PATs', async () => {
	const body = await fetchPage('/databases');
	assertNotExposed(body, DB_PAT, 'database PAT');
});

test('/databases/[id] layout does not expose PAT', async () => {
	const body = await fetchPage(`/databases/${databaseId}/tweaks`);
	assertNotExposed(body, DB_PAT, 'database PAT');
});

// --- Database PATs via pcdManager.getAllPublic() / getByIdPublic() ---
// Uses the auto-linked Dictionarry database (has compiled cache → 200 responses)

test('/quality-profiles/[databaseId] list does not expose PATs', async () => {
	const body = await fetchPage(`/quality-profiles/${pcdDatabaseId}`);
	assertNotExposed(body, DB_PAT, 'database PAT');
});

test('/custom-formats/[databaseId] list does not expose PATs', async () => {
	const body = await fetchPage(`/custom-formats/${pcdDatabaseId}`);
	assertNotExposed(body, DB_PAT, 'database PAT');
});

test('/delay-profiles/[databaseId] list does not expose PATs', async () => {
	const body = await fetchPage(`/delay-profiles/${pcdDatabaseId}`);
	assertNotExposed(body, DB_PAT, 'database PAT');
});

test('/regular-expressions/[databaseId] list does not expose PATs', async () => {
	const body = await fetchPage(`/regular-expressions/${pcdDatabaseId}`);
	assertNotExposed(body, DB_PAT, 'database PAT');
});

test('/media-management/[databaseId] layout does not expose PATs', async () => {
	const body = await fetchPage(`/media-management/${pcdDatabaseId}`);
	assertNotExposed(body, DB_PAT, 'database PAT');
});

// --- Settings API keys ---

test('/settings/general does not expose TMDB API key', async () => {
	const body = await fetchPage('/settings/general');
	assertNotExposed(body, TMDB_API_KEY, 'TMDB API key');
});

test('/settings/general does not expose AI API key', async () => {
	const body = await fetchPage('/settings/general');
	assertNotExposed(body, AI_API_KEY, 'AI API key');
});

test('/settings/security does not expose Profilarr API key', async () => {
	const body = await fetchPage('/settings/security');
	assertNotExposed(body, PROFILARR_API_KEY, 'Profilarr API key');
});

// --- Notification webhook URLs ---

test('/settings/notifications does not expose webhook URLs', async () => {
	const body = await fetchPage('/settings/notifications');
	assertNotExposed(body, WEBHOOK_URL, 'webhook URL');
});

test('/settings/notifications/edit/[id] does not expose webhook URL', async () => {
	const body = await fetchPage(`/settings/notifications/edit/${notificationServiceId}`);
	assertNotExposed(body, WEBHOOK_URL, 'webhook URL in edit page');
});

await run();
