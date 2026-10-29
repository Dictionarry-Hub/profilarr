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

import { TestClient } from '#integration/harness/client.ts';
import { startServer, stopServer, getDbPath } from '#integration/harness/server.ts';
import { queryDb, createUserDirect } from '#integration/harness/setup.ts';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';
import { completeOidcLogin, OIDC_SETTINGS } from '#integration/harness/oidc.ts';

// Caddy serves HTTPS with a self-signed cert on localhost, so skip TLS verification here.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const PORT = PORTS.auth.oidc;
const ORIGIN = `http://localhost:${PORT}`;

const PROXY_PORT = PORTS.auth.oidcProxy;
const PROXY_ORIGIN = 'https://localhost:7445';

// Separate AUTH=on server without SSO settings for testing OIDC-disabled behavior
const AUTH_ON_PORT = PORTS.auth.oidcAuthOn;
const AUTH_ON_ORIGIN = `http://localhost:${AUTH_ON_PORT}`;

const OIDC_ENV = { AUTH: 'on', ...OIDC_SETTINGS };

beforeAll(async () => {
	await startServer(PORT, { ORIGIN, ...OIDC_ENV }, 'preview');
	await startServer(PROXY_PORT, { ORIGIN: PROXY_ORIGIN, ...OIDC_ENV }, 'preview');
	await startServer(AUTH_ON_PORT, { AUTH: 'on', ORIGIN: AUTH_ON_ORIGIN }, 'preview');
	// AUTH=on server needs a user so it doesn't redirect everything to /auth/setup
	await createUserDirect(getDbPath(AUTH_ON_PORT), 'admin', 'password123');
});

afterAll(async () => {
	await stopServer(PORT);
	await stopServer(PROXY_PORT);
	await stopServer(AUTH_ON_PORT);
});

// --- Happy path ---

test('full OIDC flow succeeds', async () => {
	const client = new TestClient(ORIGIN);
	const { callbackRes } = await completeOidcLogin(client);

	expect(callbackRes.status, 'Callback should redirect to home').toStrictEqual(303);
	expect(callbackRes.headers.get('location')).toStrictEqual('/');

	const session = client.getCookie('session');
	expect(session, 'Session cookie should be set').not.toStrictEqual(undefined);

	// Verify we can access a protected page
	const pageRes = await client.get('/databases');
	expect(pageRes.status, 'Should not redirect to login').not.toStrictEqual(303);
});

test('redirect_uri matches configured ORIGIN', async () => {
	const client = new TestClient(ORIGIN);
	const loginRes = await client.get('/auth/oidc/login');
	const authUrl = loginRes.headers.get('location')!;

	const params = new URL(authUrl).searchParams;
	const redirectUri = params.get('redirect_uri')!;

	expect(redirectUri, `redirect_uri should use ORIGIN (${ORIGIN}), got: ${redirectUri}`).toContain(
		ORIGIN
	);
	expect(redirectUri).toContain('/auth/oidc/callback');
});

test('OIDC user created in DB with correct sub', async () => {
	const client = new TestClient(ORIGIN);
	await completeOidcLogin(client);

	// Mock server uses the form username ("test") as the sub claim
	const rows = queryDb(getDbPath(PORT), "SELECT * FROM users WHERE username = 'oidc:test'") as {
		id: number;
		username: string;
	}[];

	expect(rows.length, 'User oidc:test should exist in DB').toStrictEqual(1);
	expect(rows[0].username).toStrictEqual('oidc:test');
});

// --- Security checks ---

test('tampered state parameter → 400', async () => {
	const client = new TestClient(ORIGIN);

	// Start the flow to get oidc_state and oidc_nonce cookies
	const loginRes = await client.get('/auth/oidc/login');
	expect(loginRes.status).toStrictEqual(302);

	// Hit callback with wrong state
	const callbackRes = await client.get('/auth/oidc/callback?code=fake&state=tampered-state');
	expect(callbackRes.status, 'Tampered state should be rejected').toStrictEqual(400);
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
	expect(callbackRes.status, 'Callback without cookies should be rejected').toStrictEqual(400);
});

test("OIDC login disabled when SSO isn't configured → 400", async () => {
	const client = new TestClient(AUTH_ON_ORIGIN);
	const res = await client.get('/auth/oidc/login');
	expect(res.status, "OIDC login should be rejected when SSO isn't configured").toStrictEqual(400);
});

test('unauthenticated request redirects to /auth/login', async () => {
	const client = new TestClient(ORIGIN);
	const res = await client.get('/databases');
	expect(res.status).toStrictEqual(303);
	expect(res.headers.get('location') ?? '', 'Should redirect to login page').toContain(
		'/auth/login'
	);
});

// --- Reverse proxy ---

test('full OIDC flow through reverse proxy', async () => {
	const client = new TestClient(PROXY_ORIGIN);
	const { callbackRes, authUrl } = await completeOidcLogin(client);

	// Verify redirect_uri in the auth URL uses the proxy origin
	const params = new URL(authUrl).searchParams;
	const redirectUri = params.get('redirect_uri')!;
	expect(
		redirectUri,
		`redirect_uri should use proxy ORIGIN (${PROXY_ORIGIN}), got: ${redirectUri}`
	).toContain(PROXY_ORIGIN);

	expect(callbackRes.status, 'Callback should redirect to home').toStrictEqual(303);

	const session = client.getCookie('session');
	expect(session, 'Session cookie should be set through proxy').not.toStrictEqual(undefined);

	// Verify authenticated access works through proxy
	const pageRes = await client.get('/databases');
	expect(pageRes.status, 'Should not redirect to login through proxy').not.toStrictEqual(303);
});
