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

import { TestClient } from '#integration/harness/client.ts';
import { startServer, stopServer, getDbPath } from '#integration/harness/server.ts';
import { createUserDirect, setApiKey } from '#integration/harness/setup.ts';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';
import { openDb } from '#integration/harness/db.ts';

const PORT = PORTS.api.status;
const ORIGIN = `http://localhost:${PORT}`;
const API_KEY = 'status-test-key-abc123';

let client: TestClient;

function seedDatabase(dbPath: string): void {
	const db = openDb(dbPath);
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
	const db = openDb(dbPath);
	try {
		db.exec(
			`INSERT INTO arr_instances (name, type, url, api_key, enabled)
			 VALUES ('Test Radarr', 'radarr', 'http://localhost:7878', 'secret-arr-api-key', 1)`
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

test('GET /api/v1/status returns 401 without auth', async () => {
	const unauthClient = new TestClient(ORIGIN);
	const res = await unauthClient.get('/api/v1/status');
	expect(res.status).toStrictEqual(401);
});

test('GET /api/v1/status returns 200 with valid shape', async () => {
	const res = await client.get('/api/v1/status', {
		headers: { 'X-Api-Key': API_KEY }
	});
	expect(res.status).toStrictEqual(200);
	const body = await res.json();
	expect(body.version).not.toBeOneOf([null, undefined]);
	expect(body.uptime).not.toBeOneOf([null, undefined]);
	expect(body.databases).not.toBeOneOf([null, undefined]);
	expect(body.arrs).not.toBeOneOf([null, undefined]);
	expect(body.jobs).not.toBeOneOf([null, undefined]);
	expect(body.backups).not.toBeOneOf([null, undefined]);
});

test('version is a string, uptime is a number', async () => {
	const res = await client.get('/api/v1/status', {
		headers: { 'X-Api-Key': API_KEY }
	});
	const body = await res.json();
	expect(typeof body.version).toStrictEqual('string');
	expect(typeof body.uptime).toStrictEqual('number');
});

test('databases and arrs are arrays', async () => {
	const res = await client.get('/api/v1/status', {
		headers: { 'X-Api-Key': API_KEY }
	});
	const body = await res.json();
	expect(Array.isArray(body.databases)).toStrictEqual(true);
	expect(Array.isArray(body.arrs)).toStrictEqual(true);
});

test('jobs has active, queued, nextRunAt', async () => {
	const res = await client.get('/api/v1/status', {
		headers: { 'X-Api-Key': API_KEY }
	});
	const body = await res.json();
	expect(typeof body.jobs.active).toStrictEqual('number');
	expect(typeof body.jobs.queued).toStrictEqual('number');
	expect('nextRunAt' in body.jobs).toStrictEqual(true);
});

test('backups has enabled and lastBackupAt', async () => {
	const res = await client.get('/api/v1/status', {
		headers: { 'X-Api-Key': API_KEY }
	});
	const body = await res.json();
	expect(typeof body.backups.enabled).toStrictEqual('boolean');
	expect('lastBackupAt' in body.backups).toStrictEqual(true);
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
	expect(testDb).not.toBeOneOf([null, undefined]);
	expect(testDb.enabled).toStrictEqual(true);
	expect(testDb.syncStrategy).toStrictEqual('manual');
	expect(testDb.counts).not.toBeOneOf([null, undefined]);
	expect(typeof testDb.counts.customFormats).toStrictEqual('number');
	expect(typeof testDb.counts.qualityProfiles).toStrictEqual('number');

	const testArr = body.arrs.find((a: { name: string }) => a.name === 'Test Radarr');
	expect(testArr).not.toBeOneOf([null, undefined]);
	expect(testArr.type).toStrictEqual('radarr');
	expect(testArr.enabled).toStrictEqual(true);
	expect(testArr.sync).not.toBeOneOf([null, undefined]);
	expect(testArr.drift).toStrictEqual(null);
});
