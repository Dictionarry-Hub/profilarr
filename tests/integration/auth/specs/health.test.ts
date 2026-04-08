/**
 * Integration tests: Health endpoint
 *
 * Tests:
 * 1. GET /api/v1/health is public — returns 200 with minimal body
 */

import { assertEquals, assertExists } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { createUserDirect } from '$test-harness/setup.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';

const PORT = 7001;
const ORIGIN = `http://localhost:${PORT}`;

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');
	await createUserDirect(getDbPath(PORT), 'admin', 'password123');
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

await run();
