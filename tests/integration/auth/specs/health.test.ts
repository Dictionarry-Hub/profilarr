/**
 * Integration tests: Health endpoint
 *
 * Tests:
 * 1. GET /api/v1/health is public — returns 200 with minimal body
 * 2. GET /api/v1/health/diagnostics requires auth — returns 401
 * 3. Authenticated diagnostics returns full breakdown
 */

import { assertEquals, assertExists } from '@std/assert';
import { TestClient } from '../harness/client.ts';
import { startServer, stopServer, getDbPath } from '../harness/server.ts';
import { createUser, setApiKey } from '../harness/setup.ts';
import { setup, teardown, test, run } from '../harness/runner.ts';

const PORT = 7001;
const ORIGIN = `http://localhost:${PORT}`;
const API_KEY = 'test-api-key-health-12345';

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

test('GET /api/v1/health returns 200 without auth', async () => {
	const unauthClient = new TestClient(ORIGIN);
	const res = await unauthClient.get('/api/v1/health');
	assertEquals(res.status, 200);

	const body = await res.json();
	assertExists(body.status);
	assertExists(body.timestamp);

	// Should NOT have detailed fields
	assertEquals(body.version, undefined);
	assertEquals(body.uptime, undefined);
	assertEquals(body.components, undefined);
});

test('GET /api/v1/health/diagnostics returns 401 without auth', async () => {
	const unauthClient = new TestClient(ORIGIN);
	const res = await unauthClient.get('/api/v1/health/diagnostics');
	assertEquals(res.status, 401);
});

test('GET /api/v1/health/diagnostics returns 200 with API key', async () => {
	const res = await client.get('/api/v1/health/diagnostics', {
		headers: { 'X-Api-Key': API_KEY }
	});
	assertEquals(res.status, 200);

	const body = await res.json();
	assertExists(body.status);
	assertExists(body.timestamp);
	assertExists(body.version);
	assertExists(body.uptime);
	assertExists(body.components);
});

await run();
