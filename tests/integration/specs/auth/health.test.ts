/**
 * Integration tests: Health endpoint
 *
 * Tests:
 * 1. GET /api/v1/health is public — returns 200 with minimal body
 */

import { assertEquals, assertExists } from '@std/assert';
import { TestClient } from '#integration/harness/client.ts';
import { startServer, stopServer, getDbPath } from '#integration/harness/server.ts';
import { createUserDirect } from '#integration/harness/setup.ts';
import { afterAll, beforeAll, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';

const PORT = PORTS.auth.health;
const ORIGIN = `http://localhost:${PORT}`;

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');
	await createUserDirect(getDbPath(PORT), 'admin', 'password123');
});

afterAll(async () => {
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
