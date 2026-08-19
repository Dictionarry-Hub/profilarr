/**
 * Integration tests: X-Forwarded-For behaviour
 *
 * Session metadata (IP recorded on login) uses trustProxy=true, so a spoofed
 * X-Forwarded-For gets stored in the sessions table. This is cosmetic (doesn't
 * affect auth decisions) but means session IP metadata isn't trustworthy
 * without a reverse proxy stripping client headers.
 *
 * Rate limiting and login-attempt recording use the real TCP address
 * (trustProxy=false), so spoofed headers cannot influence them.
 *
 * Tests:
 * 1. Spoofed X-Forwarded-For is recorded in session metadata
 * 2. Rate limit not bypassed by rotating X-Forwarded-For
 * 3. Failed login attempts recorded under real IP, not spoofed header
 */

import { assertEquals, assertNotEquals } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { createUserDirect, clearLoginAttempts, queryDb } from '$test-harness/setup.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';

const PORT = PORTS.auth.xForwardedFor;
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

test('rate limit not bypassed by rotating X-Forwarded-For', async () => {
	// Each attempt uses a different spoofed IP. If the server trusts these
	// headers for rate limiting, each attempt lands under a different counter
	// and the threshold is never reached. The fix: rate limiting should use
	// the real TCP address, so all attempts count against 127.0.0.1.
	clearLoginAttempts(getDbPath(PORT));

	// "root" is a suspicious attack username that doesn't exist — threshold is 3
	for (let i = 0; i < 3; i++) {
		const client = new TestClient(ORIGIN);
		await client.postForm(
			'/auth/login',
			{ username: 'root', password: 'wrong' },
			{ headers: { Origin: ORIGIN, 'X-Forwarded-For': `198.51.100.${i + 1}` } }
		);
	}

	// 4th attempt with yet another spoofed IP — should still be blocked
	const client = new TestClient(ORIGIN);
	const res = await client.postForm(
		'/auth/login',
		{ username: 'root', password: 'wrong' },
		{ headers: { Origin: ORIGIN, 'X-Forwarded-For': '198.51.100.99' } }
	);
	const body = await res.text();
	try {
		const parsed = JSON.parse(body);
		assertEquals(
			parsed.status,
			429,
			`Expected rate limit 429 despite rotating X-Forwarded-For, got ${parsed.status}`
		);
	} catch {
		assertEquals(res.status, 429, `Expected 429, got ${res.status}`);
	}
});

test('failed login attempts recorded under real IP, not spoofed header', async () => {
	clearLoginAttempts(getDbPath(PORT));

	const client = new TestClient(ORIGIN);
	await client.postForm(
		'/auth/login',
		{ username: 'root', password: 'wrong' },
		{ headers: { Origin: ORIGIN, 'X-Forwarded-For': '198.51.100.1' } }
	);

	const rows = queryDb(
		getDbPath(PORT),
		'SELECT ip FROM login_attempts ORDER BY rowid DESC LIMIT 1'
	) as {
		ip: string;
	}[];
	assertEquals(rows.length, 1);
	// Should be the real TCP address (127.0.0.1), not the spoofed header
	assertNotEquals(
		rows[0].ip,
		'198.51.100.1',
		'login_attempts should record real TCP IP, not spoofed X-Forwarded-For'
	);
});

await run();
