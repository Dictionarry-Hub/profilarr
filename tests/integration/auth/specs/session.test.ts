/**
 * Integration tests: Session lifecycle
 *
 * Tests the full session flow: cookie-based auth, expiry, and sliding expiration.
 * Default session duration is 168 hours (7 days), halfway = 84 hours.
 *
 * Tests:
 * 1. No cookies → 303 redirect to /auth/login
 * 2. Valid session cookie → 200 on protected page
 * 3. Expired session → 303 redirect to /auth/login
 * 4. Unauthenticated API route → 401 JSON (not redirect)
 * 5. Sliding expiration — session past halfway gets extended
 * 6. GET /auth/logout → 405 (must be POST to prevent CSRF)
 * 7. POST /auth/logout without Origin → 403 (SvelteKit CSRF)
 */

import { assertEquals, assertNotEquals } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import {
	createUser,
	login,
	expireSession,
	setSessionExpiry,
	getSessionExpiry
} from '$test-harness/setup.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';

const PORT = 7005;
const ORIGIN = `http://localhost:${PORT}`;

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');
	const client = new TestClient(ORIGIN);
	await createUser(client, 'admin', 'password123', ORIGIN);
});

teardown(async () => {
	await stopServer(PORT);
});

test('no cookies — redirect to /auth/login', async () => {
	const client = new TestClient(ORIGIN);
	const res = await client.get('/');
	assertEquals(res.status, 303);
	assertEquals(res.headers.get('location'), '/auth/login');
});

test('valid session — access protected page', async () => {
	const client = new TestClient(ORIGIN);
	await login(client, 'admin', 'password123', ORIGIN);
	const res = await client.get('/databases');
	assertEquals(res.status, 200);
});

test('expired session — redirect to /auth/login', async () => {
	const client = new TestClient(ORIGIN);
	await login(client, 'admin', 'password123', ORIGIN);

	// Expire the session directly in the DB
	const sessionId = client.getCookie('session')!;
	expireSession(getDbPath(PORT), sessionId);

	const res = await client.get('/');
	assertEquals(res.status, 303);
	assertEquals(res.headers.get('location'), '/auth/login');
});

test('unauthenticated API route — 401 JSON', async () => {
	const client = new TestClient(ORIGIN);
	const res = await client.get('/api/v1/health/diagnostics');
	assertEquals(res.status, 401);
	const body = await res.json();
	assertEquals(body.error, 'Unauthorized');
});

test('sliding expiration — session past halfway gets extended', async () => {
	const client = new TestClient(ORIGIN);
	await login(client, 'admin', 'password123', ORIGIN);

	const sessionId = client.getCookie('session')!;
	const dbPath = getDbPath(PORT);

	// Set session to expire in 60 minutes (well past the 84-hour halfway mark)
	setSessionExpiry(dbPath, sessionId, 60);
	const expiryBefore = getSessionExpiry(dbPath, sessionId)!;

	// Make a request — middleware should extend the session
	const res = await client.get('/databases');
	assertEquals(res.status, 200);

	const expiryAfter = getSessionExpiry(dbPath, sessionId)!;
	assertNotEquals(expiryBefore, expiryAfter);
});

// --- Logout CSRF protection (SA-07) ---

test('GET /auth/logout — 405 method not allowed', async () => {
	const client = new TestClient(ORIGIN);
	await login(client, 'admin', 'password123', ORIGIN);
	const res = await client.get('/auth/logout');
	assertEquals(res.status, 405, `Expected 405 for GET logout, got ${res.status}`);
});

test('POST /auth/logout without Origin — blocked by CSRF', async () => {
	const client = new TestClient(ORIGIN);
	await login(client, 'admin', 'password123', ORIGIN);
	// No Origin header = SvelteKit CSRF rejection
	const res = await client.postForm('/auth/logout', {});
	assertEquals(res.status, 403, `Expected 403 for POST without Origin, got ${res.status}`);
});

await run();
