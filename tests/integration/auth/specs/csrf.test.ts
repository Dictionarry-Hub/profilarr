/**
 * Integration tests: CSRF / Origin checking
 *
 * SvelteKit rejects form POSTs when the Origin header doesn't match
 * the expected origin. The adapter rewrites request.url using the ORIGIN
 * env var so CSRF works behind reverse proxies.
 *
 * NOTE: Requires production build (deno task build) — SvelteKit skips
 * CSRF checks in dev mode.
 *
 * Tests:
 * 1. POST with evil origin → 403
 * 2. POST with correct origin → not 403
 * 3. POST with no origin header → 403
 * 4. No ORIGIN env — matching host origin → not 403
 * 5. No ORIGIN env — mismatched origin → 403
 * 6. ORIGIN env differs from server URL — matching ORIGIN → not 403
 * 7. ORIGIN env differs from server URL — mismatched origin → 403
 */

import { assertEquals, assertNotEquals } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { createUser, createUserDirect } from '../harness/setup.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';

const PORT = 7002;
const ORIGIN = `http://localhost:${PORT}`;

// Tests 4-5: no ORIGIN env — SvelteKit falls back to request URL
const NO_ORIGIN_PORT = 7012;
const NO_ORIGIN_URL = `http://localhost:${NO_ORIGIN_PORT}`;

// Tests 6-7: ORIGIN differs from actual server URL (reverse proxy scenario)
const PROXY_PORT = 7014;
const PROXY_ORIGIN = 'https://profilarr.mydomain.com';

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');
	const client = new TestClient(ORIGIN);
	await createUser(client, 'admin', 'password123', ORIGIN);
});

teardown(async () => {
	await stopServer(PORT);
	await stopServer(NO_ORIGIN_PORT);
	await stopServer(PROXY_PORT);
});

test('POST with mismatched origin returns 403', async () => {
	const client = new TestClient(ORIGIN);
	const res = await client.postForm(
		'/auth/login',
		{ username: 'admin', password: 'password123' },
		{ headers: { Origin: 'http://evil.com' } }
	);
	assertEquals(res.status, 403);
});

test('POST with correct origin does not return 403', async () => {
	const client = new TestClient(ORIGIN);
	const res = await client.postForm(
		'/auth/login',
		{ username: 'admin', password: 'wrong' },
		{ headers: { Origin: ORIGIN } }
	);
	assertNotEquals(res.status, 403);
});

test('POST with no origin header returns 403', async () => {
	const client = new TestClient(ORIGIN);
	const res = await client.postForm('/auth/login', { username: 'admin', password: 'password123' });
	assertEquals(res.status, 403);
});

test('no ORIGIN env — POST with matching host origin is accepted', async () => {
	await startServer(NO_ORIGIN_PORT, { AUTH: 'on' }, 'preview');
	const client = new TestClient(NO_ORIGIN_URL);
	await createUser(client, 'admin', 'password123', NO_ORIGIN_URL);
	const res = await client.postForm(
		'/auth/login',
		{ username: 'admin', password: 'wrong' },
		{ headers: { Origin: NO_ORIGIN_URL } }
	);
	assertNotEquals(res.status, 403);
});

test('no ORIGIN env — POST with mismatched origin returns 403', async () => {
	const client = new TestClient(NO_ORIGIN_URL);
	const res = await client.postForm(
		'/auth/login',
		{ username: 'admin', password: 'wrong' },
		{ headers: { Origin: 'https://profilarr.mydomain.com' } }
	);
	assertEquals(res.status, 403);
});

test('ORIGIN env (reverse proxy) — POST with matching ORIGIN accepted', async () => {
	// Server on port 7014 but ORIGIN says https://profilarr.mydomain.com
	// The adapter rewrites request.url so SvelteKit sees the ORIGIN, not localhost
	await startServer(PROXY_PORT, { AUTH: 'on', ORIGIN: PROXY_ORIGIN }, 'preview');
	await createUserDirect(getDbPath(PROXY_PORT), 'admin', 'password123');
	const client = new TestClient(`http://localhost:${PROXY_PORT}`);
	const res = await client.postForm(
		'/auth/login',
		{ username: 'admin', password: 'wrong' },
		{ headers: { Origin: PROXY_ORIGIN } }
	);
	assertNotEquals(res.status, 403);
});

test('ORIGIN env (reverse proxy) — POST with evil origin returns 403', async () => {
	const client = new TestClient(`http://localhost:${PROXY_PORT}`);
	const res = await client.postForm(
		'/auth/login',
		{ username: 'admin', password: 'wrong' },
		{ headers: { Origin: 'http://evil.com' } }
	);
	assertEquals(res.status, 403);
});

await run();
