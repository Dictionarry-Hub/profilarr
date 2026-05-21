/**
 * Integration tests: GET /api/v1/arr
 *
 * Tests:
 * 1. Returns 401 without auth
 * 2. Returns 200 with empty array when no instances exist
 * 3. Returns populated array after seeding an instance
 * 4. Response does not contain stored credentials
 */

import { assertEquals, assertExists } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { createUserDirect, setApiKey } from '$test-harness/setup.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { openDb } from '$test-harness/db.ts';

const PORT = PORTS.api.arr;
const ORIGIN = `http://localhost:${PORT}`;
const API_KEY = 'arr-test-key-abc123';

let client: TestClient;

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

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');
	const dbPath = getDbPath(PORT);
	await createUserDirect(dbPath, 'admin', 'password123');
	await setApiKey(dbPath, API_KEY);
	client = new TestClient(ORIGIN);
});

teardown(async () => {
	await stopServer(PORT);
});

test('GET /api/v1/arr returns 401 without auth', async () => {
	const unauthClient = new TestClient(ORIGIN);
	const res = await unauthClient.get('/api/v1/arr');
	assertEquals(res.status, 401);
});

test('GET /api/v1/arr returns 200 with empty array', async () => {
	const res = await client.get('/api/v1/arr', {
		headers: { 'X-Api-Key': API_KEY }
	});
	assertEquals(res.status, 200);
	const body = await res.json();
	assertEquals(Array.isArray(body), true);
	assertEquals(body.length, 0);
});

test('GET /api/v1/arr returns seeded instance', async () => {
	seedArrInstance(getDbPath(PORT));
	const res = await client.get('/api/v1/arr', {
		headers: { 'X-Api-Key': API_KEY }
	});
	assertEquals(res.status, 200);
	const body = await res.json();
	assertEquals(body.length, 1);
	assertEquals(body[0].name, 'Test Radarr');
	assertEquals(body[0].type, 'radarr');
	assertEquals(body[0].url, 'http://localhost:7878');
	assertExists(body[0].enabled);
});

test('response does not contain stored credentials', async () => {
	const res = await client.get('/api/v1/arr', {
		headers: { 'X-Api-Key': API_KEY }
	});
	const body = await res.json();
	assertEquals(body.length, 1);
	assertEquals(body[0].api_key, undefined);
	assertEquals(body[0].basic_auth_username, undefined);
	assertEquals(body[0].basic_auth_password, undefined);
});

await run();
