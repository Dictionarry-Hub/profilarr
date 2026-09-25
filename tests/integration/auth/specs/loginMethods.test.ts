/**
 * Integration tests: which sign-in methods are offered in each auth setup
 *
 * SSO is an add-on to AUTH=on, enabled when the three OIDC_* settings are
 * present. AUTH=oidc is a deprecated alias for AUTH=on. One server per
 * scenario, since settings are read once at startup.
 *
 * | Server | Settings        | Seeded           |
 * | ------ | --------------- | ---------------- |
 * | A      | AUTH=on         | nothing          |
 * | B      | AUTH=on         | password account |
 * | C      | AUTH=on + SSO   | nothing          |
 * | D      | AUTH=on + SSO   | password account |
 * | E      | AUTH=oidc + SSO | nothing          |
 * | F      | AUTH=oidc + SSO | password account |
 * | G      | AUTH=off + SSO  | nothing          |
 * | H      | AUTH=on         | SSO account only (SSO settings removed) |
 * | I      | AUTH=on         | nothing (concurrent setup submissions) |
 */

import { assert, assertEquals, assertNotEquals, assertStringIncludes } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath, getServerOutput } from '$test-harness/server.ts';
import { createUser, createUserDirect, formResult, login, queryDb } from '$test-harness/setup.ts';
import { completeOidcLogin, OIDC_SETTINGS } from '$test-harness/oidc.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';

const A = PORTS.auth.loginPasswordSetup;
const B = PORTS.auth.loginPasswordOnly;
const C = PORTS.auth.loginSsoOnly;
const D = PORTS.auth.loginBoth;
const E = PORTS.auth.loginLegacySsoOnly;
const F = PORTS.auth.loginLegacyBoth;
const G = PORTS.auth.loginOff;
const H = PORTS.auth.loginSsoRemoved;
const I = PORTS.auth.setupRace;

const origin = (port: number) => `http://localhost:${port}`;

const DEPRECATION_WARNING = 'AUTH=oidc is deprecated';
const LOCKED_OUT_ERROR = 'SSO accounts exist but the OIDC_* settings are missing';
const LOGOUT_LINK = 'href="/auth/logout"';
const LEFTOVER_ACCOUNT_WARNING = 'local password account exists';

/**
 * Load the login page and report which sign-in methods it shows.
 */
async function loginPage(port: number): Promise<{ password: boolean; sso: boolean }> {
	const client = new TestClient(origin(port));
	const res = await client.get('/auth/login');
	assertEquals(res.status, 200, 'Login page should render');
	const html = await res.text();
	return {
		password: html.includes('name="password"'),
		sso: html.includes('href="/auth/oidc/login"')
	};
}

function localAccountCount(port: number): number {
	const rows = queryDb(
		getDbPath(port),
		"SELECT COUNT(*) as count FROM users WHERE username NOT LIKE 'oidc:%'"
	) as { count: number }[];
	return rows[0].count;
}

/**
 * Hit the OIDC callback with a matching state cookie, so the only thing that
 * can reject it is the "is SSO configured?" gate.
 */
async function callbackWithValidState(port: number): Promise<Response> {
	const client = new TestClient(origin(port));
	return client.get('/auth/oidc/callback?code=fake&state=abc', {
		headers: { Cookie: 'oidc_state=abc; oidc_nonce=nonce' }
	});
}

setup(async () => {
	await Promise.all([
		startServer(A, { AUTH: 'on', ORIGIN: origin(A) }, 'preview'),
		startServer(B, { AUTH: 'on', ORIGIN: origin(B) }, 'preview'),
		startServer(C, { AUTH: 'on', ORIGIN: origin(C), ...OIDC_SETTINGS }, 'preview'),
		startServer(D, { AUTH: 'on', ORIGIN: origin(D), ...OIDC_SETTINGS }, 'preview'),
		startServer(E, { AUTH: 'oidc', ORIGIN: origin(E), ...OIDC_SETTINGS }, 'preview'),
		startServer(F, { AUTH: 'oidc', ORIGIN: origin(F), ...OIDC_SETTINGS }, 'preview'),
		startServer(G, { AUTH: 'off', ORIGIN: origin(G), ...OIDC_SETTINGS }, 'preview'),
		startServer(I, { AUTH: 'on', ORIGIN: origin(I) }, 'preview')
	]);

	await createUserDirect(getDbPath(B), 'admin', 'password123');
	await createUserDirect(getDbPath(D), 'admin', 'password123');

	// F simulates an instance that used AUTH=on, then switched to AUTH=oidc and
	// kept its password account. The startup warning only sees accounts that
	// exist when the server starts, so restart it on the same database.
	await createUserDirect(getDbPath(F), 'admin', 'password123');
	await stopServer(F, { keepData: true });
	await startServer(F, { AUTH: 'oidc', ORIGIN: origin(F), ...OIDC_SETTINGS }, 'preview');

	// H simulates an SSO-only instance whose OIDC settings went missing: sign in
	// once so an SSO account exists, then restart without the settings. The
	// restart is expected to fail, so it happens in the test below.
	await startServer(H, { AUTH: 'on', ORIGIN: origin(H), ...OIDC_SETTINGS }, 'preview');
	await completeOidcLogin(new TestClient(origin(H)), 'hank');
	await stopServer(H, { keepData: true });
});

teardown(async () => {
	await Promise.all([A, B, C, D, E, F, G, H, I].map((port) => stopServer(port)));
});

// --- A: AUTH=on, no SSO, no accounts ---

test('A: first visit redirects to setup', async () => {
	const client = new TestClient(origin(A));
	const res = await client.get('/');
	assertEquals(res.status, 303);
	assertEquals(res.headers.get('location'), '/auth/setup');
});

test('A: login page redirects to setup', async () => {
	const client = new TestClient(origin(A));
	const res = await client.get('/auth/login');
	assertEquals(res.status, 303);
	assertEquals(res.headers.get('location'), '/auth/setup');
});

test('A: setup refuses usernames starting with oidc: in any case', async () => {
	for (const username of ['oidc:admin', 'OIDC:admin']) {
		const client = new TestClient(origin(A));
		const res = await createUser(client, username, 'password123', origin(A));
		assertEquals((await formResult(res)).status, 400, `setup should refuse '${username}'`);
		assertEquals(client.getCookie('session'), undefined, 'No session should be created');
	}
	const rows = queryDb(getDbPath(A), 'SELECT COUNT(*) as count FROM users') as {
		count: number;
	}[];
	assertEquals(rows[0].count, 0, 'No account should be created');
});

test('A: setup creates the password account and signs in', async () => {
	const client = new TestClient(origin(A));
	const res = await createUser(client, 'admin', 'password123', origin(A));
	assertEquals(await formResult(res), { status: 303, location: '/' });
	assertNotEquals(client.getCookie('session'), undefined);

	const page = await client.get('/databases');
	assertNotEquals(page.status, 303, 'Should be signed in');
	assertEquals(localAccountCount(A), 1);
});

test('A: setup is closed once the account exists', async () => {
	const client = new TestClient(origin(A));
	const res = await client.get('/auth/setup');
	assertEquals(res.status, 303);
	assertNotEquals(res.headers.get('location'), '/auth/setup');
});

// --- B: AUTH=on, no SSO, password account ---

test('B: login page shows only the password form', async () => {
	assertEquals(await loginPage(B), { password: true, sso: false });
});

test('B: password sign-in works', async () => {
	const client = new TestClient(origin(B));
	const res = await login(client, 'admin', 'password123', origin(B));
	assertEquals(await formResult(res), { status: 303, location: '/' });
	const page = await client.get('/databases');
	assertNotEquals(page.status, 303, 'Should be signed in');
});

test('B: sidebar shows Log Out', async () => {
	const client = new TestClient(origin(B));
	await login(client, 'admin', 'password123', origin(B));
	const res = await client.get('/databases');
	assertEquals(res.status, 200);
	assertStringIncludes(await res.text(), LOGOUT_LINK);
});

test('B: SSO login endpoint is refused when SSO is not configured', async () => {
	const client = new TestClient(origin(B));
	const res = await client.get('/auth/oidc/login');
	assertEquals(res.status, 400);
});

test('B: SSO callback is refused when SSO is not configured', async () => {
	const res = await callbackWithValidState(B);
	assertEquals(res.status, 400);
});

test('B: setup page is closed', async () => {
	const client = new TestClient(origin(B));
	const res = await client.get('/auth/setup');
	assertEquals(res.status, 303);
	assertEquals(res.headers.get('location'), '/');
});

test('B: no deprecation warning at startup', () => {
	assert(!getServerOutput(B).includes(DEPRECATION_WARNING));
});

// --- C: AUTH=on + SSO, no accounts ---

test('C: first visit goes to login, not setup', async () => {
	const client = new TestClient(origin(C));
	const res = await client.get('/');
	assertEquals(res.status, 303);
	assertEquals(res.headers.get('location'), '/auth/login');
});

test('C: setup page is closed', async () => {
	const client = new TestClient(origin(C));
	const res = await client.get('/auth/setup');
	assertEquals(res.status, 303);
	assertNotEquals(res.headers.get('location'), '/auth/setup');
});

test('C: submitting the setup form directly does not create an account', async () => {
	const client = new TestClient(origin(C));
	await createUser(client, 'intruder', 'password123', origin(C));
	assertEquals(localAccountCount(C), 0);
	assertEquals(client.getCookie('session'), undefined);
});

test('C: login page shows only the SSO button', async () => {
	assertEquals(await loginPage(C), { password: false, sso: true });
});

test('C: password sign-in is refused', async () => {
	const client = new TestClient(origin(C));
	const res = await login(client, 'admin', 'password123', origin(C));
	assertEquals((await formResult(res)).status, 400);
	assertEquals(client.getCookie('session'), undefined);
});

test('C: SSO sign-in works', async () => {
	const client = new TestClient(origin(C));
	const { callbackRes } = await completeOidcLogin(client, 'carol');
	assertEquals(callbackRes.status, 303);
	assertEquals(callbackRes.headers.get('location'), '/');
	const page = await client.get('/databases');
	assertNotEquals(page.status, 303, 'Should be signed in');
});

test('C: SSO accounts cannot sign in with a password', async () => {
	// oidc:carol exists after the SSO sign-in above, with a placeholder hash
	const client = new TestClient(origin(C));
	const res = await login(client, 'oidc:carol', 'OIDC_NO_PASSWORD', origin(C));
	assertEquals((await formResult(res)).status, 400);
	assertEquals(client.getCookie('session'), undefined);
});

test('C: no deprecation warning at startup', () => {
	assert(!getServerOutput(C).includes(DEPRECATION_WARNING));
});

// --- D: AUTH=on + SSO, password account ---

test('D: login page shows both the password form and the SSO button', async () => {
	assertEquals(await loginPage(D), { password: true, sso: true });
});

test('D: password sign-in works', async () => {
	const client = new TestClient(origin(D));
	const res = await login(client, 'admin', 'password123', origin(D));
	assertEquals(await formResult(res), { status: 303, location: '/' });
	const page = await client.get('/databases');
	assertNotEquals(page.status, 303, 'Should be signed in');
});

test('D: SSO sign-in works', async () => {
	const client = new TestClient(origin(D));
	const { callbackRes } = await completeOidcLogin(client, 'dave');
	assertEquals(callbackRes.status, 303);
	const page = await client.get('/databases');
	assertNotEquals(page.status, 303, 'Should be signed in');
});

// --- E: AUTH=oidc (deprecated) + SSO, no accounts ---

test('E: startup logs the deprecation warning', () => {
	assertStringIncludes(getServerOutput(E), DEPRECATION_WARNING);
});

test('E: warning does not mention a password account when none exists', () => {
	assert(!getServerOutput(E).includes(LEFTOVER_ACCOUNT_WARNING));
});

test('E: first visit goes to login, not setup', async () => {
	const client = new TestClient(origin(E));
	const res = await client.get('/');
	assertEquals(res.status, 303);
	assertEquals(res.headers.get('location'), '/auth/login');
});

test('E: setup page is closed', async () => {
	const client = new TestClient(origin(E));
	const res = await client.get('/auth/setup');
	assertEquals(res.status, 303);
	assertNotEquals(res.headers.get('location'), '/auth/setup');
});

test('E: login page shows only the SSO button', async () => {
	assertEquals(await loginPage(E), { password: false, sso: true });
});

test('E: SSO sign-in works', async () => {
	const client = new TestClient(origin(E));
	const { callbackRes } = await completeOidcLogin(client, 'erin');
	assertEquals(callbackRes.status, 303);
	const page = await client.get('/databases');
	assertNotEquals(page.status, 303, 'Should be signed in');
});

// --- F: AUTH=oidc (deprecated) + SSO, leftover password account ---

test('F: startup warning mentions the password account', () => {
	const output = getServerOutput(F);
	assertStringIncludes(output, DEPRECATION_WARNING);
	assertStringIncludes(output, LEFTOVER_ACCOUNT_WARNING);
});

test('F: login page shows both the password form and the SSO button', async () => {
	assertEquals(await loginPage(F), { password: true, sso: true });
});

test('F: password sign-in works', async () => {
	const client = new TestClient(origin(F));
	const res = await login(client, 'admin', 'password123', origin(F));
	assertEquals(await formResult(res), { status: 303, location: '/' });
	const page = await client.get('/databases');
	assertNotEquals(page.status, 303, 'Should be signed in');
});

test('F: SSO sign-in works', async () => {
	const client = new TestClient(origin(F));
	const { callbackRes } = await completeOidcLogin(client, 'frank');
	assertEquals(callbackRes.status, 303);
	const page = await client.get('/databases');
	assertNotEquals(page.status, 303, 'Should be signed in');
});

// --- G: AUTH=off, SSO settings present ---

test('G: pages load without signing in', async () => {
	const client = new TestClient(origin(G));
	const res = await client.get('/databases');
	assertEquals(res.status, 200);
});

test('G: no redirect to setup or login', async () => {
	const client = new TestClient(origin(G));
	const res = await client.get('/');
	const location = res.headers.get('location') ?? '';
	assert(!location.startsWith('/auth/'), `Unexpected redirect to ${location}`);
});

test('G: login page redirects home', async () => {
	// Nothing to sign in to with AUTH=off, e.g. an old bookmark to /auth/login
	const client = new TestClient(origin(G));
	const res = await client.get('/auth/login');
	assertEquals(res.status, 303);
	assertEquals(res.headers.get('location'), '/');
});

test('G: sidebar hides Log Out', async () => {
	const client = new TestClient(origin(G));
	const res = await client.get('/databases');
	assertEquals(res.status, 200);
	assert(!(await res.text()).includes(LOGOUT_LINK), 'Log Out should be hidden with AUTH=off');
});

test('G: SSO settings are ignored', async () => {
	const client = new TestClient(origin(G));
	const res = await client.get('/auth/oidc/login');
	assertEquals(res.status, 400);
});

// --- H: AUTH=on, SSO settings removed, only SSO accounts ---

test('H: refuses to start instead of opening setup', async () => {
	let started = false;
	try {
		await startServer(H, { AUTH: 'on', ORIGIN: origin(H) }, 'preview');
		started = true;
	} catch {
		// Expected: the process exits before its health check passes
	}
	assert(!started, 'Server should refuse to start');
	assertStringIncludes(getServerOutput(H), LOCKED_OUT_ERROR);
});

// --- I: concurrent first-run setup submissions ---

test('I: two setup submissions at once create only one account', async () => {
	// Password hashing is slow, so both requests are in flight together
	const clients = [new TestClient(origin(I)), new TestClient(origin(I))];
	await Promise.all([
		createUser(clients[0], 'first', 'password123', origin(I)),
		createUser(clients[1], 'second', 'password123', origin(I))
	]);

	assertEquals(localAccountCount(I), 1, 'Only one password account may exist');
	const signedIn = clients.filter((c) => c.getCookie('session') !== undefined);
	assertEquals(signedIn.length, 1, 'Only the winning submission should be signed in');
});

await run();
