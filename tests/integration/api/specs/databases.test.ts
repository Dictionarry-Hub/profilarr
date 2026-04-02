/**
 * Integration tests: GET /api/v1/databases
 *
 * Tests:
 * 1. Returns 401 without auth
 * 2. Returns 200 with empty array when no databases linked
 * 3. Returns populated array after seeding a database instance
 * 4. Response does not contain personal_access_token or local_path
 */

import { assertEquals, assertExists } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { createUserDirect, setApiKey } from '$test-harness/setup.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { Database } from 'jsr:@db/sqlite@0.12';

const PORT = 7020;
const ORIGIN = `http://localhost:${PORT}`;
const API_KEY = 'databases-test-key-abc123';

let client: TestClient;

function seedDatabase(dbPath: string): void {
	const db = new Database(dbPath);
	try {
		db.exec(
			`INSERT INTO database_instances (uuid, name, repository_url, local_path, personal_access_token, enabled)
			 VALUES (?, 'Test DB', 'https://github.com/test/repo', '/tmp/test-repo', 'secret-pat-value', 1)`,
			[crypto.randomUUID()]
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

test('GET /api/v1/databases returns 401 without auth', async () => {
	const unauthClient = new TestClient(ORIGIN);
	const res = await unauthClient.get('/api/v1/databases');
	assertEquals(res.status, 401);
});

test('GET /api/v1/databases returns 200 with empty array', async () => {
	const res = await client.get('/api/v1/databases', {
		headers: { 'X-Api-Key': API_KEY }
	});
	assertEquals(res.status, 200);
	const body = await res.json();
	assertEquals(Array.isArray(body), true);
	assertEquals(body.length, 0);
});

test('GET /api/v1/databases returns seeded database', async () => {
	seedDatabase(getDbPath(PORT));
	const res = await client.get('/api/v1/databases', {
		headers: { 'X-Api-Key': API_KEY }
	});
	assertEquals(res.status, 200);
	const body = await res.json();
	assertEquals(body.length, 1);
	assertEquals(body[0].name, 'Test DB');
	assertEquals(body[0].repository_url, 'https://github.com/test/repo');
	assertExists(body[0].hasPat);
	assertEquals(body[0].hasPat, true);
});

test('response does not contain secrets or internal fields', async () => {
	const res = await client.get('/api/v1/databases', {
		headers: { 'X-Api-Key': API_KEY }
	});
	const body = await res.json();
	assertEquals(body.length, 1);
	assertEquals(body[0].personal_access_token, undefined);
	assertEquals(body[0].local_path, undefined);
});

await run();
