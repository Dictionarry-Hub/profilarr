/**
 * Tests for parseAuthConfig: AUTH mode parsing, the deprecated `oidc` alias,
 * and OIDC enablement from the three OIDC_* settings.
 */

import { expect, test } from 'vitest';
import { parseAuthConfig } from '#utils/config/auth.ts';

const FULL_OIDC = {
	OIDC_DISCOVERY_URL: 'https://idp.example.com/.well-known/openid-configuration',
	OIDC_CLIENT_ID: 'profilarr',
	OIDC_CLIENT_SECRET: 'secret'
};

// --- AUTH mode ---

test('parseAuthConfig: AUTH unset defaults to on', () => {
	const result = parseAuthConfig({});
	expect(result.authMode).toStrictEqual('on');
	expect(result.deprecatedOidcMode).toStrictEqual(false);
});

test('parseAuthConfig: AUTH=on', () => {
	expect(parseAuthConfig({ AUTH: 'on' }).authMode).toStrictEqual('on');
});

test('parseAuthConfig: AUTH=off', () => {
	expect(parseAuthConfig({ AUTH: 'off' }).authMode).toStrictEqual('off');
});

test('parseAuthConfig: AUTH is case-insensitive', () => {
	expect(parseAuthConfig({ AUTH: 'OFF' }).authMode).toStrictEqual('off');
	expect(parseAuthConfig({ AUTH: 'On' }).authMode).toStrictEqual('on');
});

test('parseAuthConfig: unknown AUTH value falls back to on', () => {
	const result = parseAuthConfig({ AUTH: 'banana' });
	expect(result.authMode).toStrictEqual('on');
	expect(result.deprecatedOidcMode).toStrictEqual(false);
});

test('parseAuthConfig: AUTH=oidc is treated as on and flagged deprecated', () => {
	const result = parseAuthConfig({ AUTH: 'oidc', ...FULL_OIDC });
	expect(result.authMode).toStrictEqual('on');
	expect(result.deprecatedOidcMode).toStrictEqual(true);
});

test('parseAuthConfig: AUTH=OIDC is treated the same as AUTH=oidc', () => {
	const result = parseAuthConfig({ AUTH: 'OIDC', ...FULL_OIDC });
	expect(result.authMode).toStrictEqual('on');
	expect(result.deprecatedOidcMode).toStrictEqual(true);
});

// --- OIDC enablement ---

test('parseAuthConfig: no OIDC settings means SSO is off', () => {
	const result = parseAuthConfig({ AUTH: 'on' });
	expect(result.oidcEnabled).toStrictEqual(false);
	expect(result.oidc).toStrictEqual({ discoveryUrl: null, clientId: null, clientSecret: null });
});

test('parseAuthConfig: all three OIDC settings enable SSO under AUTH=on', () => {
	const result = parseAuthConfig({ AUTH: 'on', ...FULL_OIDC });
	expect(result.oidcEnabled).toStrictEqual(true);
	expect(result.oidc).toStrictEqual({
		discoveryUrl: FULL_OIDC.OIDC_DISCOVERY_URL,
		clientId: FULL_OIDC.OIDC_CLIENT_ID,
		clientSecret: FULL_OIDC.OIDC_CLIENT_SECRET
	});
});

test('parseAuthConfig: all three OIDC settings enable SSO when AUTH is unset', () => {
	expect(parseAuthConfig({ ...FULL_OIDC }).oidcEnabled).toStrictEqual(true);
});

test('parseAuthConfig: AUTH=oidc with all three settings enables SSO', () => {
	expect(parseAuthConfig({ AUTH: 'oidc', ...FULL_OIDC }).oidcEnabled).toStrictEqual(true);
});

test('parseAuthConfig: empty strings count as unset', () => {
	const result = parseAuthConfig({
		AUTH: 'on',
		OIDC_DISCOVERY_URL: '',
		OIDC_CLIENT_ID: '',
		OIDC_CLIENT_SECRET: ''
	});
	expect(result.oidcEnabled).toStrictEqual(false);
});

test('parseAuthConfig: AUTH=off ignores OIDC settings', () => {
	const result = parseAuthConfig({ AUTH: 'off', ...FULL_OIDC });
	expect(result.authMode).toStrictEqual('off');
	expect(result.oidcEnabled).toStrictEqual(false);
});

// --- Partial OIDC settings ---

const ALL_KEYS = ['OIDC_DISCOVERY_URL', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET'] as const;

// Every non-empty, non-full subset of the three settings
const PARTIAL_SUBSETS: (typeof ALL_KEYS)[number][][] = [
	['OIDC_DISCOVERY_URL'],
	['OIDC_CLIENT_ID'],
	['OIDC_CLIENT_SECRET'],
	['OIDC_DISCOVERY_URL', 'OIDC_CLIENT_ID'],
	['OIDC_DISCOVERY_URL', 'OIDC_CLIENT_SECRET'],
	['OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET']
];

for (const mode of ['on', 'oidc']) {
	for (const present of PARTIAL_SUBSETS) {
		const missing = ALL_KEYS.filter((k) => !present.includes(k));
		test(`parseAuthConfig: AUTH=${mode} with only ${present.join(' + ')} throws naming ${missing.join(', ')}`, () => {
			const env: Record<string, string> = { AUTH: mode };
			for (const key of present) env[key] = FULL_OIDC[key];

			expect(() => parseAuthConfig(env)).toThrow(Error);
			expect(() => parseAuthConfig(env)).toThrow(
				`OIDC is partially configured. Missing: ${missing.join(', ')}.`
			);
		});
	}
}

test('parseAuthConfig: AUTH=oidc with no OIDC settings throws naming all three', () => {
	// Treating this as plain AUTH=on would open first-run setup on instances
	// that relied on SSO and never had a password account.
	expect(() => parseAuthConfig({ AUTH: 'oidc' })).toThrow(Error);
	expect(() => parseAuthConfig({ AUTH: 'oidc' })).toThrow(
		'AUTH=oidc requires OIDC_DISCOVERY_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET.'
	);
});

test('parseAuthConfig: AUTH=off with partial OIDC settings does not throw', () => {
	const result = parseAuthConfig({ AUTH: 'off', OIDC_CLIENT_ID: 'profilarr' });
	expect(result.authMode).toStrictEqual('off');
	expect(result.oidcEnabled).toStrictEqual(false);
});
