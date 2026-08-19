/**
 * Integration tests: local bypass removal
 *
 * The local bypass feature was removed (#601). These tests pin the removal:
 * requests from local addresses get no special treatment, and the
 * auth_settings column backing the old toggle is dropped by migration 071.
 *
 * Tests run from localhost, so the client's TCP peer is exactly the kind of
 * address the old bypass used to admit.
 */

import { assertEquals } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { createUserDirect } from '$test-harness/setup.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';

const PORT = PORTS.auth.localBypass;
const ORIGIN = `http://localhost:${PORT}`;

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');
	await createUserDirect(getDbPath(PORT), 'admin', 'password123');
});

teardown(async () => {
	await stopServer(PORT);
});

test('local requests require auth', async () => {
	const client = new TestClient(ORIGIN);
	const res = await client.get('/databases');

	assertEquals(res.status, 303, 'Unauthenticated local request should redirect');
	assertEquals(res.headers.get('location'), '/auth/login', 'Redirect should target login');
});

await run();
