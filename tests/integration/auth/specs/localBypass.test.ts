/**
 * Integration tests: local bypass vs. first-run setup gating
 *
 * Regression coverage for issue #601: enabling local bypass under AUTH=oidc
 * used to flip needsSetup on (no *local* users exist in an OIDC-only deploy),
 * which redirected every route — including /auth/oidc/login and
 * /settings/security — to /auth/setup, locking the user out with no way to
 * turn the toggle back off.
 *
 * Tests run from localhost, so the bypass IP check always matches.
 *
 * OIDC server (no seeded user):
 * 1. Full OIDC login succeeds before bypass is enabled
 * 2. Logged-in OIDC user can enable bypass via the settings form action
 * 3. Authenticated requests are not redirected to /auth/setup after enabling
 * 4. /auth/oidc/login remains reachable with bypass enabled
 * 5. /settings/security remains reachable (the page needed to undo the toggle)
 * 6. Unauthenticated local client passes through via bypass, not setup
 *
 * AUTH=on server (no seeded user) — setup gating must survive the fix:
 * 7. Bypass with no local users still enforces setup
 * 8. Bypass works once a local user exists
 */

import { assert, assertEquals, assertNotEquals, assertStringIncludes } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { createUserDirect, queryDb } from '$test-harness/setup.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { openDb } from '$test-harness/db.ts';

const OIDC_PORT = PORTS.auth.localBypassOidc;
const OIDC_ORIGIN = `http://localhost:${OIDC_PORT}`;

const AUTH_ON_PORT = PORTS.auth.localBypassAuthOn;
const AUTH_ON_ORIGIN = `http://localhost:${AUTH_ON_PORT}`;

const OIDC_ENV = {
	AUTH: 'oidc',
	OIDC_DISCOVERY_URL: 'http://localhost:9090/default/.well-known/openid-configuration',
	OIDC_CLIENT_ID: 'profilarr',
	OIDC_CLIENT_SECRET: 'secret'
};

/**
 * Drive the full OIDC login flow through the mock server.
 * Same flow as oidc.test.ts: login redirect → mock form → callback.
 * On success the client's cookie jar holds the session cookie.
 */
async function completeOidcLogin(client: TestClient): Promise<Response> {
	const loginRes = await client.get('/auth/oidc/login');
	assertEquals(loginRes.status, 302, 'OIDC login should redirect to provider');
	const authUrl = loginRes.headers.get('location')!;

	const formRes = await client.get(authUrl);
	assertEquals(formRes.status, 200, 'Mock server should return login form');
	await formRes.text();

	const formPostRes = await client.postForm(authUrl, { username: 'test' });
	assertEquals(formPostRes.status, 302, 'Mock server should redirect back to callback');
	const callbackUrl = formPostRes.headers.get('location')!;
	assertStringIncludes(callbackUrl, '/auth/oidc/callback', 'Redirect should target our callback');

	return await client.get(callbackUrl);
}

// Logged-in OIDC client shared across the sequential tests below
let oidcClient: TestClient;

setup(async () => {
	await startServer(OIDC_PORT, { ORIGIN: OIDC_ORIGIN, ...OIDC_ENV }, 'preview');
	// No seeded user: a fresh AUTH=on deploy where setup gating must still apply
	await startServer(AUTH_ON_PORT, { AUTH: 'on', ORIGIN: AUTH_ON_ORIGIN }, 'preview');
	oidcClient = new TestClient(OIDC_ORIGIN);
});

teardown(async () => {
	await stopServer(OIDC_PORT);
	await stopServer(AUTH_ON_PORT);
});

// --- OIDC server ---

test('full OIDC login succeeds before bypass is enabled', async () => {
	const callbackRes = await completeOidcLogin(oidcClient);

	assertEquals(callbackRes.status, 303, 'Callback should redirect to home');
	assertEquals(callbackRes.headers.get('location'), '/');
	assertNotEquals(oidcClient.getCookie('session'), undefined, 'Session cookie should be set');
});

test('logged-in OIDC user can enable local bypass via form action', async () => {
	// Mirrors the #601 repro: the toggle is flipped through Settings > Security
	// while bypass is still off, so this goes through the normal OIDC session path.
	const res = await oidcClient.postForm(
		'/settings/security?/toggleLocalBypass',
		{},
		{ headers: { Origin: OIDC_ORIGIN } }
	);
	assertEquals(res.status, 200, `Toggle form action should succeed, got ${res.status}`);

	const rows = queryDb(
		getDbPath(OIDC_PORT),
		'SELECT local_bypass_enabled FROM auth_settings WHERE id = 1'
	) as { local_bypass_enabled: number }[];
	assertEquals(rows[0]?.local_bypass_enabled, 1, 'local_bypass_enabled should be set in the DB');
});

test('authenticated requests are not redirected to setup after enabling bypass', async () => {
	for (const path of ['/', '/databases']) {
		const res = await oidcClient.get(path);
		assert(
			res.headers.get('location') !== '/auth/setup',
			`GET ${path} must not redirect to /auth/setup (got ${res.status} → ${res.headers.get('location')})`
		);
	}

	const dbRes = await oidcClient.get('/databases');
	assertEquals(dbRes.status, 200, 'Protected page should load for the logged-in OIDC user');
});

test('/auth/oidc/login remains reachable with bypass enabled', async () => {
	// The escape hatch the lockout destroyed: OIDC login must stay reachable.
	const client = new TestClient(OIDC_ORIGIN);
	const res = await client.get('/auth/oidc/login');

	assertEquals(res.status, 302, `OIDC login should redirect to provider, got ${res.status}`);
	assertStringIncludes(
		res.headers.get('location') ?? '',
		'localhost:9090',
		'OIDC login should redirect to the provider, not /auth/setup'
	);
});

test('/settings/security remains reachable with bypass enabled', async () => {
	// Without this page the toggle cannot be turned back off.
	const res = await oidcClient.get('/settings/security');
	assertEquals(res.status, 200, `Settings > Security should load, got ${res.status}`);
});

test('unauthenticated local client passes through via bypass, not setup', async () => {
	const client = new TestClient(OIDC_ORIGIN);
	const res = await client.get('/databases');

	assertEquals(
		res.status,
		200,
		`Bypass should admit unauthenticated local requests, got ${res.status} → ${res.headers.get('location')}`
	);
});

// --- AUTH=on server: setup gating must survive the fix ---

test('AUTH=on: bypass with no local users still enforces setup', async () => {
	// No session exists yet (everything redirects to setup pre-user), so the
	// toggle form action is unreachable — enable bypass directly in the DB.
	const conn = openDb(getDbPath(AUTH_ON_PORT));
	try {
		conn.exec('UPDATE auth_settings SET local_bypass_enabled = 1 WHERE id = 1');
	} finally {
		conn.close();
	}

	const client = new TestClient(AUTH_ON_ORIGIN);
	const res = await client.get('/databases');
	assertEquals(res.status, 303, 'Requests should redirect while no local user exists');
	assertEquals(res.headers.get('location'), '/auth/setup', 'Setup should still be enforced');

	const setupRes = await client.get('/auth/setup');
	assertEquals(setupRes.status, 200, 'Setup page itself should be reachable');
});

test('AUTH=on: bypass works once a local user exists', async () => {
	await createUserDirect(getDbPath(AUTH_ON_PORT), 'admin', 'password123');

	const client = new TestClient(AUTH_ON_ORIGIN);
	const res = await client.get('/databases');
	assertEquals(
		res.status,
		200,
		`Bypass should admit local requests after setup, got ${res.status}`
	);
});

await run();
