/**
 * Integration tests: environment-managed API key authentication
 *
 * Tests:
 * 1. PROFILARR_API_KEY authenticates API requests
 * 2. Stored database API keys keep working alongside PROFILARR_API_KEY
 * 3. The env key's display name is reserved for new keys
 */

import { assertEquals } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { createUser, login, setApiKey } from '$test-harness/setup.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';

const PORT = PORTS.auth.envApiKey;
const ORIGIN = `http://localhost:${PORT}`;
const API_KEY = 'test-env-api-key-valid-1234567890';
const DB_API_KEY = 'test-db-api-key-valid-1234567890';

let client: TestClient;

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN, PROFILARR_API_KEY: API_KEY }, 'preview');
	client = new TestClient(ORIGIN);
	await createUser(client, 'admin', 'password123', ORIGIN);
	await setApiKey(getDbPath(PORT), DB_API_KEY);
});

teardown(async () => {
	await stopServer(PORT);
});

test('PROFILARR_API_KEY returns 200', async () => {
	const c = new TestClient(ORIGIN);
	const res = await c.get('/api/v1/status', {
		headers: { 'X-Api-Key': API_KEY }
	});
	assertEquals(res.status, 200);
});

test('database API key still returns 200 when PROFILARR_API_KEY is set', async () => {
	// The env key works alongside stored keys; setting it doesn't disable them.
	const c = new TestClient(ORIGIN);
	const res = await c.get('/api/v1/status', {
		headers: { 'X-Api-Key': DB_API_KEY }
	});
	assertEquals(res.status, 200, `Expected DB-backed key to keep working, got ${res.status}`);
});

test('session user cannot create a key named "Environment"', async () => {
	// The env key is listed as "Environment"; a stored key with that name
	// would be indistinguishable from it in the UI and logs.
	const res = await login(client, 'admin', 'password123', ORIGIN);
	assertEquals(res.status, 200);

	const create = await client.postForm(
		'/settings/security/api-keys/new?/create',
		{ name: 'environment', expiry: 'never', fullAccess: 'on', permissions: '{}' },
		{ headers: { Origin: ORIGIN } }
	);
	const body = await create.text();
	assertEquals(create.status, 200);
	assertEquals(
		body.includes('"status":400'),
		true,
		`Expected form failure status 400 for reserved key name, got ${body}`
	);
});

await run();
