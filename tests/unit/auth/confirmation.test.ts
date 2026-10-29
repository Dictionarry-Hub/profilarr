/**
 * Tests for the identity confirmation helpers behind API key creation.
 *
 * - isRecentlyConfirmed: the 30-minute window on a session's confirmed_at
 * - evaluateReauth: the checks on an SSO re-authentication result
 */

import { test } from 'vitest';
import { assertEquals } from '@std/assert';
import {
	CONFIRMATION_WINDOW_MINUTES,
	REAUTH_SKEW_SECONDS,
	evaluateReauth,
	isRecentlyConfirmed
} from '#utils/auth/confirmation.ts';

const NOW = Date.parse('2026-10-14T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

// --- isRecentlyConfirmed ---

test('isRecentlyConfirmed: null and undefined are not confirmed', () => {
	assertEquals(isRecentlyConfirmed(null, NOW), false);
	assertEquals(isRecentlyConfirmed(undefined, NOW), false);
});

test('isRecentlyConfirmed: just now is confirmed', () => {
	assertEquals(isRecentlyConfirmed(minutesAgo(0), NOW), true);
});

test('isRecentlyConfirmed: one second inside the window is confirmed', () => {
	const inside = new Date(NOW - CONFIRMATION_WINDOW_MINUTES * 60_000 + 1000).toISOString();
	assertEquals(isRecentlyConfirmed(inside, NOW), true);
});

test('isRecentlyConfirmed: one second past the window is not confirmed', () => {
	const past = new Date(NOW - CONFIRMATION_WINDOW_MINUTES * 60_000 - 1000).toISOString();
	assertEquals(isRecentlyConfirmed(past, NOW), false);
});

test('isRecentlyConfirmed: a timestamp in the future counts as confirmed', () => {
	// Clock skew between writer and reader must not lock the person out
	assertEquals(isRecentlyConfirmed(minutesAgo(-5), NOW), true);
});

test('isRecentlyConfirmed: SQLite format without timezone is read as UTC', () => {
	const sqlite = new Date(NOW - 60_000)
		.toISOString()
		.replace('T', ' ')
		.replace(/\.\d+Z$/, '');
	assertEquals(isRecentlyConfirmed(sqlite, NOW), true);
});

test('isRecentlyConfirmed: garbage is not confirmed', () => {
	assertEquals(isRecentlyConfirmed('not a date', NOW), false);
	assertEquals(isRecentlyConfirmed('', NOW), false);
});

// --- evaluateReauth ---

const STARTED_AT = NOW - 30_000;
const base = {
	sub: 'alice',
	sessionUsername: 'oidc:alice',
	startedAt: STARTED_AT,
	now: NOW
};
const secondsAfterStart = (s: number) => Math.floor((STARTED_AT + s * 1000) / 1000);

test('evaluateReauth: fresh auth_time for the same account passes', () => {
	assertEquals(evaluateReauth({ ...base, authTime: secondsAfterStart(10) }), { ok: true });
});

test('evaluateReauth: auth_time inside the skew allowance passes', () => {
	const withinSkew = secondsAfterStart(-(REAUTH_SKEW_SECONDS - 1));
	assertEquals(evaluateReauth({ ...base, authTime: withinSkew }), { ok: true });
});

test('evaluateReauth: auth_time older than the skew allowance is stale', () => {
	const tooOld = secondsAfterStart(-(REAUTH_SKEW_SECONDS + 1));
	assertEquals(evaluateReauth({ ...base, authTime: tooOld }), {
		ok: false,
		reason: 'stale_auth_time'
	});
});

test('evaluateReauth: missing auth_time fails closed', () => {
	assertEquals(evaluateReauth({ ...base, authTime: undefined }), {
		ok: false,
		reason: 'no_auth_time'
	});
});

test('evaluateReauth: non-numeric auth_time fails closed', () => {
	for (const bad of ['4102444800', NaN, Infinity, null, {}]) {
		assertEquals(
			evaluateReauth({ ...base, authTime: bad }),
			{ ok: false, reason: 'no_auth_time' },
			`authTime=${String(bad)}`
		);
	}
});

test('evaluateReauth: a different account is rejected before auth_time is considered', () => {
	assertEquals(evaluateReauth({ ...base, sub: 'mallory', authTime: secondsAfterStart(10) }), {
		ok: false,
		reason: 'sub_mismatch'
	});
});

test('evaluateReauth: a password account cannot be confirmed through SSO', () => {
	assertEquals(
		evaluateReauth({ ...base, sessionUsername: 'admin', authTime: secondsAfterStart(10) }),
		{ ok: false, reason: 'sub_mismatch' }
	);
});

test('evaluateReauth: a start time that is not a number fails closed', () => {
	for (const startedAt of [Number.NaN, Number.POSITIVE_INFINITY]) {
		assertEquals(evaluateReauth({ ...base, startedAt, authTime: secondsAfterStart(10) }), {
			ok: false,
			reason: 'invalid_start'
		});
	}
});

test('evaluateReauth: sub comparison is exact', () => {
	assertEquals(evaluateReauth({ ...base, sub: 'Alice', authTime: secondsAfterStart(10) }), {
		ok: false,
		reason: 'sub_mismatch'
	});
});
