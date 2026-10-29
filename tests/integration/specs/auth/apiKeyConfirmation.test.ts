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

import { TestClient } from '#integration/harness/client.ts';
import { startServer, stopServer, getDbPath } from '#integration/harness/server.ts';
import {
	clearLoginAttempts,
	createUserDirect,
	formResult,
	getSessionConfirmedAt,
	login,
	setSessionConfirmedAt
} from '#integration/harness/setup.ts';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';

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
	expect(typeof sessionId, 'sign-in should set a session cookie').toStrictEqual('string');
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

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');
	await createUserDirect(getDbPath(PORT), 'admin', password);
});

afterAll(async () => {
	await stopServer(PORT);
});

test('a key can be created right after signing in', async () => {
	const { client, sessionId } = await signIn();
	expect(confirmedAt(sessionId), 'sign-in should set confirmed_at').not.toStrictEqual(null);
	expect(await createKey(client)).toStrictEqual(200);
});

test('a session confirmed 31 minutes ago cannot create a key', async () => {
	const { client, sessionId } = await signIn();
	age(sessionId, 31);
	expect(await createKey(client)).toStrictEqual(403);
});

test('a session confirmed 29 minutes ago can create a key', async () => {
	const { client, sessionId } = await signIn();
	age(sessionId, 29);
	expect(await createKey(client)).toStrictEqual(200);
});

test('a wrong password does not confirm and leaves confirmed_at unchanged', async () => {
	const { client, sessionId } = await signIn();
	age(sessionId, 31);
	const before = confirmedAt(sessionId);
	expect(await confirm(client, 'not-the-password')).toStrictEqual(400);
	expect(confirmedAt(sessionId)).toStrictEqual(before);
	expect(await createKey(client)).toStrictEqual(403);
});

test('the right password confirms, and several keys follow without asking again', async () => {
	const { client, sessionId } = await signIn();
	age(sessionId, 31);
	const before = confirmedAt(sessionId);
	expect(await confirm(client, password)).toStrictEqual(200);
	expect(confirmedAt(sessionId), 'confirmed_at should be refreshed').not.toStrictEqual(before);
	expect(await createKey(client)).toStrictEqual(200);
	expect(await createKey(client)).toStrictEqual(200);
	expect(await createKey(client)).toStrictEqual(200);
});

test('ordinary page activity never refreshes the confirmation', async () => {
	const { client, sessionId } = await signIn();
	age(sessionId, 31);
	const before = confirmedAt(sessionId);
	for (const path of ['/databases', '/settings/security', KEY_PAGE]) {
		const res = await client.get(path, { followRedirects: true });
		expect(res.status, `${path} should load`).toStrictEqual(200);
		await res.text();
	}
	expect(confirmedAt(sessionId)).toStrictEqual(before);
	expect(await createKey(client)).toStrictEqual(403);
});

test('two sessions of the same account are confirmed separately', async () => {
	const a = await signIn();
	const b = await signIn();
	age(a.sessionId, 31);
	age(b.sessionId, 31);
	expect(await confirm(a.client, password)).toStrictEqual(200);
	expect(await createKey(a.client)).toStrictEqual(200);
	expect(await createKey(b.client)).toStrictEqual(403);
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
	expect((await formResult(res)).status, 'password change should succeed').toStrictEqual(200);
	password = next;
	expect(confirmedAt(b.sessionId), 'the other session should lose its confirmation').toStrictEqual(
		null
	);
	expect(await createKey(b.client)).toStrictEqual(403);
	expect(confirmedAt(a.sessionId), 'the changing session stays confirmed').not.toStrictEqual(null);
	expect(await createKey(a.client)).toStrictEqual(200);
});

test('repeated wrong passwords are rate limited like the login page', async () => {
	const { client, sessionId } = await signIn();
	age(sessionId, 31);
	// The typo threshold is 10 failed attempts per window
	for (let i = 0; i < 10; i++) {
		expect(await confirm(client, 'wrong-password'), `attempt ${i + 1}`).toStrictEqual(400);
	}
	expect(await confirm(client, 'wrong-password'), 'the 11th attempt is blocked').toStrictEqual(429);
	expect(await confirm(client, password), 'the right password is blocked too').toStrictEqual(429);
	expect(await createKey(client)).toStrictEqual(403);
	clearLoginAttempts(getDbPath(PORT));
});
