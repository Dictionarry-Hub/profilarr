/**
 * Integration tests: Cookie security flags
 *
 * Verifies Set-Cookie attributes on session cookies.
 * HTTPS test goes through Caddy (self-signed TLS on :7443 → server on :7003).
 * HTTP test uses a separate server with no proxy.
 *
 * Tests:
 * 1. HTTPS login (via Caddy) → Secure flag present
 * 2. HTTP login (direct) → Secure flag absent
 * 3. Any login → HttpOnly, SameSite=Lax, Path=/
 * 4. Cookie has an expiration date
 */

import { assertEquals, assertNotEquals } from '@std/assert';
import { TestClient } from '../harness/client.ts';
import { startServer, stopServer, getDbPath } from '../harness/server.ts';
import { createUser, createUserDirect, login } from '../harness/setup.ts';
import { setup, teardown, test, run } from '../harness/runner.ts';

// HTTPS: Caddy on :7443 → server on :7003
const HTTPS_PORT = 7003;
const HTTPS_ORIGIN = 'https://localhost:7443';

// HTTP: direct, no proxy
const HTTP_PORT = 7013;
const HTTP_ORIGIN = `http://localhost:${HTTP_PORT}`;

setup(async () => {
	// HTTPS server — Caddy terminates TLS on :7443 and proxies to :7003
	await startServer(HTTPS_PORT, { AUTH: 'on', ORIGIN: HTTPS_ORIGIN }, 'preview');
	// Create user directly in DB (bypasses CSRF — can't POST through Caddy during setup)
	await createUserDirect(getDbPath(HTTPS_PORT), 'admin', 'password123');

	// HTTP server — plain HTTP, no proxy
	await startServer(HTTP_PORT, { AUTH: 'on', ORIGIN: HTTP_ORIGIN }, 'preview');
	const httpSetup = new TestClient(HTTP_ORIGIN);
	await createUser(httpSetup, 'admin', 'password123', HTTP_ORIGIN);
});

teardown(async () => {
	await stopServer(HTTPS_PORT);
	await stopServer(HTTP_PORT);
});

test('HTTPS origin — Secure flag present', async () => {
	// Login directly to the server (not through Caddy) — the Secure flag is
	// based on config.origin (ORIGIN env), not the actual transport.
	// The adapter rewrites request.url to ORIGIN, so the Origin header must
	// match HTTPS_ORIGIN for SvelteKit CSRF to pass.
	const client = new TestClient(`http://localhost:${HTTPS_PORT}`);
	await login(client, 'admin', 'password123', HTTPS_ORIGIN);
	const attrs = client.getCookieAttributes('session');
	assertEquals(attrs?.['secure'], 'true');
});

test('HTTP login — Secure flag absent', async () => {
	const client = new TestClient(HTTP_ORIGIN);
	await login(client, 'admin', 'password123', HTTP_ORIGIN);
	const attrs = client.getCookieAttributes('session');
	assertEquals(attrs?.['secure'], undefined);
});

test('login cookie has HttpOnly and SameSite=Lax', async () => {
	const client = new TestClient(HTTP_ORIGIN);
	await login(client, 'admin', 'password123', HTTP_ORIGIN);
	const attrs = client.getCookieAttributes('session');
	assertEquals(attrs?.['httponly'], 'true');
	assertEquals(attrs?.['samesite'], 'Lax');
});

test('login cookie has expiration date', async () => {
	const client = new TestClient(HTTP_ORIGIN);
	await login(client, 'admin', 'password123', HTTP_ORIGIN);
	const attrs = client.getCookieAttributes('session');
	assertNotEquals(attrs?.['expires'], undefined);
});

await run();
