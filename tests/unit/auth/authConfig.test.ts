/**
 * Tests for parseAuthConfig: AUTH mode parsing, the deprecated `oidc` alias,
 * and OIDC enablement from the three OIDC_* settings.
 */

import { assertEquals, assertThrows } from '@std/assert';
import { parseAuthConfig } from '$utils/config/auth.ts';

const FULL_OIDC = {
	OIDC_DISCOVERY_URL: 'https://idp.example.com/.well-known/openid-configuration',
	OIDC_CLIENT_ID: 'profilarr',
	OIDC_CLIENT_SECRET: 'secret'
};

// --- AUTH mode ---

Deno.test('parseAuthConfig: AUTH unset defaults to on', () => {
	const result = parseAuthConfig({});
	assertEquals(result.authMode, 'on');
	assertEquals(result.deprecatedOidcMode, false);
});

Deno.test('parseAuthConfig: AUTH=on', () => {
	assertEquals(parseAuthConfig({ AUTH: 'on' }).authMode, 'on');
});

Deno.test('parseAuthConfig: AUTH=off', () => {
	assertEquals(parseAuthConfig({ AUTH: 'off' }).authMode, 'off');
});

Deno.test('parseAuthConfig: AUTH is case-insensitive', () => {
	assertEquals(parseAuthConfig({ AUTH: 'OFF' }).authMode, 'off');
	assertEquals(parseAuthConfig({ AUTH: 'On' }).authMode, 'on');
});

Deno.test('parseAuthConfig: unknown AUTH value falls back to on', () => {
	const result = parseAuthConfig({ AUTH: 'banana' });
	assertEquals(result.authMode, 'on');
	assertEquals(result.deprecatedOidcMode, false);
});

Deno.test('parseAuthConfig: AUTH=oidc is treated as on and flagged deprecated', () => {
	const result = parseAuthConfig({ AUTH: 'oidc', ...FULL_OIDC });
	assertEquals(result.authMode, 'on');
	assertEquals(result.deprecatedOidcMode, true);
});

Deno.test('parseAuthConfig: AUTH=OIDC is treated the same as AUTH=oidc', () => {
	const result = parseAuthConfig({ AUTH: 'OIDC', ...FULL_OIDC });
	assertEquals(result.authMode, 'on');
	assertEquals(result.deprecatedOidcMode, true);
});

// --- OIDC enablement ---

Deno.test('parseAuthConfig: no OIDC settings means SSO is off', () => {
	const result = parseAuthConfig({ AUTH: 'on' });
	assertEquals(result.oidcEnabled, false);
	assertEquals(result.oidc, { discoveryUrl: null, clientId: null, clientSecret: null });
});

Deno.test('parseAuthConfig: all three OIDC settings enable SSO under AUTH=on', () => {
	const result = parseAuthConfig({ AUTH: 'on', ...FULL_OIDC });
	assertEquals(result.oidcEnabled, true);
	assertEquals(result.oidc, {
		discoveryUrl: FULL_OIDC.OIDC_DISCOVERY_URL,
		clientId: FULL_OIDC.OIDC_CLIENT_ID,
		clientSecret: FULL_OIDC.OIDC_CLIENT_SECRET
	});
});

Deno.test('parseAuthConfig: all three OIDC settings enable SSO when AUTH is unset', () => {
	assertEquals(parseAuthConfig({ ...FULL_OIDC }).oidcEnabled, true);
});

Deno.test('parseAuthConfig: AUTH=oidc with all three settings enables SSO', () => {
	assertEquals(parseAuthConfig({ AUTH: 'oidc', ...FULL_OIDC }).oidcEnabled, true);
});

Deno.test('parseAuthConfig: empty strings count as unset', () => {
	const result = parseAuthConfig({
		AUTH: 'on',
		OIDC_DISCOVERY_URL: '',
		OIDC_CLIENT_ID: '',
		OIDC_CLIENT_SECRET: ''
	});
	assertEquals(result.oidcEnabled, false);
});

Deno.test('parseAuthConfig: AUTH=off ignores OIDC settings', () => {
	const result = parseAuthConfig({ AUTH: 'off', ...FULL_OIDC });
	assertEquals(result.authMode, 'off');
	assertEquals(result.oidcEnabled, false);
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
		Deno.test(
			`parseAuthConfig: AUTH=${mode} with only ${present.join(' + ')} throws naming ${missing.join(', ')}`,
			() => {
				const env: Record<string, string> = { AUTH: mode };
				for (const key of present) env[key] = FULL_OIDC[key];

				assertThrows(
					() => parseAuthConfig(env),
					Error,
					`OIDC is partially configured. Missing: ${missing.join(', ')}.`
				);
			}
		);
	}
}

Deno.test('parseAuthConfig: AUTH=oidc with no OIDC settings throws naming all three', () => {
	// Treating this as plain AUTH=on would open first-run setup on instances
	// that relied on SSO and never had a password account.
	assertThrows(
		() => parseAuthConfig({ AUTH: 'oidc' }),
		Error,
		'AUTH=oidc requires OIDC_DISCOVERY_URL, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET.'
	);
});

Deno.test('parseAuthConfig: AUTH=off with partial OIDC settings does not throw', () => {
	const result = parseAuthConfig({ AUTH: 'off', OIDC_CLIENT_ID: 'profilarr' });
	assertEquals(result.authMode, 'off');
	assertEquals(result.oidcEnabled, false);
});
