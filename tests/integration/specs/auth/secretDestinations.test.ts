/**
 * Integration tests: a stored secret must be re-entered to change where it
 * is sent.
 *
 * The update forms keep the stored secret when the secret field is blank.
 * Without a guard, a request that changes only the destination re-points the
 * stored secret at a new host on the next use. These tests post the real form
 * actions and check both the response and the stored row.
 *
 * Forms:
 * - Arr instance: API key is sent to the instance URL
 * - Ntfy service: access token is sent to the server URL
 * - Generic webhook: auth header is sent to the webhook URL
 *
 * Tests:
 * 1. Arr: new URL with blank key is rejected, row unchanged
 * 2. Arr: new URL with a key succeeds
 * 3. Arr: name change with blank key keeps the stored key
 * 4. Arr: same URL with a trailing slash is not a change
 * 5. Ntfy: new server with blank token is rejected when a token is stored
 * 6. Ntfy: new server with a token succeeds
 * 7. Ntfy: topic change with blank token keeps the stored token
 * 8. Ntfy: new server succeeds when no token is stored
 * 9. Webhook: new URL with blank header is rejected when a header is stored
 * 10. Webhook: new URL with a header succeeds
 * 11. Webhook: blank URL and blank header keep both
 * 12. Webhook: new URL succeeds when no header is stored
 */

import { TestClient } from '#integration/harness/client.ts';
import { startServer, stopServer, getDbPath } from '#integration/harness/server.ts';
import { formResult, queryDb } from '#integration/harness/setup.ts';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';
import { openDb } from '#integration/harness/db.ts';

const PORT = PORTS.auth.secretDestinations;
const ORIGIN = `http://localhost:${PORT}`;

const ARR_URL = 'http://sonarr.internal:8989';
const ARR_API_KEY = 'arr-secret-key-abc123';
const NTFY_SERVER = 'https://ntfy.sh';
const NTFY_TOKEN = 'tk_ntfy-secret-token-def456';
const WEBHOOK_URL = 'https://hooks.example.com/secret-path-one';
const WEBHOOK_AUTH = 'Bearer secret-webhook-auth-ghi789';

let arrId: number;
let ntfyWithToken: string;
let ntfyWithoutToken: string;
let webhookWithAuth: string;
let webhookWithoutAuth: string;
/** Each service keeps its own name on update, since names must be unique. */
const serviceNames: Record<string, string> = {};

function seed(dbPath: string) {
	const db = openDb(dbPath);
	try {
		db.exec(
			`INSERT INTO arr_instances (name, type, url, api_key, enabled)
			 VALUES ('Guarded Sonarr', 'sonarr', ?, ?, 1)`,
			[ARR_URL, ARR_API_KEY]
		);
		arrId = (
			db.prepare('SELECT id FROM arr_instances WHERE name = ?').get('Guarded Sonarr') as {
				id: number;
			}
		).id;

		const services: Array<[string, string, Record<string, unknown>]> = [
			[
				'Ntfy With Token',
				'ntfy',
				{ server_url: NTFY_SERVER, topic: 'profilarr', access_token: NTFY_TOKEN }
			],
			['Ntfy Without Token', 'ntfy', { server_url: NTFY_SERVER, topic: 'profilarr' }],
			['Webhook With Auth', 'webhook', { webhook_url: WEBHOOK_URL, auth_header: WEBHOOK_AUTH }],
			['Webhook Without Auth', 'webhook', { webhook_url: WEBHOOK_URL }]
		];
		const ids: string[] = [];
		for (const [name, type, config] of services) {
			const id = crypto.randomUUID();
			ids.push(id);
			db.exec(
				`INSERT INTO notification_services (id, name, service_type, enabled, config, enabled_types)
				 VALUES (?, ?, ?, 1, ?, '[]')`,
				[id, name, type, JSON.stringify(config)]
			);
		}
		[ntfyWithToken, ntfyWithoutToken, webhookWithAuth, webhookWithoutAuth] = ids;
		services.forEach(([name], i) => (serviceNames[ids[i]] = name));
	} finally {
		db.close();
	}
}

const client = () => new TestClient(ORIGIN);
const origin = { headers: { Origin: ORIGIN } };

function arrRow() {
	return queryDb(getDbPath(PORT), 'SELECT name, url, api_key FROM arr_instances WHERE id = ?', [
		arrId
	])[0] as { name: string; url: string; api_key: string };
}

function serviceConfig(id: string): Record<string, unknown> {
	const row = queryDb(getDbPath(PORT), 'SELECT config FROM notification_services WHERE id = ?', [
		id
	])[0] as { config: string };
	return JSON.parse(row.config);
}

async function updateArr(fields: Record<string, string>) {
	const res = await client().postForm(
		`/arr/${arrId}/settings?/update`,
		{
			name: 'Guarded Sonarr',
			type: 'sonarr',
			url: ARR_URL,
			external_url: '',
			api_key: '',
			tags: '[]',
			library_refresh_interval: '0',
			...fields
		},
		origin
	);
	return await formResult(res);
}

async function updateNtfy(id: string, fields: Record<string, string>) {
	const res = await client().postForm(
		`/settings/notifications/edit/${id}?/edit`,
		{
			name: serviceNames[id],
			server_url: NTFY_SERVER,
			topic: 'profilarr',
			access_token: '',
			...fields
		},
		origin
	);
	return await formResult(res);
}

async function updateWebhook(id: string, fields: Record<string, string>) {
	const res = await client().postForm(
		`/settings/notifications/edit/${id}?/edit`,
		{ name: serviceNames[id], webhook_url: '', auth_header: '', ...fields },
		origin
	);
	return await formResult(res);
}

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
	seed(getDbPath(PORT));
});

afterAll(async () => {
	await stopServer(PORT);
});

// --- Arr instance ---

test('arr: new URL with blank key is rejected and the row is unchanged', async () => {
	const result = await updateArr({ url: 'http://attacker.example:8989' });
	expect(result.status).toStrictEqual(400);
	const row = arrRow();
	expect(row.url).toStrictEqual(ARR_URL);
	expect(row.api_key).toStrictEqual(ARR_API_KEY);
});

test('arr: new URL with a key succeeds', async () => {
	const result = await updateArr({ url: 'http://sonarr-new.internal:8989', api_key: 'new-key-1' });
	expect(result.status).toStrictEqual(200);
	const row = arrRow();
	expect(row.url).toStrictEqual('http://sonarr-new.internal:8989');
	expect(row.api_key).toStrictEqual('new-key-1');
	// Put it back for the remaining tests
	await updateArr({ url: ARR_URL, api_key: ARR_API_KEY });
	expect(arrRow().url).toStrictEqual(ARR_URL);
});

test('arr: name change with blank key keeps the stored key', async () => {
	const result = await updateArr({ name: 'Guarded Sonarr Renamed' });
	expect(result.status).toStrictEqual(200);
	const row = arrRow();
	expect(row.name).toStrictEqual('Guarded Sonarr Renamed');
	expect(row.api_key).toStrictEqual(ARR_API_KEY);
	await updateArr({ name: 'Guarded Sonarr' });
});

test('arr: same URL with a trailing slash is not a change', async () => {
	const result = await updateArr({ url: `${ARR_URL}/` });
	expect(result.status).toStrictEqual(200);
	expect(arrRow().api_key).toStrictEqual(ARR_API_KEY);
});

// --- Ntfy ---

test('ntfy: new server with blank token is rejected when a token is stored', async () => {
	const result = await updateNtfy(ntfyWithToken, { server_url: 'https://ntfy.attacker.example' });
	expect(result.status).toStrictEqual(400);
	const config = serviceConfig(ntfyWithToken);
	expect(config.server_url).toStrictEqual(NTFY_SERVER);
	expect(config.access_token).toStrictEqual(NTFY_TOKEN);
});

test('ntfy: new server with a token succeeds', async () => {
	const result = await updateNtfy(ntfyWithToken, {
		server_url: 'https://ntfy.mine.example',
		access_token: 'tk_new-token'
	});
	expect(result.status).toStrictEqual(303);
	const config = serviceConfig(ntfyWithToken);
	expect(config.server_url).toStrictEqual('https://ntfy.mine.example');
	expect(config.access_token).toStrictEqual('tk_new-token');
	await updateNtfy(ntfyWithToken, { access_token: NTFY_TOKEN });
	expect(serviceConfig(ntfyWithToken).server_url).toStrictEqual(NTFY_SERVER);
});

test('ntfy: topic change with blank token keeps the stored token', async () => {
	const result = await updateNtfy(ntfyWithToken, { topic: 'other-topic' });
	expect(result.status).toStrictEqual(303);
	const config = serviceConfig(ntfyWithToken);
	expect(config.topic).toStrictEqual('other-topic');
	expect(config.access_token).toStrictEqual(NTFY_TOKEN);
});

test('ntfy: new server succeeds when no token is stored', async () => {
	const result = await updateNtfy(ntfyWithoutToken, { server_url: 'https://ntfy.other.example' });
	expect(result.status).toStrictEqual(303);
	const config = serviceConfig(ntfyWithoutToken);
	expect(config.server_url).toStrictEqual('https://ntfy.other.example');
	expect(config.access_token).toStrictEqual(undefined);
});

// --- Generic webhook ---

test('webhook: new URL with blank header is rejected when a header is stored', async () => {
	const result = await updateWebhook(webhookWithAuth, {
		webhook_url: 'https://hooks.attacker.example/collect'
	});
	expect(result.status).toStrictEqual(400);
	const config = serviceConfig(webhookWithAuth);
	expect(config.webhook_url).toStrictEqual(WEBHOOK_URL);
	expect(config.auth_header).toStrictEqual(WEBHOOK_AUTH);
});

test('webhook: new URL with a header succeeds', async () => {
	const result = await updateWebhook(webhookWithAuth, {
		webhook_url: 'https://hooks.mine.example/new',
		auth_header: 'Bearer new-auth'
	});
	expect(result.status).toStrictEqual(303);
	const config = serviceConfig(webhookWithAuth);
	expect(config.webhook_url).toStrictEqual('https://hooks.mine.example/new');
	expect(config.auth_header).toStrictEqual('Bearer new-auth');
	await updateWebhook(webhookWithAuth, { webhook_url: WEBHOOK_URL, auth_header: WEBHOOK_AUTH });
	expect(serviceConfig(webhookWithAuth).webhook_url).toStrictEqual(WEBHOOK_URL);
});

test('webhook: blank URL and blank header keep both', async () => {
	const result = await updateWebhook(webhookWithAuth, {});
	expect(result.status).toStrictEqual(303);
	const config = serviceConfig(webhookWithAuth);
	expect(config.webhook_url).toStrictEqual(WEBHOOK_URL);
	expect(config.auth_header).toStrictEqual(WEBHOOK_AUTH);
});

test('webhook: new URL succeeds when no header is stored', async () => {
	const result = await updateWebhook(webhookWithoutAuth, {
		webhook_url: 'https://hooks.other.example/x'
	});
	expect(result.status).toStrictEqual(303);
	const config = serviceConfig(webhookWithoutAuth);
	expect(config.webhook_url).toStrictEqual('https://hooks.other.example/x');
	expect(config.auth_header).toStrictEqual(undefined);
});
