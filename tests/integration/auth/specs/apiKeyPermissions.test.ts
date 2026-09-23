/**
 * Integration tests: API key permissions
 *
 * Each /api/v1 operation declares `x-permission: read | write` and its tag is
 * its area. Scoped keys are checked against that; full-access keys pass.
 *
 * Tests:
 * 1. Read key can read its areas (GET and HEAD)
 * 2. Read key gets 403 on areas it wasn't granted
 * 3. Read key gets 403 on writes to its own areas
 * 4. Write key can read and write its area
 * 5. Write key gets 403 on other areas
 * 6. Unknown access values are ignored (no access)
 * 7. Expired key gets 401 with an expiry message
 * 8. Deleted key stops working on the next request
 * 9. last_used_at is recorded
 *
 * Writes target a database that doesn't exist, so a denied request proves the
 * permission check and an allowed one reaches the handler's 404 without
 * changing anything.
 */

import { assert, assertEquals } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { createUser, setApiKey, deleteApiKey } from '$test-harness/setup.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { openDb } from '$test-harness/db.ts';

const PORT = PORTS.auth.apiKeyPermissions;
const ORIGIN = `http://localhost:${PORT}`;

const READ_KEY = 'test-permissions-read-key-00000001';
const WRITE_KEY = 'test-permissions-write-key-0000002';
const BOGUS_KEY = 'test-permissions-bogus-key-0000003';
const EXPIRED_KEY = 'test-permissions-expired-key-00004';
const DELETED_KEY = 'test-permissions-deleted-key-00005';

const MISSING_DATABASE = '/api/v1/databases/999999';

let client: TestClient;

async function errorOf(res: Response): Promise<string> {
	const body = (await res.json()) as { error?: string };
	return body.error ?? '';
}

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');
	// Creating the user logs that client in; key requests use a separate
	// client so a rejected key can't fall back to the session.
	await createUser(new TestClient(ORIGIN), 'admin', 'password123', ORIGIN);
	client = new TestClient(ORIGIN);

	const dbPath = getDbPath(PORT);
	await setApiKey(dbPath, READ_KEY, {
		name: 'read',
		permissions: { system: 'read', databases: 'read' }
	});
	await setApiKey(dbPath, WRITE_KEY, {
		name: 'write',
		permissions: { databases: 'write' }
	});
	await setApiKey(dbPath, BOGUS_KEY, {
		name: 'bogus',
		permissions: { databases: 'admin' }
	});
	await setApiKey(dbPath, EXPIRED_KEY, {
		name: 'expired',
		expiresAt: '2020-01-01T00:00:00.000Z'
	});
	await setApiKey(dbPath, DELETED_KEY, { name: 'deleted' });
});

teardown(async () => {
	await stopServer(PORT);
});

// --- Read key: System read, Databases read ---

test('read key can GET its areas', async () => {
	const status = await client.get('/api/v1/status', { headers: { 'X-Api-Key': READ_KEY } });
	assertEquals(status.status, 200);
	const databases = await client.get('/api/v1/databases', { headers: { 'X-Api-Key': READ_KEY } });
	assertEquals(databases.status, 200);
});

test('read key can HEAD its areas', async () => {
	const res = await fetch(`${ORIGIN}/api/v1/status`, {
		method: 'HEAD',
		headers: { 'X-Api-Key': READ_KEY }
	});
	assertEquals(res.status, 200);
});

test('read key gets 403 on areas it was not granted', async () => {
	const arr = await client.get('/api/v1/arr', { headers: { 'X-Api-Key': READ_KEY } });
	assertEquals(arr.status, 403);
	assertEquals(await errorOf(arr), 'API key does not have read access to Arr');

	const job = await client.get('/api/v1/jobs/1', { headers: { 'X-Api-Key': READ_KEY } });
	assertEquals(job.status, 403);
	assertEquals(await errorOf(job), 'API key does not have read access to Jobs');
});

test('read key gets 403 on writes to its own area', async () => {
	const res = await client.patch(MISSING_DATABASE, {}, { headers: { 'X-Api-Key': READ_KEY } });
	assertEquals(res.status, 403);
	assertEquals(await errorOf(res), 'API key does not have write access to Databases');
});

// --- Write key: Databases read & write ---

test('write key can read its area', async () => {
	const res = await client.get('/api/v1/databases', { headers: { 'X-Api-Key': WRITE_KEY } });
	assertEquals(res.status, 200);
});

test('write key can write its area', async () => {
	// Passing the permission check reaches the handler, which 404s
	const res = await client.patch(MISSING_DATABASE, {}, { headers: { 'X-Api-Key': WRITE_KEY } });
	assertEquals(res.status, 404);
});

test('write key gets 403 on other areas', async () => {
	const status = await client.get('/api/v1/status', { headers: { 'X-Api-Key': WRITE_KEY } });
	assertEquals(status.status, 403);
	assertEquals(await errorOf(status), 'API key does not have read access to System');
});

// --- Edge cases ---

test('unknown access values grant nothing', async () => {
	const res = await client.get('/api/v1/databases', { headers: { 'X-Api-Key': BOGUS_KEY } });
	assertEquals(res.status, 403);
});

test('expired key returns 401 with an expiry message', async () => {
	const res = await client.get('/api/v1/status', { headers: { 'X-Api-Key': EXPIRED_KEY } });
	assertEquals(res.status, 401);
	assertEquals(await errorOf(res), 'API key has expired');
});

test('deleted key stops working on the next request', async () => {
	const before = await client.get('/api/v1/status', { headers: { 'X-Api-Key': DELETED_KEY } });
	assertEquals(before.status, 200);

	deleteApiKey(getDbPath(PORT), 'deleted');

	const after = await client.get('/api/v1/status', { headers: { 'X-Api-Key': DELETED_KEY } });
	assertEquals(after.status, 401);
});

test('last_used_at is recorded when a key is used', () => {
	const db = openDb(getDbPath(PORT));
	try {
		const row = db.prepare("SELECT last_used_at FROM api_keys WHERE name = 'read'").get() as {
			last_used_at: string | null;
		};
		assert(row.last_used_at !== null, 'read key should have a last_used_at after use');
	} finally {
		db.close();
	}
});

await run();
