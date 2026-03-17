/**
 * Integration tests: Reverse proxy
 *
 * Server on port 7008 with ORIGIN=https://localhost:7444.
 * Caddy terminates TLS on :7444 and proxies to :7008.
 * All requests go through Caddy (the real proxy path).
 *
 * Tests:
 * 1. Full login flow through Caddy — login, follow redirect, access protected page
 * 2. Unauthenticated request through proxy redirects to proxy URL (not internal)
 * 3. X-Forwarded-For recorded as session IP through proxy (Caddy sets real client IP)
 * 4. POST with mismatched Origin through proxy → 403
 * (X-Forwarded-For spoofing tests are in xForwardedFor.test.ts)
 */

import { assertEquals, assertNotEquals, assertStringIncludes } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { createUserDirect, queryDb } from '../harness/setup.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';

const PORT = 7008;
const PROXY_ORIGIN = 'https://localhost:7444';

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN: PROXY_ORIGIN }, 'preview');
	await createUserDirect(getDbPath(PORT), 'admin', 'password123');
});

teardown(async () => {
	await stopServer(PORT);
});

test('full login flow through proxy', async () => {
	const client = new TestClient(PROXY_ORIGIN);

	// Login through Caddy
	const loginRes = await client.postForm(
		'/auth/login',
		{ username: 'admin', password: 'password123' },
		{ headers: { Origin: PROXY_ORIGIN } }
	);

	// SvelteKit form action returns 200 with redirect in body
	assertEquals(loginRes.status, 200);
	const body = await loginRes.text();
	assertStringIncludes(body, '"type":"redirect"');

	// Session cookie should be set
	const session = client.getCookie('session');
	assertNotEquals(session, undefined);

	// Access a protected page with the session
	const pageRes = await client.get('/');
	// Should get 200 (or a page load), not a redirect to login
	assertNotEquals(pageRes.status, 303);
});

test('unauthenticated request redirects to proxy URL', async () => {
	const client = new TestClient(PROXY_ORIGIN);

	// Hit a protected page without a session
	const res = await client.get('/databases');

	assertEquals(res.status, 303);
	const location = res.headers.get('location');
	// Location should be relative or use the proxy origin, not http://localhost:7008
	if (location?.startsWith('http')) {
		assertStringIncludes(location, 'localhost:7444');
	}
	// Either way it should point to /auth/login
	assertStringIncludes(location ?? '', '/auth/login');
});

test('X-Forwarded-For recorded as session IP through proxy', async () => {
	const client = new TestClient(PROXY_ORIGIN);

	// Login through Caddy — Caddy sets X-Forwarded-For to the real client IP
	// (Docker gateway 172.x.x.x), overwriting any client-sent value
	await client.postForm(
		'/auth/login',
		{ username: 'admin', password: 'password123' },
		{ headers: { Origin: PROXY_ORIGIN } }
	);

	const sessionId = client.getCookie('session');
	assertNotEquals(sessionId, undefined);

	// Check the DB — an IP should be recorded (not null)
	const rows = queryDb(getDbPath(PORT), 'SELECT ip_address FROM sessions WHERE id = ?', [
		sessionId!
	]) as { ip_address: string | null }[];

	assertEquals(rows.length, 1);
	assertNotEquals(rows[0].ip_address, null);
});

test('POST with mismatched Origin through proxy returns 403', async () => {
	const client = new TestClient(PROXY_ORIGIN);
	const res = await client.postForm(
		'/auth/login',
		{ username: 'admin', password: 'password123' },
		{ headers: { Origin: 'http://evil.com' } }
	);
	assertEquals(res.status, 403);
});

await run();
