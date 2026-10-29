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

import { TestClient } from '#integration/harness/client.ts';
import { startServer, stopServer, getDbPath } from '#integration/harness/server.ts';
import {
	createUser,
	login,
	expireSession,
	setSessionExpiry,
	getSessionExpiry
} from '#integration/harness/setup.ts';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';

const PORT = PORTS.auth.session;
const ORIGIN = `http://localhost:${PORT}`;

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');
	const client = new TestClient(ORIGIN);
	await createUser(client, 'admin', 'password123', ORIGIN);
});

afterAll(async () => {
	await stopServer(PORT);
});

test('no cookies — redirect to /auth/login', async () => {
	const client = new TestClient(ORIGIN);
	const res = await client.get('/');
	expect(res.status).toStrictEqual(303);
	expect(res.headers.get('location')).toStrictEqual('/auth/login');
});

test('valid session — access protected page', async () => {
	const client = new TestClient(ORIGIN);
	await login(client, 'admin', 'password123', ORIGIN);
	const res = await client.get('/databases');
	expect(res.status).toStrictEqual(200);
});

test('expired session — redirect to /auth/login', async () => {
	const client = new TestClient(ORIGIN);
	await login(client, 'admin', 'password123', ORIGIN);

	// Expire the session directly in the DB
	const sessionId = client.getCookie('session')!;
	expireSession(getDbPath(PORT), sessionId);

	const res = await client.get('/');
	expect(res.status).toStrictEqual(303);
	expect(res.headers.get('location')).toStrictEqual('/auth/login');
});

test('unauthenticated API route — 401 JSON', async () => {
	const client = new TestClient(ORIGIN);
	const res = await client.get('/api/v1/status');
	expect(res.status).toStrictEqual(401);
	const body = await res.json();
	expect(body.error).toStrictEqual('Unauthorized');
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
	expect(res.status).toStrictEqual(200);

	const expiryAfter = getSessionExpiry(dbPath, sessionId)!;
	expect(expiryBefore).not.toStrictEqual(expiryAfter);
});

// --- Logout CSRF protection (SA-07) ---

test('GET /auth/logout — 405 method not allowed', async () => {
	const client = new TestClient(ORIGIN);
	await login(client, 'admin', 'password123', ORIGIN);
	const res = await client.get('/auth/logout');
	expect(res.status, `Expected 405 for GET logout, got ${res.status}`).toStrictEqual(405);
});

test('POST /auth/logout without Origin — blocked by CSRF', async () => {
	const client = new TestClient(ORIGIN);
	await login(client, 'admin', 'password123', ORIGIN);
	// No Origin header = SvelteKit CSRF rejection
	const res = await client.postForm('/auth/logout', {});
	expect(res.status, `Expected 403 for POST without Origin, got ${res.status}`).toStrictEqual(403);
});
