/**
 * Integration tests: X-Forwarded-For behaviour
 *
 * The local bypass auth check uses getClientIp(event, false) which ignores
 * proxy headers and uses the real TCP address. This means a remote attacker
 * cannot spoof X-Forwarded-For: 192.168.x.x to bypass auth. This fix can't
 * be demonstrated here because integration tests run from localhost (the real
 * TCP address is already local) - it's verified by unit tests in network.test.ts.
 *
 * What IS still true: session metadata (IP recorded on login) uses
 * trustProxy=true, so a spoofed X-Forwarded-For gets stored in the sessions
 * table. This is cosmetic (doesn't affect auth decisions) but means session
 * IP metadata isn't trustworthy without a reverse proxy stripping client headers.
 *
 * Tests:
 * 1. Spoofed X-Forwarded-For is recorded in session metadata
 * 2. Local bypass works for genuine local connections (trustProxy=false uses real TCP)
 */

import { assertEquals, assertNotEquals } from '@std/assert';
import { TestClient } from '../harness/client.ts';
import { startServer, stopServer, getDbPath } from '../harness/server.ts';
import { createUserDirect, queryDb } from '../harness/setup.ts';
import { setup, teardown, test, run } from '../harness/runner.ts';
import { Database } from 'jsr:@db/sqlite@0.12';

const PORT = 7015;
const ORIGIN = `http://localhost:${PORT}`;

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');
	await createUserDirect(getDbPath(PORT), 'admin', 'password123');
});

teardown(async () => {
	await stopServer(PORT);
});

test('spoofed X-Forwarded-For is recorded in session metadata', async () => {
	// Session creation uses getClientIp(event) with trustProxy=true (default),
	// so the spoofed header is stored as the session IP. This is a metadata
	// issue, not an auth bypass - no auth decisions use this value.
	const client = new TestClient(ORIGIN);
	const spoofedIp = '198.51.100.99';

	await client.postForm(
		'/auth/login',
		{ username: 'admin', password: 'password123' },
		{ headers: { Origin: ORIGIN, 'X-Forwarded-For': spoofedIp } }
	);

	const sessionId = client.getCookie('session');
	assertNotEquals(sessionId, undefined);

	const rows = queryDb(getDbPath(PORT), 'SELECT ip_address FROM sessions WHERE id = ?', [
		sessionId!
	]) as { ip_address: string | null }[];

	assertEquals(rows.length, 1);
	assertEquals(rows[0].ip_address, spoofedIp);
});

test('local bypass uses real TCP address, not proxy headers', async () => {
	// The local bypass check passes trustProxy=false, so it ignores
	// X-Forwarded-For and uses getClientAddress() (real TCP). Since this
	// test runs from localhost, the real TCP address IS local, so bypass
	// works. A remote attacker spoofing X-Forwarded-For: 192.168.x.x
	// would be rejected because their real TCP address is public.
	const conn = new Database(getDbPath(PORT));
	try {
		conn.exec('UPDATE auth_settings SET local_bypass_enabled = 1 WHERE id = 1');
	} finally {
		conn.close();
	}

	const client = new TestClient(ORIGIN);
	const res = await client.get('/databases', {
		headers: { 'X-Forwarded-For': '192.168.1.100' }
	});

	// 200 = local bypass worked. This succeeds because the real TCP address
	// is localhost (local), NOT because of the spoofed header.
	assertNotEquals(res.status, 303);
});

await run();
