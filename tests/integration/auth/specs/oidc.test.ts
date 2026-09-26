/**
 * Integration tests: OIDC full flow
 *
 * Tests the complete OpenID Connect authentication flow using
 * mock-oauth2-server (navikt). The mock server accepts any username
 * and issues tokens with the configured claims (sub: 'test-user-sub').
 *
 * Tests:
 * 1. Full OIDC flow succeeds — session cookie set after callback
 * 2. redirect_uri matches configured ORIGIN
 * 3. OIDC user created in DB with correct sub claim
 * 4. Tampered state parameter → 400
 * 5. Callback without cookies (state/nonce) → 400
 * 6. OIDC login endpoint disabled when SSO isn't configured → 400
 * 7. Unauthenticated request redirects to /auth/login
 * 8. Full OIDC flow works through reverse proxy (Caddy)
 */

import { assertEquals, assertNotEquals, assertStringIncludes } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { queryDb, createUserDirect } from '$test-harness/setup.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { completeOidcLogin, OIDC_SETTINGS } from '$test-harness/oidc.ts';

const PORT = PORTS.auth.oidc;
const ORIGIN = `http://localhost:${PORT}`;

const PROXY_PORT = PORTS.auth.oidcProxy;
const PROXY_ORIGIN = 'https://localhost:7445';

// Separate AUTH=on server without SSO settings for testing OIDC-disabled behavior
const AUTH_ON_PORT = PORTS.auth.oidcAuthOn;
const AUTH_ON_ORIGIN = `http://localhost:${AUTH_ON_PORT}`;

const OIDC_ENV = { AUTH: 'on', ...OIDC_SETTINGS };

setup(async () => {
	await startServer(PORT, { ORIGIN, ...OIDC_ENV }, 'preview');
	await startServer(PROXY_PORT, { ORIGIN: PROXY_ORIGIN, ...OIDC_ENV }, 'preview');
	await startServer(AUTH_ON_PORT, { AUTH: 'on', ORIGIN: AUTH_ON_ORIGIN }, 'preview');
	// AUTH=on server needs a user so it doesn't redirect everything to /auth/setup
	await createUserDirect(getDbPath(AUTH_ON_PORT), 'admin', 'password123');
});

teardown(async () => {
	await stopServer(PORT);
	await stopServer(PROXY_PORT);
	await stopServer(AUTH_ON_PORT);
});

// --- Happy path ---

test('full OIDC flow succeeds', async () => {
	const client = new TestClient(ORIGIN);
	const { callbackRes } = await completeOidcLogin(client);

	assertEquals(callbackRes.status, 303, 'Callback should redirect to home');
	assertEquals(callbackRes.headers.get('location'), '/');

	const session = client.getCookie('session');
	assertNotEquals(session, undefined, 'Session cookie should be set');

	// Verify we can access a protected page
	const pageRes = await client.get('/databases');
	assertNotEquals(pageRes.status, 303, 'Should not redirect to login');
});

test('redirect_uri matches configured ORIGIN', async () => {
	const client = new TestClient(ORIGIN);
	const loginRes = await client.get('/auth/oidc/login');
	const authUrl = loginRes.headers.get('location')!;

	const params = new URL(authUrl).searchParams;
	const redirectUri = params.get('redirect_uri')!;

	assertStringIncludes(
		redirectUri,
		ORIGIN,
		`redirect_uri should use ORIGIN (${ORIGIN}), got: ${redirectUri}`
	);
	assertStringIncludes(redirectUri, '/auth/oidc/callback');
});

test('OIDC user created in DB with correct sub', async () => {
	const client = new TestClient(ORIGIN);
	await completeOidcLogin(client);

	// Mock server uses the form username ("test") as the sub claim
	const rows = queryDb(getDbPath(PORT), "SELECT * FROM users WHERE username = 'oidc:test'") as {
		id: number;
		username: string;
	}[];

	assertEquals(rows.length, 1, 'User oidc:test should exist in DB');
	assertEquals(rows[0].username, 'oidc:test');
});

// --- Security checks ---

test('tampered state parameter → 400', async () => {
	const client = new TestClient(ORIGIN);

	// Start the flow to get oidc_state and oidc_nonce cookies
	const loginRes = await client.get('/auth/oidc/login');
	assertEquals(loginRes.status, 302);

	// Hit callback with wrong state
	const callbackRes = await client.get('/auth/oidc/callback?code=fake&state=tampered-state');
	assertEquals(callbackRes.status, 400, 'Tampered state should be rejected');
});

test('callback without cookies → 400', async () => {
	// Complete the flow through the mock server to get a valid callback URL
	const client = new TestClient(ORIGIN);

	const loginRes = await client.get('/auth/oidc/login');
	const authUrl = loginRes.headers.get('location')!;

	const formRes = await client.get(authUrl);
	await formRes.text();

	const formPostRes = await client.postForm(authUrl, { username: 'test' });
	const callbackUrl = formPostRes.headers.get('location')!;

	// Hit callback with a fresh client (no oidc_state or oidc_nonce cookies)
	// This tests that the state/nonce cookie verification rejects the request
	const freshClient = new TestClient(ORIGIN);
	const callbackRes = await freshClient.get(callbackUrl);
	assertEquals(callbackRes.status, 400, 'Callback without cookies should be rejected');
});

test("OIDC login disabled when SSO isn't configured → 400", async () => {
	const client = new TestClient(AUTH_ON_ORIGIN);
	const res = await client.get('/auth/oidc/login');
	assertEquals(res.status, 400, "OIDC login should be rejected when SSO isn't configured");
});

test('unauthenticated request redirects to /auth/login', async () => {
	const client = new TestClient(ORIGIN);
	const res = await client.get('/databases');
	assertEquals(res.status, 303);
	assertStringIncludes(
		res.headers.get('location') ?? '',
		'/auth/login',
		'Should redirect to login page'
	);
});

// --- Reverse proxy ---

test('full OIDC flow through reverse proxy', async () => {
	const client = new TestClient(PROXY_ORIGIN);
	const { callbackRes, authUrl } = await completeOidcLogin(client);

	// Verify redirect_uri in the auth URL uses the proxy origin
	const params = new URL(authUrl).searchParams;
	const redirectUri = params.get('redirect_uri')!;
	assertStringIncludes(
		redirectUri,
		PROXY_ORIGIN,
		`redirect_uri should use proxy ORIGIN (${PROXY_ORIGIN}), got: ${redirectUri}`
	);

	assertEquals(callbackRes.status, 303, 'Callback should redirect to home');

	const session = client.getCookie('session');
	assertNotEquals(session, undefined, 'Session cookie should be set through proxy');

	// Verify authenticated access works through proxy
	const pageRes = await client.get('/databases');
	assertNotEquals(pageRes.status, 303, 'Should not redirect to login through proxy');
});

await run();
