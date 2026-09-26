/**
 * Integration tests: adding a local password account from the security page
 *
 * Runs against an AUTH=on + SSO server with no password account, the state a
 * fresh SSO install starts in. Tests run in order and build on each other:
 *
 * 1. Signed in with SSO: create form shown, change password hidden and refused
 * 2. Create form refuses reserved usernames and API key requests
 * 3. Creating the account works and does not switch the current session
 * 4. Once it exists: create form gone and refused, password sign-in works
 * 5. Signed in with the password: change password shown, create refused
 * 6. Sessions list covers both accounts without raw session IDs; revoking
 *    one by its stand-in; revoke others signs out both
 * 7. Separate server: two create submissions at once make only one account
 */

import { assert, assertEquals, assertNotEquals } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { formResult, login, queryDb, setApiKey } from '$test-harness/setup.ts';
import { completeOidcLogin, OIDC_SETTINGS } from '$test-harness/oidc.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';

const PORT = PORTS.auth.localAccount;
const ORIGIN = `http://localhost:${PORT}`;
const RACE_PORT = PORTS.auth.localAccountRace;
const RACE_ORIGIN = `http://localhost:${RACE_PORT}`;
const API_KEY = 'local-account-test-key-0123456789abcdef';

const CREATE_FORM = 'action="?/createLocalAccount"';
const CHANGE_FORM = 'action="?/changePassword"';

const ssoClient = new TestClient(ORIGIN);
const passwordClient = new TestClient(ORIGIN);

function localAccounts(): { username: string; password_hash: string }[] {
	return queryDb(
		getDbPath(PORT),
		"SELECT username, password_hash FROM users WHERE username NOT LIKE 'oidc:%'"
	) as { username: string; password_hash: string }[];
}

function ssoAccountHash(): string {
	const rows = queryDb(
		getDbPath(PORT),
		"SELECT password_hash FROM users WHERE username = 'oidc:sam'"
	) as { password_hash: string }[];
	return rows[0].password_hash;
}

async function securityPage(client: TestClient): Promise<string> {
	const res = await client.get('/settings/security');
	assertEquals(res.status, 200, 'Security page should render');
	return res.text();
}

function createLocalAccount(
	client: TestClient,
	username: string,
	password = 'password123',
	headers: Record<string, string> = {}
): Promise<Response> {
	return client.postForm(
		'/settings/security?/createLocalAccount',
		{ username, password, confirmPassword: password },
		{ headers: { Origin: ORIGIN, ...headers } }
	);
}

function changePassword(client: TestClient, current: string, next: string): Promise<Response> {
	return client.postForm(
		'/settings/security?/changePassword',
		{ currentPassword: current, newPassword: next, confirmPassword: next },
		{ headers: { Origin: ORIGIN } }
	);
}

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN, ...OIDC_SETTINGS }, 'preview');
	await setApiKey(getDbPath(PORT), API_KEY);

	const { callbackRes } = await completeOidcLogin(ssoClient, 'sam');
	assertEquals(callbackRes.status, 303, 'SSO sign-in should succeed');

	await startServer(RACE_PORT, { AUTH: 'on', ORIGIN: RACE_ORIGIN, ...OIDC_SETTINGS }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
	await stopServer(RACE_PORT);
});

// --- 1. Signed in with SSO, no password account ---

test('SSO user sees the create form and not change password', async () => {
	const html = await securityPage(ssoClient);
	assert(html.includes(CREATE_FORM), 'Create local account form should be shown');
	assert(!html.includes(CHANGE_FORM), 'Change password form should be hidden');
});

test('change password is refused for an SSO session', async () => {
	const res = await changePassword(ssoClient, 'OIDC_NO_PASSWORD', 'newpassword123');
	assertEquals((await formResult(res)).status, 403);
	assertEquals(ssoAccountHash(), 'OIDC_NO_PASSWORD', 'SSO account hash should be untouched');
});

// --- 2. Refusals before the account exists ---

test('create refuses usernames starting with oidc: in any case', async () => {
	for (const username of ['oidc:admin', 'OIDC:admin']) {
		const res = await createLocalAccount(ssoClient, username);
		assertEquals((await formResult(res)).status, 400, `should refuse '${username}'`);
	}
	assertEquals(localAccounts().length, 0);
});

test('create refuses invalid input', async () => {
	const res = await createLocalAccount(ssoClient, 'admin', 'short');
	assertEquals((await formResult(res)).status, 400);
	assertEquals(localAccounts().length, 0);
});

test('create is refused for API key requests', async () => {
	const apiClient = new TestClient(ORIGIN);
	const res = await createLocalAccount(apiClient, 'admin', 'password123', { 'X-Api-Key': API_KEY });
	assertEquals((await formResult(res)).status, 403);
	assertEquals(localAccounts().length, 0);
});

test('create is refused without a session', async () => {
	const anonymous = new TestClient(ORIGIN);
	const res = await createLocalAccount(anonymous, 'admin');
	assertEquals((await formResult(res)).status, 303, 'Should redirect to login');
	assertEquals(localAccounts().length, 0);
});

// --- 3. Creating the account ---

test('SSO user can create the local account', async () => {
	const sessionBefore = ssoClient.getCookie('session');

	const res = await createLocalAccount(ssoClient, 'admin');
	assertEquals((await formResult(res)).status, 200);

	const accounts = localAccounts();
	assertEquals(accounts.length, 1);
	assertEquals(accounts[0].username, 'admin');
	assert(accounts[0].password_hash.startsWith('$2'), 'Password should be bcrypt-hashed');

	assertEquals(
		ssoClient.getCookie('session'),
		sessionBefore,
		'Creating the account should not switch the current session'
	);
});

// --- 4. After the account exists ---

test('create form is gone once the account exists', async () => {
	const html = await securityPage(ssoClient);
	assert(!html.includes(CREATE_FORM), 'Create form should be hidden');
	assert(!html.includes(CHANGE_FORM), 'Change password stays hidden for SSO sessions');
});

test('a second local account cannot be created', async () => {
	const res = await createLocalAccount(ssoClient, 'second');
	assertEquals((await formResult(res)).status, 409);
	assertEquals(localAccounts().length, 1);
});

test('the new password signs in', async () => {
	const res = await login(passwordClient, 'admin', 'password123', ORIGIN);
	assertEquals(await formResult(res), { status: 303, location: '/' });
	const page = await passwordClient.get('/databases');
	assertNotEquals(page.status, 303, 'Should be signed in');
});

// --- 5. Signed in with the password ---

test('password user sees change password and not the create form', async () => {
	const html = await securityPage(passwordClient);
	assert(html.includes(CHANGE_FORM), 'Change password form should be shown');
	assert(!html.includes(CREATE_FORM), 'Create form should be hidden');
});

test('create is refused for a password session', async () => {
	const res = await createLocalAccount(passwordClient, 'another');
	assertEquals((await formResult(res)).status, 403);
	assertEquals(localAccounts().length, 1);
});

test('password user can still change their password', async () => {
	const before = localAccounts()[0].password_hash;
	const res = await changePassword(passwordClient, 'password123', 'password456');
	assertEquals((await formResult(res)).status, 200);
	assertNotEquals(localAccounts()[0].password_hash, before);
});

// --- 6. Sessions across both accounts ---

/** The stand-in the security page uses instead of a raw session ID */
async function sessionHandle(sessionId: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sessionId));
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function revokeSession(client: TestClient, session: string): Promise<Response> {
	return client.postForm(
		'/settings/security?/revokeSession',
		{ session },
		{ headers: { Origin: ORIGIN } }
	);
}

test('sessions list shows both accounts without exposing session IDs', async () => {
	const res = await ssoClient.get('/settings/security/__data.json');
	assertEquals(res.status, 200);
	const data = await res.text();

	const ssoSession = ssoClient.getCookie('session')!;
	const passwordSession = passwordClient.getCookie('session')!;
	assert(data.includes(await sessionHandle(ssoSession)), 'SSO session should be listed');
	assert(data.includes(await sessionHandle(passwordSession)), 'Password session should be listed');
	assert(!data.includes(ssoSession), 'Raw SSO session ID must not reach the page');
	assert(!data.includes(passwordSession), 'Raw password session ID must not reach the page');
});

test('a raw session ID is not accepted for revoking', async () => {
	const res = await revokeSession(ssoClient, passwordClient.getCookie('session')!);
	assertEquals((await formResult(res)).status, 404);
	const page = await passwordClient.get('/databases');
	assertNotEquals(page.status, 303, 'Password session should still be valid');
});

test('the current session cannot be revoked from the list', async () => {
	const res = await revokeSession(ssoClient, await sessionHandle(ssoClient.getCookie('session')!));
	assertEquals((await formResult(res)).status, 400);
	const page = await ssoClient.get('/databases');
	assertNotEquals(page.status, 303, 'SSO session should still be valid');
});

test('a single session can be revoked by its handle', async () => {
	const res = await revokeSession(
		ssoClient,
		await sessionHandle(passwordClient.getCookie('session')!)
	);
	assertEquals((await formResult(res)).status, 200);

	const page = await passwordClient.get('/databases');
	assertEquals(page.status, 303, 'Password session should be signed out');

	// Sign back in for the revoke-others test
	const again = await login(passwordClient, 'admin', 'password456', ORIGIN);
	assertEquals((await formResult(again)).status, 303);
});

test('revoke others from the SSO session signs out the password session', async () => {
	const res = await ssoClient.postForm(
		'/settings/security?/revokeOtherSessions',
		{},
		{ headers: { Origin: ORIGIN } }
	);
	assertEquals((await formResult(res)).status, 200);

	const passwordPage = await passwordClient.get('/databases');
	assertEquals(passwordPage.status, 303, 'Password session should be signed out');

	const ssoPage = await ssoClient.get('/databases');
	assertNotEquals(ssoPage.status, 303, 'Current SSO session should remain');

	const rows = queryDb(getDbPath(PORT), 'SELECT COUNT(*) as count FROM sessions') as {
		count: number;
	}[];
	assertEquals(rows[0].count, 1);
});

// --- 7. Concurrent create submissions ---

test('two create submissions at once make only one local account', async () => {
	const clients = [new TestClient(RACE_ORIGIN), new TestClient(RACE_ORIGIN)];
	await completeOidcLogin(clients[0], 'racer-one');
	await completeOidcLogin(clients[1], 'racer-two');

	// Password hashing is slow, so both requests are in flight together
	const post = (client: TestClient, username: string) =>
		client.postForm(
			'/settings/security?/createLocalAccount',
			{ username, password: 'password123', confirmPassword: 'password123' },
			{ headers: { Origin: RACE_ORIGIN } }
		);
	const results = await Promise.all([post(clients[0], 'first'), post(clients[1], 'second')]);
	const statuses = (await Promise.all(results.map((r) => formResult(r)))).map((r) => r.status);

	const rows = queryDb(
		getDbPath(RACE_PORT),
		"SELECT COUNT(*) as count FROM users WHERE username NOT LIKE 'oidc:%'"
	) as { count: number }[];
	assertEquals(rows[0].count, 1, 'Only one password account may exist');
	assertEquals(statuses.sort(), [200, 409]);
});

await run();
