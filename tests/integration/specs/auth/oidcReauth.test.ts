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

import { TestClient } from '#integration/harness/client.ts';
import { startServer, stopServer, getDbPath } from '#integration/harness/server.ts';
import {
	formResult,
	getSessionConfirmedAt,
	setSessionConfirmedAt
} from '#integration/harness/setup.ts';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';
import {
	completeOidcLogin,
	MOCK_OIDC_STALE_URL,
	OIDC_SETTINGS
} from '#integration/harness/oidc.ts';
import { REAUTH_SKEW_SECONDS } from '#utils/auth/confirmation.ts';

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
	expect(callbackRes.status, 'SSO sign-in should redirect').toStrictEqual(303);
	const sessionId = client.getCookie('session');
	expect(typeof sessionId, 'SSO sign-in should set a session cookie').toStrictEqual('string');
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

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN, ...OIDC_SETTINGS }, 'preview');
	await startServer(
		STALE_PORT,
		{ AUTH: 'on', ORIGIN: STALE_ORIGIN, ...OIDC_SETTINGS, OIDC_DISCOVERY_URL: MOCK_OIDC_STALE_URL },
		'preview'
	);
});

afterAll(async () => {
	await stopServer(PORT);
	await stopServer(STALE_PORT);
});

test('a key can be created right after SSO sign-in', async () => {
	const { client, sessionId } = await ssoSignIn(ORIGIN);
	expect(getSessionConfirmedAt(getDbPath(PORT), sessionId)).not.toStrictEqual(null);
	expect(await createKey(client, ORIGIN)).toStrictEqual(200);
});

test('an aged session cannot create a key', async () => {
	const { client, sessionId } = await ssoSignIn(ORIGIN);
	setSessionConfirmedAt(getDbPath(PORT), sessionId, 31);
	expect(await createKey(client, ORIGIN)).toStrictEqual(403);
});

test('reauth=1 sends prompt=login and a non-zero max_age to the provider', async () => {
	const { client } = await ssoSignIn(ORIGIN);
	const res = await client.get('/auth/oidc/login?reauth=1');
	expect(res.status).toStrictEqual(302);
	const location = res.headers.get('location') ?? '';
	expect(location).toContain(`max_age=${REAUTH_SKEW_SECONDS}`);
	expect(location).toContain('prompt=login');
});

test('re-authenticating as the same user keeps the session, confirms it, and the key follows', async () => {
	const { client, sessionId } = await ssoSignIn(ORIGIN);
	setSessionConfirmedAt(getDbPath(PORT), sessionId, 31);
	const before = getSessionConfirmedAt(getDbPath(PORT), sessionId);

	const { callbackRes } = await completeOidcLogin(client, 'test', { reauth: true });
	expect(callbackRes.status).toStrictEqual(303);
	expect(callbackRes.headers.get('location')).toStrictEqual(KEY_PAGE);
	expect(client.getCookie('session'), 'the session cookie must not change').toStrictEqual(
		sessionId
	);
	expect(getSessionConfirmedAt(getDbPath(PORT), sessionId)).not.toStrictEqual(before);
	expect(await createKey(client, ORIGIN)).toStrictEqual(200);
});

test('re-authenticating as a different user is rejected and confirms nothing', async () => {
	const { client, sessionId } = await ssoSignIn(ORIGIN);
	setSessionConfirmedAt(getDbPath(PORT), sessionId, 31);
	const before = getSessionConfirmedAt(getDbPath(PORT), sessionId);

	const { callbackRes } = await completeOidcLogin(client, 'mallory', { reauth: true });
	expect(callbackRes.status).toStrictEqual(400);
	expect(getSessionConfirmedAt(getDbPath(PORT), sessionId)).toStrictEqual(before);
	expect(client.getCookie('session')).toStrictEqual(sessionId);
	expect(await createKey(client, ORIGIN)).toStrictEqual(403);
});

test('a provider without auth_time fails closed and the page is told', async () => {
	const { client, sessionId } = await ssoSignIn(STALE_ORIGIN);
	expect(await createKey(client, STALE_ORIGIN), 'sign-in itself still confirms').toStrictEqual(200);
	setSessionConfirmedAt(getDbPath(STALE_PORT), sessionId, 31);
	const before = getSessionConfirmedAt(getDbPath(STALE_PORT), sessionId);

	const { callbackRes } = await completeOidcLogin(client, 'test', { reauth: true });
	expect(callbackRes.status).toStrictEqual(303);
	expect(callbackRes.headers.get('location') ?? '').toContain('/settings/security?reauth=failed');
	expect(getSessionConfirmedAt(getDbPath(STALE_PORT), sessionId)).toStrictEqual(before);
	expect(await createKey(client, STALE_ORIGIN)).toStrictEqual(403);
});

test('reauth=1 without a session is rejected', async () => {
	const res = await new TestClient(ORIGIN).get('/auth/oidc/login?reauth=1');
	expect(res.status).toStrictEqual(400);
});

test('an SSO session cannot confirm with a password', async () => {
	const { client, sessionId } = await ssoSignIn(ORIGIN);
	setSessionConfirmedAt(getDbPath(PORT), sessionId, 31);
	const res = await client.postForm(
		`${KEY_PAGE}?/confirm`,
		{ password: 'anything' },
		{ headers: { Origin: ORIGIN } }
	);
	expect((await formResult(res)).status).toStrictEqual(403);
	expect(await createKey(client, ORIGIN)).toStrictEqual(403);
});
