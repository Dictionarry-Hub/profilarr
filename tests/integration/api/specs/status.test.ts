/**
 * Integration tests: GET /api/v1/status
 *
 * Tests:
 * 1. Returns 401 without auth
 * 2. Returns 200 with valid response shape
 * 3. version is a string, uptime is a number
 * 4. databases and arrs are arrays
 * 5. jobs has expected fields
 * 6. backups has expected fields
 * 7. Seeded database and arr appear in response
 */

import { assertEquals, assertExists } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { createUserDirect, setApiKey } from '$test-harness/setup.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { Database } from '@db/sqlite';

const PORT = 7035;
const ORIGIN = `http://localhost:${PORT}`;
const API_KEY = 'status-test-key-abc123';

let client: TestClient;

function seedDatabase(dbPath: string): void {
	const db = new Database(dbPath);
	try {
		db.exec(
			`INSERT INTO database_instances (uuid, name, repository_url, local_path, enabled, sync_strategy)
			 VALUES ('${crypto.randomUUID()}', 'Test DB', 'https://github.com/test/repo', '/tmp/test-repo', 1, 0)`
		);
	} finally {
		db.close();
	}
}

function seedArrInstance(dbPath: string): void {
	const db = new Database(dbPath);
	try {
		db.exec(
			`INSERT INTO arr_instances (name, type, url, api_key, enabled)
			 VALUES ('Test Radarr', 'radarr', 'http://localhost:7878', 'secret-arr-api-key', 1)`
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

test('GET /api/v1/status returns 401 without auth', async () => {
	const unauthClient = new TestClient(ORIGIN);
	const res = await unauthClient.get('/api/v1/status');
	assertEquals(res.status, 401);
});

test('GET /api/v1/status returns 200 with valid shape', async () => {
	const res = await client.get('/api/v1/status', {
		headers: { 'X-Api-Key': API_KEY }
	});
	assertEquals(res.status, 200);
	const body = await res.json();
	assertExists(body.version);
	assertExists(body.uptime);
	assertExists(body.databases);
	assertExists(body.arrs);
	assertExists(body.jobs);
	assertExists(body.backups);
});

test('version is a string, uptime is a number', async () => {
	const res = await client.get('/api/v1/status', {
		headers: { 'X-Api-Key': API_KEY }
	});
	const body = await res.json();
	assertEquals(typeof body.version, 'string');
	assertEquals(typeof body.uptime, 'number');
});

test('databases and arrs are arrays', async () => {
	const res = await client.get('/api/v1/status', {
		headers: { 'X-Api-Key': API_KEY }
	});
	const body = await res.json();
	assertEquals(Array.isArray(body.databases), true);
	assertEquals(Array.isArray(body.arrs), true);
});

test('jobs has active, queued, nextRunAt', async () => {
	const res = await client.get('/api/v1/status', {
		headers: { 'X-Api-Key': API_KEY }
	});
	const body = await res.json();
	assertEquals(typeof body.jobs.active, 'number');
	assertEquals(typeof body.jobs.queued, 'number');
	assertEquals('nextRunAt' in body.jobs, true);
});

test('backups has enabled and lastBackupAt', async () => {
	const res = await client.get('/api/v1/status', {
		headers: { 'X-Api-Key': API_KEY }
	});
	const body = await res.json();
	assertEquals(typeof body.backups.enabled, 'boolean');
	assertEquals('lastBackupAt' in body.backups, true);
});

test('seeded database and arr appear in response', async () => {
	const dbPath = getDbPath(PORT);
	seedDatabase(dbPath);
	seedArrInstance(dbPath);

	const res = await client.get('/api/v1/status', {
		headers: { 'X-Api-Key': API_KEY }
	});
	const body = await res.json();

	// Find the seeded entries (server may have pre-existing data)
	const testDb = body.databases.find((d: { name: string }) => d.name === 'Test DB');
	assertExists(testDb);
	assertEquals(testDb.enabled, true);
	assertEquals(testDb.syncStrategy, 'manual');
	assertExists(testDb.counts);
	assertEquals(typeof testDb.counts.customFormats, 'number');
	assertEquals(typeof testDb.counts.qualityProfiles, 'number');

	const testArr = body.arrs.find((a: { name: string }) => a.name === 'Test Radarr');
	assertExists(testArr);
	assertEquals(testArr.type, 'radarr');
	assertEquals(testArr.enabled, true);
	assertExists(testArr.sync);
	assertEquals(testArr.drift, null);
});

await run();
