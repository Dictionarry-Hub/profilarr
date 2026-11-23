/**
 * Integration tests: /api/v1/arr
 *
 * GET /arr:
 * 1. Returns 401 without auth
 * 2. Returns 200 with empty array when no instances exist
 * 3. Returns populated array after seeding an instance
 * 4. Response does not contain stored credentials
 * 5. Detected version fields are present and null until a probe runs
 *
 * POST /arr:
 * 6. Returns 401 without auth
 * 7. Returns 400 for missing fields, an unknown type, half a Basic Auth pair, or bad tags
 * 8. Returns 201 and never returns credentials
 * 9. Returns 400 for a duplicate name, and for a duplicate type and URL
 * 10. The created instance is listed by GET /arr
 *
 * PATCH /arr/{id}:
 * 11. Returns 404 for a non-existent ID
 * 12. Returns 400 for an empty body, and when the type is sent
 * 13. Keeps fields that are left out, and clears external_url with null
 * 14. Returns 400 when the URL changes without the API key, and leaves the row alone
 * 15. Treats a trailing slash as the same URL
 * 16. Accepts a URL change with the API key, and drops saved Basic Auth
 * 17. Returns 400 when the name belongs to another instance
 *
 * DELETE /arr/{id}:
 * 18. Returns 404 for a non-existent ID
 * 19. Returns 204 and the instance is gone
 */

import { TestClient } from '#integration/harness/client.ts';
import { startServer, stopServer, getDbPath } from '#integration/harness/server.ts';
import { createUserDirect, setApiKey } from '#integration/harness/setup.ts';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';
import { openDb } from '#integration/harness/db.ts';

const PORT = PORTS.api.arr;
const ORIGIN = `http://localhost:${PORT}`;
const API_KEY = 'arr-test-key-abc123';

let client: TestClient;

const AUTH = { headers: { 'X-Api-Key': API_KEY } };

// Nothing listens here, so the version probe fails fast and must not fail the request
const SONARR_URL = 'http://127.0.0.1:1/sonarr';

let sonarrId: number;

function storedInstance(id: number): Record<string, unknown> | undefined {
	const db = openDb(getDbPath(PORT));
	try {
		return db.prepare('SELECT * FROM arr_instances WHERE id = ?').get(id) as
			Record<string, unknown> | undefined;
	} finally {
		db.close();
	}
}

function seedArrInstance(dbPath: string): void {
	const db = openDb(dbPath);
	try {
		db.exec(
			`INSERT INTO arr_instances (
				name, type, url, api_key, basic_auth_username, basic_auth_password, enabled
			)
			 VALUES (
				'Test Radarr',
				'radarr',
				'http://localhost:7878',
				'secret-arr-api-key',
				'proxy-user',
				'proxy-pass',
				1
			)`
		);
	} finally {
		db.close();
	}
}

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');
	const dbPath = getDbPath(PORT);
	await createUserDirect(dbPath, 'admin', 'password123');
	await setApiKey(dbPath, API_KEY);
	client = new TestClient(ORIGIN);
});

afterAll(async () => {
	await stopServer(PORT);
});

test('GET /api/v1/arr returns 401 without auth', async () => {
	const unauthClient = new TestClient(ORIGIN);
	const res = await unauthClient.get('/api/v1/arr');
	expect(res.status).toStrictEqual(401);
});

test('GET /api/v1/arr returns 200 with empty array', async () => {
	const res = await client.get('/api/v1/arr', {
		headers: { 'X-Api-Key': API_KEY }
	});
	expect(res.status).toStrictEqual(200);
	const body = await res.json();
	expect(Array.isArray(body)).toStrictEqual(true);
	expect(body.length).toStrictEqual(0);
});

test('GET /api/v1/arr returns seeded instance', async () => {
	seedArrInstance(getDbPath(PORT));
	const res = await client.get('/api/v1/arr', {
		headers: { 'X-Api-Key': API_KEY }
	});
	expect(res.status).toStrictEqual(200);
	const body = await res.json();
	expect(body.length).toStrictEqual(1);
	expect(body[0].name).toStrictEqual('Test Radarr');
	expect(body[0].type).toStrictEqual('radarr');
	expect(body[0].url).toStrictEqual('http://localhost:7878');
	expect(body[0].enabled).not.toBeOneOf([null, undefined]);
});

test('response does not contain stored credentials', async () => {
	const res = await client.get('/api/v1/arr', {
		headers: { 'X-Api-Key': API_KEY }
	});
	const body = await res.json();
	expect(body.length).toStrictEqual(1);
	expect(body[0].api_key).toStrictEqual(undefined);
	expect(body[0].basic_auth_username).toStrictEqual(undefined);
	expect(body[0].basic_auth_password).toStrictEqual(undefined);
});

test('detected version fields are null until a probe runs', async () => {
	const res = await client.get('/api/v1/arr', {
		headers: { 'X-Api-Key': API_KEY }
	});
	const body = await res.json();
	expect(body.length).toStrictEqual(1);
	expect('detected_version' in body[0]).toStrictEqual(true);
	expect(body[0].detected_version).toStrictEqual(null);
	expect(body[0].detected_api).toStrictEqual(null);
	expect(body[0].detected_at).toStrictEqual(null);
});

// --- POST ---

test('POST /api/v1/arr returns 401 without auth', async () => {
	const res = await new TestClient(ORIGIN).post('/api/v1/arr', {
		name: 'No Auth',
		type: 'sonarr',
		url: SONARR_URL,
		api_key: 'k'
	});
	expect(res.status).toStrictEqual(401);
});

test.each([
	['name is missing', { type: 'sonarr', url: SONARR_URL, api_key: 'k' }],
	['api_key is missing', { name: 'A', type: 'sonarr', url: SONARR_URL }],
	['type is unknown', { name: 'A', type: 'plex', url: SONARR_URL, api_key: 'k' }],
	[
		'basic auth has no password',
		{ name: 'A', type: 'sonarr', url: SONARR_URL, api_key: 'k', basic_auth_username: 'u' }
	],
	[
		'tags is not an array of strings',
		{ name: 'A', type: 'sonarr', url: SONARR_URL, api_key: 'k', tags: [1] }
	]
])('POST /api/v1/arr returns 400 when %s', async (_label, body) => {
	const res = await client.post('/api/v1/arr', body, AUTH);
	expect(res.status).toStrictEqual(400);
	expect((await res.json()).error).not.toBeOneOf([null, undefined]);
});

test('POST /api/v1/arr creates an instance and never returns credentials', async () => {
	const res = await client.post(
		'/api/v1/arr',
		{
			name: 'Sonarr',
			type: 'sonarr',
			url: SONARR_URL,
			external_url: 'https://sonarr.example.com',
			api_key: 'secret-sonarr-key',
			basic_auth_username: 'proxy-user',
			basic_auth_password: 'proxy-pass',
			tags: ['tv']
		},
		AUTH
	);
	expect(res.status).toStrictEqual(201);

	const body = await res.json();
	sonarrId = body.id;
	expect(body.name).toStrictEqual('Sonarr');
	expect(body.type).toStrictEqual('sonarr');
	expect(body.url).toStrictEqual(SONARR_URL);
	expect(body.external_url).toStrictEqual('https://sonarr.example.com');
	expect(body.api_key).toStrictEqual(undefined);
	expect(body.basic_auth_username).toStrictEqual(undefined);
	expect(body.basic_auth_password).toStrictEqual(undefined);
	expect(JSON.stringify(body)).not.toContain('secret-sonarr-key');
	expect(JSON.stringify(body)).not.toContain('proxy-pass');

	expect(storedInstance(sonarrId)?.api_key).toStrictEqual('secret-sonarr-key');
});

test('POST /api/v1/arr returns 400 for a duplicate name', async () => {
	const res = await client.post(
		'/api/v1/arr',
		{ name: 'Sonarr', type: 'sonarr', url: 'http://127.0.0.1:2', api_key: 'k' },
		AUTH
	);
	expect(res.status).toStrictEqual(400);
});

test('POST /api/v1/arr returns 400 for a duplicate type and URL', async () => {
	const res = await client.post(
		'/api/v1/arr',
		{ name: 'Sonarr 2', type: 'sonarr', url: `${SONARR_URL}/`, api_key: 'k' },
		AUTH
	);
	expect(res.status).toStrictEqual(400);
});

test('GET /api/v1/arr lists the created instance', async () => {
	const res = await client.get('/api/v1/arr', AUTH);
	const body = await res.json();
	expect(body.map((instance: { name: string }) => instance.name)).toContain('Sonarr');
});

// --- PATCH ---

test('PATCH /api/v1/arr/{id} returns 404 for a non-existent ID', async () => {
	const res = await client.patch('/api/v1/arr/99999', { name: 'x' }, AUTH);
	expect(res.status).toStrictEqual(404);
});

test('PATCH /api/v1/arr/{id} returns 400 for an empty body', async () => {
	const res = await client.patch(`/api/v1/arr/${sonarrId}`, {}, AUTH);
	expect(res.status).toStrictEqual(400);
});

test('PATCH /api/v1/arr/{id} returns 400 when the type is sent', async () => {
	const res = await client.patch(`/api/v1/arr/${sonarrId}`, { type: 'radarr' }, AUTH);
	expect(res.status).toStrictEqual(400);
});

test('PATCH /api/v1/arr/{id} keeps fields that are left out and clears with null', async () => {
	const res = await client.patch(
		`/api/v1/arr/${sonarrId}`,
		{ name: 'Sonarr (renamed)', external_url: null },
		AUTH
	);
	expect(res.status).toStrictEqual(200);

	const body = await res.json();
	expect(body.name).toStrictEqual('Sonarr (renamed)');
	expect(body.external_url).toStrictEqual(null);
	expect(body.url).toStrictEqual(SONARR_URL);

	const row = storedInstance(sonarrId);
	expect(row?.api_key).toStrictEqual('secret-sonarr-key');
	expect(row?.basic_auth_username).toStrictEqual('proxy-user');
	expect(row?.basic_auth_password).toStrictEqual('proxy-pass');
});

test('PATCH /api/v1/arr/{id} returns 400 when the URL changes without the API key', async () => {
	const res = await client.patch(
		`/api/v1/arr/${sonarrId}`,
		{ url: 'http://attacker.example.com' },
		AUTH
	);
	expect(res.status).toStrictEqual(400);
	expect(storedInstance(sonarrId)?.url).toStrictEqual(SONARR_URL);
});

test('PATCH /api/v1/arr/{id} treats a trailing slash as the same URL', async () => {
	const res = await client.patch(`/api/v1/arr/${sonarrId}`, { url: `${SONARR_URL}/` }, AUTH);
	expect(res.status).toStrictEqual(200);
	expect(storedInstance(sonarrId)?.basic_auth_username).toStrictEqual('proxy-user');
});

test('PATCH /api/v1/arr/{id} accepts a new URL with the API key and drops Basic Auth', async () => {
	const res = await client.patch(
		`/api/v1/arr/${sonarrId}`,
		{ url: 'http://127.0.0.1:3/sonarr', api_key: 'rotated-key' },
		AUTH
	);
	expect(res.status).toStrictEqual(200);

	const row = storedInstance(sonarrId);
	expect(row?.url).toStrictEqual('http://127.0.0.1:3/sonarr');
	expect(row?.api_key).toStrictEqual('rotated-key');
	expect(row?.basic_auth_username).toStrictEqual(null);
	expect(row?.basic_auth_password).toStrictEqual(null);
});

test('PATCH /api/v1/arr/{id} returns 400 when the name belongs to another instance', async () => {
	const other = await client.post(
		'/api/v1/arr',
		{ name: 'Radarr', type: 'radarr', url: 'http://127.0.0.1:4/radarr', api_key: 'k' },
		AUTH
	);
	expect(other.status).toStrictEqual(201);

	const res = await client.patch(`/api/v1/arr/${sonarrId}`, { name: 'Radarr' }, AUTH);
	expect(res.status).toStrictEqual(400);
});

// --- DELETE ---

test('DELETE /api/v1/arr/{id} returns 404 for a non-existent ID', async () => {
	const res = await client.delete('/api/v1/arr/99999', AUTH);
	expect(res.status).toStrictEqual(404);
});

test('DELETE /api/v1/arr/{id} removes the instance', async () => {
	const res = await client.delete(`/api/v1/arr/${sonarrId}`, AUTH);
	expect(res.status).toStrictEqual(204);

	const list = await (await client.get('/api/v1/arr', AUTH)).json();
	expect(list.map((instance: { id: number }) => instance.id)).not.toContain(sonarrId);
	expect(storedInstance(sonarrId)).toStrictEqual(undefined);
});
