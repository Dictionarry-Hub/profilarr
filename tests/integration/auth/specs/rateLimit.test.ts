/**
 * Integration tests: Login rate limiting
 *
 * Rate limiting is category-aware with a 15-minute window:
 *   - suspicious (common attack usernames like "admin"): 3 attempts
 *   - typo (wrong password for real user): 10 attempts
 *
 * All requests come from 127.0.0.1 so IP isolation can't be tested here
 * (covered by unit tests in network.test.ts).
 *
 * NOTE: SvelteKit form actions return HTTP 200 with the actual status in the
 * JSON body: {"type":"failure","status":429,...}. Tests check the body status.
 *
 * Tests:
 * 1. Suspicious username blocked after 3 attempts
 * 2. Typo category blocked after 10 attempts
 * 3. Below threshold is not blocked
 * 4. Successful login clears attempts
 * 5. Expired attempts not counted
 * 6. 429 response includes error message
 */

import { assertEquals, assertNotEquals } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { createUser, login, clearLoginAttempts, insertExpiredAttempts } from '../harness/setup.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';

const PORT = 7007;
const ORIGIN = `http://localhost:${PORT}`;

/**
 * Parse SvelteKit form action response to get the inner status.
 * Form actions return HTTP 200 with {"type":"failure","status":429,...}
 */
async function getFormStatus(res: Response): Promise<number> {
	const body = await res.text();
	try {
		const parsed = JSON.parse(body);
		return parsed.status ?? res.status;
	} catch {
		return res.status;
	}
}

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');
	const client = new TestClient(ORIGIN);
	await createUser(client, 'myuser', 'password123', ORIGIN);
});

teardown(async () => {
	await stopServer(PORT);
});

/**
 * Helper: attempt login N times with given credentials.
 */
async function attemptLogins(username: string, password: string, count: number): Promise<void> {
	for (let i = 0; i < count; i++) {
		const client = new TestClient(ORIGIN);
		await client.postForm('/auth/login', { username, password }, { headers: { Origin: ORIGIN } });
	}
}

test('suspicious username blocked after 3 attempts', async () => {
	clearLoginAttempts(getDbPath(PORT));
	// "admin" is a common attack username — suspicious category, threshold 3
	await attemptLogins('admin', 'wrong', 3);

	const client = new TestClient(ORIGIN);
	const res = await client.postForm(
		'/auth/login',
		{ username: 'admin', password: 'wrong' },
		{ headers: { Origin: ORIGIN } }
	);
	assertEquals(await getFormStatus(res), 429);
});

test('typo category blocked after 10 attempts', async () => {
	clearLoginAttempts(getDbPath(PORT));
	// Wrong password for real user "myuser" — typo category, threshold 10
	await attemptLogins('myuser', 'wrong', 10);

	const client = new TestClient(ORIGIN);
	const res = await client.postForm(
		'/auth/login',
		{ username: 'myuser', password: 'wrong' },
		{ headers: { Origin: ORIGIN } }
	);
	assertEquals(await getFormStatus(res), 429);
});

test('below threshold is not blocked', async () => {
	clearLoginAttempts(getDbPath(PORT));
	// 2 suspicious attempts — under the threshold of 3
	await attemptLogins('admin', 'wrong', 2);

	const client = new TestClient(ORIGIN);
	const res = await client.postForm(
		'/auth/login',
		{ username: 'admin', password: 'wrong' },
		{ headers: { Origin: ORIGIN } }
	);
	assertNotEquals(await getFormStatus(res), 429);
});

test('successful login clears attempts', async () => {
	clearLoginAttempts(getDbPath(PORT));
	// 2 suspicious attempts
	await attemptLogins('admin', 'wrong', 2);

	// Successful login clears the counter
	const client = new TestClient(ORIGIN);
	await login(client, 'myuser', 'password123', ORIGIN);

	// 3 more suspicious attempts — would be 5 total without the clear
	await attemptLogins('admin', 'wrong', 3);

	const freshClient = new TestClient(ORIGIN);
	const res = await freshClient.postForm(
		'/auth/login',
		{ username: 'admin', password: 'wrong' },
		{ headers: { Origin: ORIGIN } }
	);
	// 3 attempts after clear — exactly at threshold, should be blocked
	assertEquals(await getFormStatus(res), 429);
});

test('expired attempts not counted', async () => {
	clearLoginAttempts(getDbPath(PORT));
	// Insert 3 suspicious attempts from 20 minutes ago (outside 15-min window)
	insertExpiredAttempts(getDbPath(PORT), '127.0.0.1', 'suspicious', 3, 20);

	const client = new TestClient(ORIGIN);
	const res = await client.postForm(
		'/auth/login',
		{ username: 'admin', password: 'wrong' },
		{ headers: { Origin: ORIGIN } }
	);
	// Old attempts don't count — this should NOT be blocked
	assertNotEquals(await getFormStatus(res), 429);
});

test('429 response includes error message', async () => {
	clearLoginAttempts(getDbPath(PORT));
	await attemptLogins('admin', 'wrong', 3);

	const client = new TestClient(ORIGIN);
	const res = await client.postForm(
		'/auth/login',
		{ username: 'admin', password: 'wrong' },
		{ headers: { Origin: ORIGIN } }
	);
	const body = await res.text();
	assertEquals(body.includes('Too many login attempts'), true);
});

await run();
