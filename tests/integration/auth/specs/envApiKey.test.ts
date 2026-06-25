/**
 * Integration tests: environment-managed API key authentication
 *
 * Tests:
 * 1. PROFILARR_API_KEY authenticates API requests
 * 2. Stored database API key is ignored while PROFILARR_API_KEY is set
 * 3. Session user cannot regenerate an env-managed API key
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

test('database API key returns 401 when PROFILARR_API_KEY is set', async () => {
	// PROFILARR_API_KEY is the active key when configured; the stored hash is ignored.
	const c = new TestClient(ORIGIN);
	const res = await c.get('/api/v1/status', {
		headers: { 'X-Api-Key': DB_API_KEY }
	});
	assertEquals(res.status, 401, `Expected DB-backed key to be ignored, got ${res.status}`);
});

test('session user cannot regenerate API key when PROFILARR_API_KEY is set', async () => {
	// A logged-in admin should not be able to rotate an env-managed key from the UI.
	const res = await login(client, 'admin', 'password123', ORIGIN);
	assertEquals(res.status, 200);

	const regen = await client.postForm(
		'/settings/security?/regenerateApiKey',
		{},
		{ headers: { Origin: ORIGIN } }
	);
	const body = await regen.text();
	assertEquals(regen.status, 200);
	assertEquals(
		body.includes('"status":400'),
		true,
		`Expected form failure status 400 for env-managed key regeneration, got ${body}`
	);
});

await run();
