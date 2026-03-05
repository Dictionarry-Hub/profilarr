/**
 * Tests for OIDC utilities
 */

import { assertEquals, assertThrows } from '@std/assert';
import { buildAuthorizationUrl, decodeIdToken, verifyIdToken } from '$auth/oidc.ts';

// --- buildAuthorizationUrl ---

Deno.test('buildAuthorizationUrl: builds correct URL with all params', () => {
	const url = buildAuthorizationUrl('https://auth.example.com/authorize', {
		clientId: 'profilarr',
		redirectUri: 'https://profilarr.example.com/auth/oidc/callback',
		state: 'abc123',
		scope: 'openid email profile'
	});

	const parsed = new URL(url);
	assertEquals(parsed.origin + parsed.pathname, 'https://auth.example.com/authorize');
	assertEquals(parsed.searchParams.get('client_id'), 'profilarr');
	assertEquals(parsed.searchParams.get('redirect_uri'), 'https://profilarr.example.com/auth/oidc/callback');
	assertEquals(parsed.searchParams.get('response_type'), 'code');
	assertEquals(parsed.searchParams.get('state'), 'abc123');
	assertEquals(parsed.searchParams.get('scope'), 'openid email profile');
});

Deno.test('buildAuthorizationUrl: defaults scope to openid email profile', () => {
	const url = buildAuthorizationUrl('https://auth.example.com/authorize', {
		clientId: 'profilarr',
		redirectUri: 'https://profilarr.example.com/auth/oidc/callback',
		state: 'abc123'
	});

	const parsed = new URL(url);
	assertEquals(parsed.searchParams.get('scope'), 'openid email profile');
});

Deno.test('buildAuthorizationUrl: uses custom scope when provided', () => {
	const url = buildAuthorizationUrl('https://auth.example.com/authorize', {
		clientId: 'profilarr',
		redirectUri: 'https://profilarr.example.com/auth/oidc/callback',
		state: 'abc123',
		scope: 'openid'
	});

	const parsed = new URL(url);
	assertEquals(parsed.searchParams.get('scope'), 'openid');
});

Deno.test('buildAuthorizationUrl: redirect_uri reflects the origin passed in', () => {
	const url = buildAuthorizationUrl('https://auth.example.com/authorize', {
		clientId: 'profilarr',
		redirectUri: 'http://localhost:6868/auth/oidc/callback',
		state: 'abc123'
	});

	const parsed = new URL(url);
	assertEquals(parsed.searchParams.get('redirect_uri'), 'http://localhost:6868/auth/oidc/callback');
});

// --- decodeIdToken ---

/**
 * Helper to build a JWT with a given payload (no signature verification)
 */
function buildJwt(payload: Record<string, unknown>): string {
	const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
	const body = btoa(JSON.stringify(payload));
	const signature = 'fake-signature';
	return `${header}.${body}.${signature}`;
}

Deno.test('decodeIdToken: decodes valid JWT payload', () => {
	const token = buildJwt({
		sub: 'user123',
		email: 'user@example.com',
		iss: 'https://auth.example.com',
		aud: 'profilarr',
		exp: 9999999999,
		iat: 1000000000
	});

	const claims = decodeIdToken(token);
	assertEquals(claims.sub, 'user123');
	assertEquals(claims.email, 'user@example.com');
	assertEquals(claims.iss, 'https://auth.example.com');
	assertEquals(claims.aud, 'profilarr');
});

Deno.test('decodeIdToken: rejects token with wrong number of segments', () => {
	assertThrows(() => decodeIdToken('only.two'), Error, 'Invalid JWT format');
});

Deno.test('decodeIdToken: rejects token with one segment', () => {
	assertThrows(() => decodeIdToken('single'), Error, 'Invalid JWT format');
});

// --- verifyIdToken ---

Deno.test('verifyIdToken: passes with valid claims', () => {
	const claims = {
		sub: 'user123',
		iss: 'https://auth.example.com',
		aud: 'profilarr',
		exp: Math.floor(Date.now() / 1000) + 3600,
		iat: Math.floor(Date.now() / 1000)
	};

	// Should not throw
	verifyIdToken(claims, {
		clientId: 'profilarr',
		issuer: 'https://auth.example.com'
	});
});

Deno.test('verifyIdToken: rejects wrong issuer', () => {
	const claims = {
		sub: 'user123',
		iss: 'https://evil.example.com',
		aud: 'profilarr',
		exp: Math.floor(Date.now() / 1000) + 3600,
		iat: Math.floor(Date.now() / 1000)
	};

	assertThrows(
		() => verifyIdToken(claims, { clientId: 'profilarr', issuer: 'https://auth.example.com' }),
		Error,
		'Invalid issuer'
	);
});

Deno.test('verifyIdToken: rejects wrong audience', () => {
	const claims = {
		sub: 'user123',
		iss: 'https://auth.example.com',
		aud: 'wrong-client',
		exp: Math.floor(Date.now() / 1000) + 3600,
		iat: Math.floor(Date.now() / 1000)
	};

	assertThrows(
		() => verifyIdToken(claims, { clientId: 'profilarr', issuer: 'https://auth.example.com' }),
		Error,
		'Invalid audience'
	);
});

Deno.test('verifyIdToken: accepts audience as array containing clientId', () => {
	const claims = {
		sub: 'user123',
		iss: 'https://auth.example.com',
		aud: ['other-client', 'profilarr'],
		exp: Math.floor(Date.now() / 1000) + 3600,
		iat: Math.floor(Date.now() / 1000)
	};

	// Should not throw
	verifyIdToken(claims, {
		clientId: 'profilarr',
		issuer: 'https://auth.example.com'
	});
});

Deno.test('verifyIdToken: rejects expired token', () => {
	const claims = {
		sub: 'user123',
		iss: 'https://auth.example.com',
		aud: 'profilarr',
		exp: Math.floor(Date.now() / 1000) - 60,
		iat: Math.floor(Date.now() / 1000) - 3600
	};

	assertThrows(
		() => verifyIdToken(claims, { clientId: 'profilarr', issuer: 'https://auth.example.com' }),
		Error,
		'expired'
	);
});
