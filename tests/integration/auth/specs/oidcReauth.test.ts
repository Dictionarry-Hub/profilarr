/**
 * Integration tests: SSO re-authentication before creating an API key.
 *
 * An SSO session confirms its identity by signing in at the provider again
 * (`/auth/oidc/login?reauth=1`, sent with prompt=login and max_age=60). The
 * callback requires the ID token's sub to match the signed-in account and
 * its auth_time to be newer than when the flow started, then marks the
 * existing session confirmed. No new session is created.
 *
 * The mock server's `default` issuer injects a far-future auth_time, so it
 * stands in for a provider that re-authenticates properly. Its `stale`
 * issuer issues no auth_time, standing in for one that doesn't.
 *
 * Tests:
 * 1. A key can be created right after SSO sign-in
 * 2. An aged session cannot create a key
 * 3. reauth=1 sends prompt=login and a non-zero max_age to the provider
 * 4. Re-authenticating as the same user keeps the session, confirms it, and the key follows
 * 5. Re-authenticating as a different user is rejected and confirms nothing
 * 6. A provider without auth_time fails closed and the page is told
 * 7. reauth=1 without a session is rejected
 * 8. An SSO session cannot confirm with a password
 */

import { assertEquals, assertNotEquals, assertStringIncludes } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { formResult, getSessionConfirmedAt, setSessionConfirmedAt } from '$test-harness/setup.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { completeOidcLogin, MOCK_OIDC_STALE_URL, OIDC_SETTINGS } from '$test-harness/oidc.ts';
import { REAUTH_SKEW_SECONDS } from '$auth/confirmation.ts';

const PORT = PORTS.auth.oidcReauth;
const ORIGIN = `http://localhost:${PORT}`;
const STALE_PORT = PORTS.auth.oidcReauthStale;
const STALE_ORIGIN = `http://localhost:${STALE_PORT}`;
const KEY_PAGE = '/settings/security/api-keys/new';

let keyCounter = 0;

async function ssoSignIn(
	base: string,
	username = 'test'
): Promise<{ client: TestClient; sessionId: string }> {
	const client = new TestClient(base);
	const { callbackRes } = await completeOidcLogin(client, username);
	assertEquals(callbackRes.status, 303, 'SSO sign-in should redirect');
	const sessionId = client.getCookie('session');
	assertEquals(typeof sessionId, 'string', 'SSO sign-in should set a session cookie');
	return { client, sessionId: sessionId! };
}

async function createKey(client: TestClient, base: string): Promise<number> {
	keyCounter++;
	const res = await client.postForm(
		`${KEY_PAGE}?/create`,
		{ name: `reauth-test-${keyCounter}`, expiry: 'never', fullAccess: 'on', permissions: '{}' },
		{ headers: { Origin: base } }
	);
	return (await formResult(res)).status;
}

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN, ...OIDC_SETTINGS }, 'preview');
	await startServer(
		STALE_PORT,
		{ AUTH: 'on', ORIGIN: STALE_ORIGIN, ...OIDC_SETTINGS, OIDC_DISCOVERY_URL: MOCK_OIDC_STALE_URL },
		'preview'
	);
});

teardown(async () => {
	await stopServer(PORT);
	await stopServer(STALE_PORT);
});

test('a key can be created right after SSO sign-in', async () => {
	const { client, sessionId } = await ssoSignIn(ORIGIN);
	assertNotEquals(getSessionConfirmedAt(getDbPath(PORT), sessionId), null);
	assertEquals(await createKey(client, ORIGIN), 200);
});

test('an aged session cannot create a key', async () => {
	const { client, sessionId } = await ssoSignIn(ORIGIN);
	setSessionConfirmedAt(getDbPath(PORT), sessionId, 31);
	assertEquals(await createKey(client, ORIGIN), 403);
});

test('reauth=1 sends prompt=login and a non-zero max_age to the provider', async () => {
	const { client } = await ssoSignIn(ORIGIN);
	const res = await client.get('/auth/oidc/login?reauth=1');
	assertEquals(res.status, 302);
	const location = res.headers.get('location') ?? '';
	assertStringIncludes(location, `max_age=${REAUTH_SKEW_SECONDS}`);
	assertStringIncludes(location, 'prompt=login');
});

test('re-authenticating as the same user keeps the session, confirms it, and the key follows', async () => {
	const { client, sessionId } = await ssoSignIn(ORIGIN);
	setSessionConfirmedAt(getDbPath(PORT), sessionId, 31);
	const before = getSessionConfirmedAt(getDbPath(PORT), sessionId);

	const { callbackRes } = await completeOidcLogin(client, 'test', { reauth: true });
	assertEquals(callbackRes.status, 303);
	assertEquals(callbackRes.headers.get('location'), KEY_PAGE);
	assertEquals(client.getCookie('session'), sessionId, 'the session cookie must not change');
	assertNotEquals(getSessionConfirmedAt(getDbPath(PORT), sessionId), before);
	assertEquals(await createKey(client, ORIGIN), 200);
});

test('re-authenticating as a different user is rejected and confirms nothing', async () => {
	const { client, sessionId } = await ssoSignIn(ORIGIN);
	setSessionConfirmedAt(getDbPath(PORT), sessionId, 31);
	const before = getSessionConfirmedAt(getDbPath(PORT), sessionId);

	const { callbackRes } = await completeOidcLogin(client, 'mallory', { reauth: true });
	assertEquals(callbackRes.status, 400);
	assertEquals(getSessionConfirmedAt(getDbPath(PORT), sessionId), before);
	assertEquals(client.getCookie('session'), sessionId);
	assertEquals(await createKey(client, ORIGIN), 403);
});

test('a provider without auth_time fails closed and the page is told', async () => {
	const { client, sessionId } = await ssoSignIn(STALE_ORIGIN);
	assertEquals(await createKey(client, STALE_ORIGIN), 200, 'sign-in itself still confirms');
	setSessionConfirmedAt(getDbPath(STALE_PORT), sessionId, 31);
	const before = getSessionConfirmedAt(getDbPath(STALE_PORT), sessionId);

	const { callbackRes } = await completeOidcLogin(client, 'test', { reauth: true });
	assertEquals(callbackRes.status, 303);
	assertStringIncludes(callbackRes.headers.get('location') ?? '', '/settings/security?reauth=failed');
	assertEquals(getSessionConfirmedAt(getDbPath(STALE_PORT), sessionId), before);
	assertEquals(await createKey(client, STALE_ORIGIN), 403);
});

test('reauth=1 without a session is rejected', async () => {
	const res = await new TestClient(ORIGIN).get('/auth/oidc/login?reauth=1');
	assertEquals(res.status, 400);
});

test('an SSO session cannot confirm with a password', async () => {
	const { client, sessionId } = await ssoSignIn(ORIGIN);
	setSessionConfirmedAt(getDbPath(PORT), sessionId, 31);
	const res = await client.postForm(
		`${KEY_PAGE}?/confirm`,
		{ password: 'anything' },
		{ headers: { Origin: ORIGIN } }
	);
	assertEquals((await formResult(res)).status, 403);
	assertEquals(await createKey(client, ORIGIN), 403);
});

await run();
