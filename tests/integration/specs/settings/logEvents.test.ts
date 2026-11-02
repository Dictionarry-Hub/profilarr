/**
 * Integration tests for the Logs page's live stream, /settings/logs/events.
 *
 * The stream sends every new log entry, so only a logged-in session may open
 * it:
 * 1. A session gets the event stream (control: the route exists and streams)
 * 2. An API key is rejected with 403 (keys are scoped to /api/v1)
 * 3. No session redirects to the login page
 */

import { afterAll, beforeAll, expect, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';
import { startServer, stopServer, getDbPath } from '#integration/harness/server.ts';
import { TestClient } from '#integration/harness/client.ts';
import { createUser, login, setApiKey } from '#integration/harness/setup.ts';

const PORT = PORTS.settings.logEvents;
const ORIGIN = `http://localhost:${PORT}`;
const API_KEY = 'test-api-key-log-events-12345';
const PATH = '/settings/logs/events';

let client: TestClient;

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');

	client = new TestClient(ORIGIN);
	await createUser(client, 'admin', 'password123', ORIGIN);
	await login(client, 'admin', 'password123', ORIGIN);
	await setApiKey(getDbPath(PORT), API_KEY);
});

afterAll(async () => {
	await stopServer(PORT);
});

test('a session gets the event stream', async () => {
	// The stream never ends, so read the headers and abort instead of reading the body
	const session = client.getCookie('session');
	expect(session, 'control: logging in should set a session cookie').toBeTruthy();

	const controller = new AbortController();
	try {
		const res = await fetch(`${ORIGIN}${PATH}`, {
			headers: { Cookie: `session=${session}` },
			redirect: 'manual',
			signal: controller.signal
		});
		expect(res.status).toStrictEqual(200);
		expect(res.headers.get('content-type')).toContain('text/event-stream');
	} finally {
		controller.abort();
	}
});

test('an API key is rejected', async () => {
	const c = new TestClient(ORIGIN);
	const res = await c.get(PATH, { headers: { 'X-Api-Key': API_KEY } });
	expect(res.status, 'An API key should get 403').toStrictEqual(403);
});

test('no session redirects to the login page', async () => {
	const c = new TestClient(ORIGIN);
	const res = await c.get(PATH);
	expect(res.status).toStrictEqual(303);
	expect(res.headers.get('location')).toStrictEqual('/auth/login');
});
