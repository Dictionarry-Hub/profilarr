/**
 * Integration tests: API key authentication
 *
 * Tests:
 * 1. Valid API key → 200
 * 2. Invalid API key → 401
 * 3. No auth → 401
 * 4. API key in query param → 401 (only header accepted)
 * 5. API key rejected for browser pages (scoped to /api/ only)
 * 6. API key rejected for form actions (scoped to /api/ only)
 */

import { assertEquals } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { createUser, setApiKey } from '$test-harness/setup.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';

const PORT = 7004;
const ORIGIN = `http://localhost:${PORT}`;
const API_KEY = 'test-api-key-valid-12345';

let client: TestClient;

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');
	client = new TestClient(ORIGIN);
	await createUser(client, 'admin', 'password123', ORIGIN);
	await setApiKey(getDbPath(PORT), API_KEY);
});

teardown(async () => {
	await stopServer(PORT);
});

test('valid API key returns 200', async () => {
	const c = new TestClient(ORIGIN);
	const res = await c.get('/api/v1/status', {
		headers: { 'X-Api-Key': API_KEY }
	});
	assertEquals(res.status, 200);
});

test('invalid API key returns 401', async () => {
	const c = new TestClient(ORIGIN);
	const res = await c.get('/api/v1/status', {
		headers: { 'X-Api-Key': 'wrong-key' }
	});
	assertEquals(res.status, 401);
});

test('no auth returns 401', async () => {
	const unauthClient = new TestClient(ORIGIN);
	const res = await unauthClient.get('/api/v1/status');
	assertEquals(res.status, 401);
});

test('API key in query param returns 401', async () => {
	const unauthClient = new TestClient(ORIGIN);
	const res = await unauthClient.get(`/api/v1/status?apikey=${API_KEY}`);
	assertEquals(res.status, 401);
});

// --- API key scoping: only /api/ paths, not browser pages or form actions ---

test('API key rejected for browser pages', async () => {
	// API key auth is scoped to /api/ paths only.
	// Non-API paths should get 403 when using API key without a session.
	const c = new TestClient(ORIGIN);
	const res = await c.get('/databases', {
		headers: { 'X-Api-Key': API_KEY }
	});
	assertEquals(res.status, 403, `Expected 403 for browser page with API key, got ${res.status}`);
});

test('API key rejected for form actions', async () => {
	// API key should not be able to invoke settings form actions.
	// regenerateApiKey is particularly dangerous — lets an API key holder lock out the admin.
	const c = new TestClient(ORIGIN);
	const res = await c.postForm(
		'/settings/security?/regenerateApiKey',
		{},
		{ headers: { Origin: ORIGIN, 'X-Api-Key': API_KEY } }
	);
	assertEquals(res.status, 403, `Expected 403 for form action with API key, got ${res.status}`);
});

await run();
