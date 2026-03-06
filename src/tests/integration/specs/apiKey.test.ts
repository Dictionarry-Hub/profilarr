/**
 * Integration tests: API key authentication
 *
 * Tests:
 * 1. Valid API key → 200
 * 2. Invalid API key → 401
 * 3. No auth → 401
 * 4. API key in query param → 401 (only header accepted)
 */

import { assertEquals } from '@std/assert';
import { TestClient } from '../harness/client.ts';
import { startServer, stopServer, getDbPath } from '../harness/server.ts';
import { createUser, setApiKey } from '../harness/setup.ts';
import { setup, teardown, test, run } from '../harness/runner.ts';

const PORT = 7004;
const ORIGIN = `http://localhost:${PORT}`;
const API_KEY = 'test-api-key-valid-12345';

let client: TestClient;

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN });
	client = new TestClient(ORIGIN);
	await createUser(client, 'admin', 'password123', ORIGIN);
	await setApiKey(getDbPath(PORT), API_KEY);
});

teardown(async () => {
	await stopServer(PORT);
});

test('valid API key returns 200', async () => {
	const c = new TestClient(ORIGIN);
	const res = await c.get('/api/v1/health/diagnostics', {
		headers: { 'X-Api-Key': API_KEY }
	});
	assertEquals(res.status, 200);
});

test('invalid API key returns 401', async () => {
	const c = new TestClient(ORIGIN);
	const res = await c.get('/api/v1/health/diagnostics', {
		headers: { 'X-Api-Key': 'wrong-key' }
	});
	assertEquals(res.status, 401);
});

test('no auth returns 401', async () => {
	const unauthClient = new TestClient(ORIGIN);
	const res = await unauthClient.get('/api/v1/health/diagnostics');
	assertEquals(res.status, 401);
});

test('API key in query param returns 401', async () => {
	const unauthClient = new TestClient(ORIGIN);
	const res = await unauthClient.get(`/api/v1/health/diagnostics?apikey=${API_KEY}`);
	assertEquals(res.status, 401);
});

await run();
