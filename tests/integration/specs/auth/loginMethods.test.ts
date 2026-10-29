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

import { TestClient } from '#integration/harness/client.ts';
import {
	startServer,
	stopServer,
	getDbPath,
	getServerOutput
} from '#integration/harness/server.ts';
import {
	createUser,
	createUserDirect,
	formResult,
	login,
	queryDb
} from '#integration/harness/setup.ts';
import { completeOidcLogin, OIDC_SETTINGS } from '#integration/harness/oidc.ts';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';

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
	expect(res.status, 'Login page should render').toStrictEqual(200);
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

beforeAll(async () => {
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

afterAll(async () => {
	await Promise.all([A, B, C, D, E, F, G, H, I].map((port) => stopServer(port)));
});

// --- A: AUTH=on, no SSO, no accounts ---

test('A: first visit redirects to setup', async () => {
	const client = new TestClient(origin(A));
	const res = await client.get('/');
	expect(res.status).toStrictEqual(303);
	expect(res.headers.get('location')).toStrictEqual('/auth/setup');
});

test('A: login page redirects to setup', async () => {
	const client = new TestClient(origin(A));
	const res = await client.get('/auth/login');
	expect(res.status).toStrictEqual(303);
	expect(res.headers.get('location')).toStrictEqual('/auth/setup');
});

test('A: setup refuses usernames starting with oidc: in any case', async () => {
	for (const username of ['oidc:admin', 'OIDC:admin']) {
		const client = new TestClient(origin(A));
		const res = await createUser(client, username, 'password123', origin(A));
		expect((await formResult(res)).status, `setup should refuse '${username}'`).toStrictEqual(400);
		expect(client.getCookie('session'), 'No session should be created').toStrictEqual(undefined);
	}
	const rows = queryDb(getDbPath(A), 'SELECT COUNT(*) as count FROM users') as {
		count: number;
	}[];
	expect(rows[0].count, 'No account should be created').toStrictEqual(0);
});

test('A: setup creates the password account and signs in', async () => {
	const client = new TestClient(origin(A));
	const res = await createUser(client, 'admin', 'password123', origin(A));
	expect(await formResult(res)).toStrictEqual({ status: 303, location: '/' });
	expect(client.getCookie('session')).not.toStrictEqual(undefined);

	const page = await client.get('/databases');
	expect(page.status, 'Should be signed in').not.toStrictEqual(303);
	expect(localAccountCount(A)).toStrictEqual(1);
});

test('A: setup is closed once the account exists', async () => {
	const client = new TestClient(origin(A));
	const res = await client.get('/auth/setup');
	expect(res.status).toStrictEqual(303);
	expect(res.headers.get('location')).not.toStrictEqual('/auth/setup');
});

// --- B: AUTH=on, no SSO, password account ---

test('B: login page shows only the password form', async () => {
	expect(await loginPage(B)).toStrictEqual({ password: true, sso: false });
});

test('B: password sign-in works', async () => {
	const client = new TestClient(origin(B));
	const res = await login(client, 'admin', 'password123', origin(B));
	expect(await formResult(res)).toStrictEqual({ status: 303, location: '/' });
	const page = await client.get('/databases');
	expect(page.status, 'Should be signed in').not.toStrictEqual(303);
});

test('B: sidebar shows Log Out', async () => {
	const client = new TestClient(origin(B));
	await login(client, 'admin', 'password123', origin(B));
	const res = await client.get('/databases');
	expect(res.status).toStrictEqual(200);
	expect(await res.text()).toContain(LOGOUT_LINK);
});

test('B: SSO login endpoint is refused when SSO is not configured', async () => {
	const client = new TestClient(origin(B));
	const res = await client.get('/auth/oidc/login');
	expect(res.status).toStrictEqual(400);
});

test('B: SSO callback is refused when SSO is not configured', async () => {
	const res = await callbackWithValidState(B);
	expect(res.status).toStrictEqual(400);
});

test('B: setup page is closed', async () => {
	const client = new TestClient(origin(B));
	const res = await client.get('/auth/setup');
	expect(res.status).toStrictEqual(303);
	expect(res.headers.get('location')).toStrictEqual('/');
});

test('B: no deprecation warning at startup', () => {
	expect(!getServerOutput(B).includes(DEPRECATION_WARNING)).toBeTruthy();
});

// --- C: AUTH=on + SSO, no accounts ---

test('C: first visit goes to login, not setup', async () => {
	const client = new TestClient(origin(C));
	const res = await client.get('/');
	expect(res.status).toStrictEqual(303);
	expect(res.headers.get('location')).toStrictEqual('/auth/login');
});

test('C: setup page is closed', async () => {
	const client = new TestClient(origin(C));
	const res = await client.get('/auth/setup');
	expect(res.status).toStrictEqual(303);
	expect(res.headers.get('location')).not.toStrictEqual('/auth/setup');
});

test('C: submitting the setup form directly does not create an account', async () => {
	const client = new TestClient(origin(C));
	await createUser(client, 'intruder', 'password123', origin(C));
	expect(localAccountCount(C)).toStrictEqual(0);
	expect(client.getCookie('session')).toStrictEqual(undefined);
});

test('C: login page shows only the SSO button', async () => {
	expect(await loginPage(C)).toStrictEqual({ password: false, sso: true });
});

test('C: password sign-in is refused', async () => {
	const client = new TestClient(origin(C));
	const res = await login(client, 'admin', 'password123', origin(C));
	expect((await formResult(res)).status).toStrictEqual(400);
	expect(client.getCookie('session')).toStrictEqual(undefined);
});

test('C: SSO sign-in works', async () => {
	const client = new TestClient(origin(C));
	const { callbackRes } = await completeOidcLogin(client, 'carol');
	expect(callbackRes.status).toStrictEqual(303);
	expect(callbackRes.headers.get('location')).toStrictEqual('/');
	const page = await client.get('/databases');
	expect(page.status, 'Should be signed in').not.toStrictEqual(303);
});

test('C: SSO accounts cannot sign in with a password', async () => {
	// oidc:carol exists after the SSO sign-in above, with a placeholder hash
	const client = new TestClient(origin(C));
	const res = await login(client, 'oidc:carol', 'OIDC_NO_PASSWORD', origin(C));
	expect((await formResult(res)).status).toStrictEqual(400);
	expect(client.getCookie('session')).toStrictEqual(undefined);
});

test('C: no deprecation warning at startup', () => {
	expect(!getServerOutput(C).includes(DEPRECATION_WARNING)).toBeTruthy();
});

// --- D: AUTH=on + SSO, password account ---

test('D: login page shows both the password form and the SSO button', async () => {
	expect(await loginPage(D)).toStrictEqual({ password: true, sso: true });
});

test('D: password sign-in works', async () => {
	const client = new TestClient(origin(D));
	const res = await login(client, 'admin', 'password123', origin(D));
	expect(await formResult(res)).toStrictEqual({ status: 303, location: '/' });
	const page = await client.get('/databases');
	expect(page.status, 'Should be signed in').not.toStrictEqual(303);
});

test('D: SSO sign-in works', async () => {
	const client = new TestClient(origin(D));
	const { callbackRes } = await completeOidcLogin(client, 'dave');
	expect(callbackRes.status).toStrictEqual(303);
	const page = await client.get('/databases');
	expect(page.status, 'Should be signed in').not.toStrictEqual(303);
});

// --- E: AUTH=oidc (deprecated) + SSO, no accounts ---

test('E: startup logs the deprecation warning', () => {
	expect(getServerOutput(E)).toContain(DEPRECATION_WARNING);
});

test('E: warning does not mention a password account when none exists', () => {
	expect(!getServerOutput(E).includes(LEFTOVER_ACCOUNT_WARNING)).toBeTruthy();
});

test('E: first visit goes to login, not setup', async () => {
	const client = new TestClient(origin(E));
	const res = await client.get('/');
	expect(res.status).toStrictEqual(303);
	expect(res.headers.get('location')).toStrictEqual('/auth/login');
});

test('E: setup page is closed', async () => {
	const client = new TestClient(origin(E));
	const res = await client.get('/auth/setup');
	expect(res.status).toStrictEqual(303);
	expect(res.headers.get('location')).not.toStrictEqual('/auth/setup');
});

test('E: login page shows only the SSO button', async () => {
	expect(await loginPage(E)).toStrictEqual({ password: false, sso: true });
});

test('E: SSO sign-in works', async () => {
	const client = new TestClient(origin(E));
	const { callbackRes } = await completeOidcLogin(client, 'erin');
	expect(callbackRes.status).toStrictEqual(303);
	const page = await client.get('/databases');
	expect(page.status, 'Should be signed in').not.toStrictEqual(303);
});

// --- F: AUTH=oidc (deprecated) + SSO, leftover password account ---

test('F: startup warning mentions the password account', () => {
	const output = getServerOutput(F);
	expect(output).toContain(DEPRECATION_WARNING);
	expect(output).toContain(LEFTOVER_ACCOUNT_WARNING);
});

test('F: login page shows both the password form and the SSO button', async () => {
	expect(await loginPage(F)).toStrictEqual({ password: true, sso: true });
});

test('F: password sign-in works', async () => {
	const client = new TestClient(origin(F));
	const res = await login(client, 'admin', 'password123', origin(F));
	expect(await formResult(res)).toStrictEqual({ status: 303, location: '/' });
	const page = await client.get('/databases');
	expect(page.status, 'Should be signed in').not.toStrictEqual(303);
});

test('F: SSO sign-in works', async () => {
	const client = new TestClient(origin(F));
	const { callbackRes } = await completeOidcLogin(client, 'frank');
	expect(callbackRes.status).toStrictEqual(303);
	const page = await client.get('/databases');
	expect(page.status, 'Should be signed in').not.toStrictEqual(303);
});

// --- G: AUTH=off, SSO settings present ---

test('G: pages load without signing in', async () => {
	const client = new TestClient(origin(G));
	const res = await client.get('/databases');
	expect(res.status).toStrictEqual(200);
});

test('G: no redirect to setup or login', async () => {
	const client = new TestClient(origin(G));
	const res = await client.get('/');
	const location = res.headers.get('location') ?? '';
	expect(!location.startsWith('/auth/'), `Unexpected redirect to ${location}`).toBeTruthy();
});

test('G: login page redirects home', async () => {
	// Nothing to sign in to with AUTH=off, e.g. an old bookmark to /auth/login
	const client = new TestClient(origin(G));
	const res = await client.get('/auth/login');
	expect(res.status).toStrictEqual(303);
	expect(res.headers.get('location')).toStrictEqual('/');
});

test('G: sidebar hides Log Out', async () => {
	const client = new TestClient(origin(G));
	const res = await client.get('/databases');
	expect(res.status).toStrictEqual(200);
	expect(
		!(await res.text()).includes(LOGOUT_LINK),
		'Log Out should be hidden with AUTH=off'
	).toBeTruthy();
});

test('G: SSO settings are ignored', async () => {
	const client = new TestClient(origin(G));
	const res = await client.get('/auth/oidc/login');
	expect(res.status).toStrictEqual(400);
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
	expect(!started, 'Server should refuse to start').toBeTruthy();
	expect(getServerOutput(H)).toContain(LOCKED_OUT_ERROR);
});

// --- I: concurrent first-run setup submissions ---

test('I: two setup submissions at once create only one account', async () => {
	// Password hashing is slow, so both requests are in flight together
	const clients = [new TestClient(origin(I)), new TestClient(origin(I))];
	await Promise.all([
		createUser(clients[0], 'first', 'password123', origin(I)),
		createUser(clients[1], 'second', 'password123', origin(I))
	]);

	expect(localAccountCount(I), 'Only one password account may exist').toStrictEqual(1);
	const signedIn = clients.filter((c) => c.getCookie('session') !== undefined);
	expect(signedIn.length, 'Only the winning submission should be signed in').toStrictEqual(1);
});
