/**
 * Integration tests: creating an API key needs a recently confirmed session.
 *
 * A session records confirmed_at: set at sign-in, refreshed by the confirm
 * action on the create-key page (password sessions re-enter their password),
 * valid for 30 minutes, never refreshed by ordinary activity.
 *
 * Tests:
 * 1. A key can be created right after signing in
 * 2. A session confirmed 31 minutes ago cannot create a key
 * 3. A session confirmed 29 minutes ago can
 * 4. A wrong password does not confirm and leaves confirmed_at unchanged
 * 5. The right password confirms, and several keys follow without asking again
 * 6. Ordinary page activity never refreshes the confirmation
 * 7. Two sessions of the same account are confirmed separately
 * 8. Changing the password clears the other session and keeps the current one
 * 9. Repeated wrong passwords are rate limited like the login page
 */

import { assertEquals, assertNotEquals } from '@std/assert';
import { TestClient } from '#tests/harness/client.ts';
import { startServer, stopServer, getDbPath } from '#tests/harness/server.ts';
import {
	clearLoginAttempts,
	createUserDirect,
	formResult,
	getSessionConfirmedAt,
	login,
	setSessionConfirmedAt
} from '#tests/harness/setup.ts';
import { setup, teardown, test, run } from '#tests/harness/runner.ts';
import { PORTS } from '#tests/harness/ports.ts';

const PORT = PORTS.auth.apiKeyConfirmation;
const ORIGIN = `http://localhost:${PORT}`;
const KEY_PAGE = '/settings/security/api-keys/new';
const origin = { headers: { Origin: ORIGIN } };

let password = 'password123';
let keyCounter = 0;

async function signIn(): Promise<{ client: TestClient; sessionId: string }> {
	const client = new TestClient(ORIGIN);
	await login(client, 'admin', password, ORIGIN);
	const sessionId = client.getCookie('session');
	assertEquals(typeof sessionId, 'string', 'sign-in should set a session cookie');
	return { client, sessionId: sessionId! };
}

async function createKey(client: TestClient): Promise<number> {
	keyCounter++;
	const res = await client.postForm(
		`${KEY_PAGE}?/create`,
		{ name: `confirm-test-${keyCounter}`, expiry: 'never', fullAccess: 'on', permissions: '{}' },
		origin
	);
	return (await formResult(res)).status;
}

async function confirm(client: TestClient, candidate: string): Promise<number> {
	const res = await client.postForm(`${KEY_PAGE}?/confirm`, { password: candidate }, origin);
	return (await formResult(res)).status;
}

const confirmedAt = (sessionId: string) => getSessionConfirmedAt(getDbPath(PORT), sessionId);
const age = (sessionId: string, minutes: number) =>
	setSessionConfirmedAt(getDbPath(PORT), sessionId, minutes);

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');
	await createUserDirect(getDbPath(PORT), 'admin', password);
});

teardown(async () => {
	await stopServer(PORT);
});

test('a key can be created right after signing in', async () => {
	const { client, sessionId } = await signIn();
	assertNotEquals(confirmedAt(sessionId), null, 'sign-in should set confirmed_at');
	assertEquals(await createKey(client), 200);
});

test('a session confirmed 31 minutes ago cannot create a key', async () => {
	const { client, sessionId } = await signIn();
	age(sessionId, 31);
	assertEquals(await createKey(client), 403);
});

test('a session confirmed 29 minutes ago can create a key', async () => {
	const { client, sessionId } = await signIn();
	age(sessionId, 29);
	assertEquals(await createKey(client), 200);
});

test('a wrong password does not confirm and leaves confirmed_at unchanged', async () => {
	const { client, sessionId } = await signIn();
	age(sessionId, 31);
	const before = confirmedAt(sessionId);
	assertEquals(await confirm(client, 'not-the-password'), 400);
	assertEquals(confirmedAt(sessionId), before);
	assertEquals(await createKey(client), 403);
});

test('the right password confirms, and several keys follow without asking again', async () => {
	const { client, sessionId } = await signIn();
	age(sessionId, 31);
	const before = confirmedAt(sessionId);
	assertEquals(await confirm(client, password), 200);
	assertNotEquals(confirmedAt(sessionId), before, 'confirmed_at should be refreshed');
	assertEquals(await createKey(client), 200);
	assertEquals(await createKey(client), 200);
	assertEquals(await createKey(client), 200);
});

test('ordinary page activity never refreshes the confirmation', async () => {
	const { client, sessionId } = await signIn();
	age(sessionId, 31);
	const before = confirmedAt(sessionId);
	for (const path of ['/databases', '/settings/security', KEY_PAGE]) {
		const res = await client.get(path, { followRedirects: true });
		assertEquals(res.status, 200, `${path} should load`);
		await res.text();
	}
	assertEquals(confirmedAt(sessionId), before);
	assertEquals(await createKey(client), 403);
});

test('two sessions of the same account are confirmed separately', async () => {
	const a = await signIn();
	const b = await signIn();
	age(a.sessionId, 31);
	age(b.sessionId, 31);
	assertEquals(await confirm(a.client, password), 200);
	assertEquals(await createKey(a.client), 200);
	assertEquals(await createKey(b.client), 403);
});

test('changing the password clears the other session and keeps the current one', async () => {
	const a = await signIn();
	const b = await signIn();
	const next = 'password456';
	const res = await a.client.postForm(
		'/settings/security?/changePassword',
		{ currentPassword: password, newPassword: next, confirmPassword: next },
		origin
	);
	assertEquals((await formResult(res)).status, 200, 'password change should succeed');
	password = next;
	assertEquals(confirmedAt(b.sessionId), null, 'the other session should lose its confirmation');
	assertEquals(await createKey(b.client), 403);
	assertNotEquals(confirmedAt(a.sessionId), null, 'the changing session stays confirmed');
	assertEquals(await createKey(a.client), 200);
});

test('repeated wrong passwords are rate limited like the login page', async () => {
	const { client, sessionId } = await signIn();
	age(sessionId, 31);
	// The typo threshold is 10 failed attempts per window
	for (let i = 0; i < 10; i++) {
		assertEquals(await confirm(client, 'wrong-password'), 400, `attempt ${i + 1}`);
	}
	assertEquals(await confirm(client, 'wrong-password'), 429, 'the 11th attempt is blocked');
	assertEquals(await confirm(client, password), 429, 'the right password is blocked too');
	assertEquals(await createKey(client), 403);
	clearLoginAttempts(getDbPath(PORT));
});

await run();
