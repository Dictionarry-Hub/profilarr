/**
 * Tests for the identity confirmation helpers behind API key creation.
 *
 * - isRecentlyConfirmed: the 30-minute window on a session's confirmed_at
 * - evaluateReauth: the checks on an SSO re-authentication result
 */

import { expect, test } from 'vitest';
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
	expect(isRecentlyConfirmed(null, NOW)).toStrictEqual(false);
	expect(isRecentlyConfirmed(undefined, NOW)).toStrictEqual(false);
});

test('isRecentlyConfirmed: just now is confirmed', () => {
	expect(isRecentlyConfirmed(minutesAgo(0), NOW)).toStrictEqual(true);
});

test('isRecentlyConfirmed: one second inside the window is confirmed', () => {
	const inside = new Date(NOW - CONFIRMATION_WINDOW_MINUTES * 60_000 + 1000).toISOString();
	expect(isRecentlyConfirmed(inside, NOW)).toStrictEqual(true);
});

test('isRecentlyConfirmed: one second past the window is not confirmed', () => {
	const past = new Date(NOW - CONFIRMATION_WINDOW_MINUTES * 60_000 - 1000).toISOString();
	expect(isRecentlyConfirmed(past, NOW)).toStrictEqual(false);
});

test('isRecentlyConfirmed: a timestamp in the future counts as confirmed', () => {
	// Clock skew between writer and reader must not lock the person out
	expect(isRecentlyConfirmed(minutesAgo(-5), NOW)).toStrictEqual(true);
});

test('isRecentlyConfirmed: SQLite format without timezone is read as UTC', () => {
	const sqlite = new Date(NOW - 60_000)
		.toISOString()
		.replace('T', ' ')
		.replace(/\.\d+Z$/, '');
	expect(isRecentlyConfirmed(sqlite, NOW)).toStrictEqual(true);
});

test('isRecentlyConfirmed: garbage is not confirmed', () => {
	expect(isRecentlyConfirmed('not a date', NOW)).toStrictEqual(false);
	expect(isRecentlyConfirmed('', NOW)).toStrictEqual(false);
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
	expect(evaluateReauth({ ...base, authTime: secondsAfterStart(10) })).toStrictEqual({ ok: true });
});

test('evaluateReauth: auth_time inside the skew allowance passes', () => {
	const withinSkew = secondsAfterStart(-(REAUTH_SKEW_SECONDS - 1));
	expect(evaluateReauth({ ...base, authTime: withinSkew })).toStrictEqual({ ok: true });
});

test('evaluateReauth: auth_time older than the skew allowance is stale', () => {
	const tooOld = secondsAfterStart(-(REAUTH_SKEW_SECONDS + 1));
	expect(evaluateReauth({ ...base, authTime: tooOld })).toStrictEqual({
		ok: false,
		reason: 'stale_auth_time'
	});
});

test('evaluateReauth: missing auth_time fails closed', () => {
	expect(evaluateReauth({ ...base, authTime: undefined })).toStrictEqual({
		ok: false,
		reason: 'no_auth_time'
	});
});

test('evaluateReauth: non-numeric auth_time fails closed', () => {
	for (const bad of ['4102444800', NaN, Infinity, null, {}]) {
		expect(evaluateReauth({ ...base, authTime: bad }), `authTime=${String(bad)}`).toStrictEqual({
			ok: false,
			reason: 'no_auth_time'
		});
	}
});

test('evaluateReauth: a different account is rejected before auth_time is considered', () => {
	expect(
		evaluateReauth({ ...base, sub: 'mallory', authTime: secondsAfterStart(10) })
	).toStrictEqual({
		ok: false,
		reason: 'sub_mismatch'
	});
});

test('evaluateReauth: a password account cannot be confirmed through SSO', () => {
	expect(
		evaluateReauth({ ...base, sessionUsername: 'admin', authTime: secondsAfterStart(10) })
	).toStrictEqual({ ok: false, reason: 'sub_mismatch' });
});

test('evaluateReauth: a start time that is not a number fails closed', () => {
	for (const startedAt of [Number.NaN, Number.POSITIVE_INFINITY]) {
		expect(evaluateReauth({ ...base, startedAt, authTime: secondsAfterStart(10) })).toStrictEqual({
			ok: false,
			reason: 'invalid_start'
		});
	}
});

test('evaluateReauth: sub comparison is exact', () => {
	expect(evaluateReauth({ ...base, sub: 'Alice', authTime: secondsAfterStart(10) })).toStrictEqual({
		ok: false,
		reason: 'sub_mismatch'
	});
});
