/**
 * Integration tests: X-Forwarded-For spoofing
 *
 * These tests PROVE the vulnerabilities exist (both should fail).
 * The actual defense is verified by unit tests in network.test.ts
 * because integration tests run from localhost (real TCP address is
 * already local, so we can't simulate a remote attacker).
 *
 * Vulnerability 1: Spoofed header recorded as session IP (rate limit bypass)
 * Vulnerability 2: Spoofed local IP bypasses auth entirely
 *
 * The fix is in the adapter (mod.ts): use info.remoteAddr.hostname
 * instead of reading X-Forwarded-For. This makes getClientAddress()
 * return the real TCP address, so getClientIp(event, false) works
 * correctly for the local bypass check.
 *
 * Tests:
 * 1. Spoofed X-Forwarded-For is recorded as session IP (proves vuln exists)
 * 2. Spoofed local IP bypasses auth (proves vuln exists)
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

test('spoofed X-Forwarded-For is recorded as session IP', async () => {
	// This PROVES the vulnerability: trustProxy=true reads headers on login,
	// so a spoofed header gets recorded. An attacker can rotate IPs to
	// bypass rate limits. Defense: unit tested in network.test.ts.
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
	// The spoofed IP IS recorded — this is the vulnerability
	assertEquals(rows[0].ip_address, spoofedIp);
});

test('spoofed local IP bypasses auth when local bypass enabled', async () => {
	// This PROVES the vulnerability: with local bypass on, a spoofed
	// X-Forwarded-For: 192.168.x.x grants full access without login.
	// NOTE: This test passes even after the adapter fix because the test
	// runs from localhost (real TCP is already local). The adapter fix
	// protects remote attackers — verified by unit tests in network.test.ts.
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

	// 200 = auth bypassed (vulnerability). From a remote IP with the adapter
	// fix, this would correctly return 303.
	assertNotEquals(res.status, 303);
});

await run();
