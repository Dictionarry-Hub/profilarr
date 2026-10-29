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

import { TestClient } from '#integration/harness/client.ts';
import { startServer, stopServer, getDbPath } from '#integration/harness/server.ts';
import { createUserDirect } from '#integration/harness/setup.ts';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';

const PORT = PORTS.auth.localBypass;
const ORIGIN = `http://localhost:${PORT}`;

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');
	await createUserDirect(getDbPath(PORT), 'admin', 'password123');
});

afterAll(async () => {
	await stopServer(PORT);
});

test('local requests require auth', async () => {
	const client = new TestClient(ORIGIN);
	const res = await client.get('/databases');

	expect(res.status, 'Unauthenticated local request should redirect').toStrictEqual(303);
	expect(res.headers.get('location'), 'Redirect should target login').toStrictEqual('/auth/login');
});
