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
 * - settings/security/+page.server.ts → Profilarr API key hashes
 * - settings/notifications/+page.server.ts → service secrets in config JSON
 * - settings/notifications/edit/[id]/+page.server.ts → service secrets in edit form
 * - 12 pages using pcdManager.getAll() → PATs (quality-profiles, custom-formats,
 *   delay-profiles, regular-expressions, media-management, arr/[id]/sync)
 *
 * Tests:
 * 1. /arr list does not expose arr credentials
 * 2. /arr/[id]/upgrades does not expose arr credentials
 * 3. /arr/[id]/rename does not expose arr credentials
 * 4. /arr/[id]/sync does not expose arr credentials
 * 4b. /arr/[id]/logs does not expose arr credentials
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
 * 15. /settings/notifications list does not expose any service secret
 * 16-19. /settings/notifications/edit/[id] does not expose the secret of each
 *        service type (Discord webhook URL, Ntfy access token, webhook URL and
 *        auth header, Telegram bot token)
 */

import { assertEquals } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { createUserDirect, login, queryDb } from '$test-harness/setup.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { openDb } from '$test-harness/db.ts';
import { bcryptHash } from '$auth/bcrypt.ts';

const PORT = PORTS.auth.secretExposure;
const ORIGIN = `http://localhost:${PORT}`;

// Known secrets — we insert these and check they don't appear in responses
const ARR_API_KEY = 'sonarr-secret-key-abc123def456';
const ARR_BASIC_AUTH_USERNAME = 'arr-basic-auth-user';
const ARR_BASIC_AUTH_PASSWORD = 'arr-basic-auth-pass';
const DB_PAT = 'ghp-secret-pat-token-uvw567xyz890';
const TMDB_API_KEY = 'tmdb-secret-key-xyz789ghi012';
const AI_API_KEY = 'sk-ai-secret-key-jkl345mno678';
const PROFILARR_API_KEY = 'profilarr-secret-key-pqr901stu234';
const WEBHOOK_URL = 'https://discord.com/api/webhooks/secret-webhook-id/secret-webhook-token';
const NTFY_ACCESS_TOKEN = 'tk_ntfy-secret-access-token-abc123';
const GENERIC_WEBHOOK_URL = 'https://hooks.example.com/secret-generic-webhook-path';
const WEBHOOK_AUTH_HEADER = 'Bearer secret-webhook-auth-header-def456';
const TELEGRAM_BOT_TOKEN = '123456789:secret-telegram-bot-token-ghi789';

/** Every notification secret, so the list page can be checked for all of them. */
const NOTIFICATION_SECRETS: Array<[string, string]> = [
	[WEBHOOK_URL, 'Discord webhook URL'],
	[NTFY_ACCESS_TOKEN, 'Ntfy access token'],
	[GENERIC_WEBHOOK_URL, 'webhook URL'],
	[WEBHOOK_AUTH_HEADER, 'webhook auth header'],
	[TELEGRAM_BOT_TOKEN, 'Telegram bot token']
];

let arrInstanceId: number;
let databaseId: number;
let pcdDatabaseId: number;
const notificationServiceIds: Record<'discord' | 'ntfy' | 'webhook' | 'telegram', string> = {
	discord: '',
	ntfy: '',
	webhook: '',
	telegram: ''
};
let profilarrApiKeyHash: string;

async function seedSecrets(dbPath: string) {
	const db = openDb(dbPath);
	try {
		// Arr instance with known credentials
		db.exec(
			`INSERT INTO arr_instances (
				name, type, url, api_key, basic_auth_username, basic_auth_password, enabled
			)
			 VALUES ('Test Sonarr', 'sonarr', 'http://localhost:8989', ?, ?, ?, 1)`,
			[ARR_API_KEY, ARR_BASIC_AUTH_USERNAME, ARR_BASIC_AUTH_PASSWORD]
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
		profilarrApiKeyHash = await bcryptHash(PROFILARR_API_KEY);
		db.exec(
			`INSERT INTO api_keys (name, key_hash, key_hint, permissions) VALUES ('Exposure Test', ?, ?, '"all"')`,
			[profilarrApiKeyHash, PROFILARR_API_KEY.slice(-4)]
		);

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

		// One notification service per type, each with its secret
		const services: Array<[keyof typeof notificationServiceIds, string, Record<string, unknown>]> =
			[
				['discord', 'Test Discord', { webhook_url: WEBHOOK_URL, username: 'Profilarr' }],
				[
					'ntfy',
					'Test Ntfy',
					{ server_url: 'https://ntfy.sh', topic: 'profilarr', access_token: NTFY_ACCESS_TOKEN }
				],
				[
					'webhook',
					'Test Webhook',
					{ webhook_url: GENERIC_WEBHOOK_URL, auth_header: WEBHOOK_AUTH_HEADER }
				],
				[
					'telegram',
					'Test Telegram',
					// Unreachable address, so a send fails at the network level and the
					// error text, which can carry the request URL, is recorded in history
					{ bot_token: TELEGRAM_BOT_TOKEN, chat_id: '42', api_base_url: 'http://127.0.0.1:1' }
				]
			];
		for (const [type, name, config] of services) {
			const id = crypto.randomUUID();
			notificationServiceIds[type] = id;
			db.exec(
				`INSERT INTO notification_services (id, name, service_type, enabled, config, enabled_types)
				 VALUES (?, ?, ?, 1, ?, '[]')`,
				[id, name, type, JSON.stringify(config)]
			);
		}
	} finally {
		db.close();
	}
}

/**
 * Login and fetch a page, return the body text. Accept HTML like a browser
 * does, so routes that also have a JSON endpoint (such as /arr/[id]/logs)
 * render the page.
 */
async function fetchPage(path: string): Promise<string> {
	const client = new TestClient(ORIGIN);
	await login(client, 'admin', 'password123', ORIGIN);
	const res = await client.get(path, { followRedirects: true, headers: { Accept: 'text/html' } });
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

// --- Arr credentials ---

function assertArrCredentialsNotExposed(body: string) {
	assertNotExposed(body, ARR_API_KEY, 'arr API key');
	assertNotExposed(body, ARR_BASIC_AUTH_USERNAME, 'arr Basic Auth username');
	assertNotExposed(body, ARR_BASIC_AUTH_PASSWORD, 'arr Basic Auth password');
}

test('/arr list does not expose arr credentials', async () => {
	const body = await fetchPage('/arr');
	assertArrCredentialsNotExposed(body);
});

test('/arr/[id]/upgrades does not expose arr credentials', async () => {
	const body = await fetchPage(`/arr/${arrInstanceId}/upgrades`);
	assertArrCredentialsNotExposed(body);
});

test('/arr/[id]/rename does not expose arr credentials', async () => {
	const body = await fetchPage(`/arr/${arrInstanceId}/rename`);
	assertArrCredentialsNotExposed(body);
});

test('/arr/[id]/sync does not expose arr credentials', async () => {
	const body = await fetchPage(`/arr/${arrInstanceId}/sync`);
	assertArrCredentialsNotExposed(body);
});

test('/arr/[id]/logs does not expose arr credentials', async () => {
	const body = await fetchPage(`/arr/${arrInstanceId}/logs`);
	assertArrCredentialsNotExposed(body);
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
	assertNotExposed(body, profilarrApiKeyHash, 'Profilarr API key hash');
});

// --- Notification service secrets ---

test('/settings/notifications does not expose any service secret', async () => {
	const body = await fetchPage('/settings/notifications');
	for (const [secret, label] of NOTIFICATION_SECRETS) {
		assertNotExposed(body, secret, label);
	}
});

test('/settings/notifications/edit/[id] does not expose Discord webhook URL', async () => {
	const body = await fetchPage(`/settings/notifications/edit/${notificationServiceIds.discord}`);
	assertNotExposed(body, WEBHOOK_URL, 'Discord webhook URL in edit page');
});

test('/settings/notifications/edit/[id] does not expose Ntfy access token', async () => {
	const body = await fetchPage(`/settings/notifications/edit/${notificationServiceIds.ntfy}`);
	assertNotExposed(body, NTFY_ACCESS_TOKEN, 'Ntfy access token in edit page');
});

test('/settings/notifications/edit/[id] does not expose webhook URL or auth header', async () => {
	const body = await fetchPage(`/settings/notifications/edit/${notificationServiceIds.webhook}`);
	assertNotExposed(body, GENERIC_WEBHOOK_URL, 'webhook URL in edit page');
	assertNotExposed(body, WEBHOOK_AUTH_HEADER, 'webhook auth header in edit page');
});

test('/settings/notifications/edit/[id] does not expose Telegram bot token', async () => {
	const body = await fetchPage(`/settings/notifications/edit/${notificationServiceIds.telegram}`);
	assertNotExposed(body, TELEGRAM_BOT_TOKEN, 'Telegram bot token in edit page');
});

test('failed send history does not expose the Telegram bot token', async () => {
	const client = new TestClient(ORIGIN);
	await login(client, 'admin', 'password123', ORIGIN);
	const res = await client.postForm(
		'/settings/notifications?/testNotification',
		{ id: notificationServiceIds.telegram },
		{ headers: { Origin: ORIGIN } }
	);
	assertEquals(res.status, 502, 'a failed test notification should answer 502');
	// The send error goes back to the browser, so it must not carry the token either
	assertNotExposed(await res.text(), TELEGRAM_BOT_TOKEN, 'Telegram bot token in the 502 response');

	const rows = queryDb(
		getDbPath(PORT),
		'SELECT error FROM notification_history WHERE service_id = ? ORDER BY sent_at DESC',
		[notificationServiceIds.telegram]
	) as Array<{ error: string | null }>;
	assertEquals(rows.length >= 1, true, 'a history row should be recorded for the failed send');
	assertEquals(typeof rows[0].error, 'string', 'the failed send should record an error');
	for (const row of rows) {
		assertNotExposed(row.error ?? '', TELEGRAM_BOT_TOKEN, 'Telegram bot token in stored history');
	}

	const page = await client.get('/settings/notifications', { followRedirects: true });
	assertNotExposed(
		await page.text(),
		TELEGRAM_BOT_TOKEN,
		'Telegram bot token in notification history'
	);
});

await run();
