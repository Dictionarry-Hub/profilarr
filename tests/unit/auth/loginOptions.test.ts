/**
 * Tests for the login decisions: which sign-in methods the login page offers,
 * and when the first-run setup page is shown.
 */

import { assertEquals } from '@std/assert';
import { getLoginOptions, getStartupAuthError, needsSetup } from '$auth/loginOptions.ts';

// --- getLoginOptions ---

Deno.test('getLoginOptions: password account, no SSO shows only the password form', () => {
	assertEquals(getLoginOptions({ oidcEnabled: false, hasLocalAccount: true }), {
		password: true,
		sso: false
	});
});

Deno.test('getLoginOptions: SSO, no password account shows only the SSO button', () => {
	assertEquals(getLoginOptions({ oidcEnabled: true, hasLocalAccount: false }), {
		password: false,
		sso: true
	});
});

Deno.test('getLoginOptions: SSO and a password account shows both', () => {
	assertEquals(getLoginOptions({ oidcEnabled: true, hasLocalAccount: true }), {
		password: true,
		sso: true
	});
});

Deno.test('getLoginOptions: neither shows nothing', () => {
	assertEquals(getLoginOptions({ oidcEnabled: false, hasLocalAccount: false }), {
		password: false,
		sso: false
	});
});

// --- needsSetup ---

const cases: {
	authMode: 'on' | 'off';
	oidcEnabled: boolean;
	hasLocalAccount: boolean;
	expected: boolean;
}[] = [
	// Only a fresh AUTH=on install without SSO opens first-run setup
	{ authMode: 'on', oidcEnabled: false, hasLocalAccount: false, expected: true },
	{ authMode: 'on', oidcEnabled: false, hasLocalAccount: true, expected: false },
	{ authMode: 'on', oidcEnabled: true, hasLocalAccount: false, expected: false },
	{ authMode: 'on', oidcEnabled: true, hasLocalAccount: true, expected: false },
	{ authMode: 'off', oidcEnabled: false, hasLocalAccount: false, expected: false },
	{ authMode: 'off', oidcEnabled: false, hasLocalAccount: true, expected: false },
	{ authMode: 'off', oidcEnabled: true, hasLocalAccount: false, expected: false },
	{ authMode: 'off', oidcEnabled: true, hasLocalAccount: true, expected: false }
];

for (const { authMode, oidcEnabled, hasLocalAccount, expected } of cases) {
	Deno.test(
		`needsSetup: AUTH=${authMode}, SSO ${oidcEnabled ? 'on' : 'off'}, ${hasLocalAccount ? 'has' : 'no'} password account -> ${expected}`,
		() => {
			assertEquals(needsSetup({ authMode, oidcEnabled, hasLocalAccount }), expected);
		}
	);
}

// --- getStartupAuthError ---

const LOCKED_OUT =
	"SSO accounts exist but the OIDC_* settings are missing, and there's no local password account.";

Deno.test(
	'getStartupAuthError: SSO accounts, SSO removed, no password account refuses startup',
	() => {
		const error = getStartupAuthError({
			authMode: 'on',
			oidcEnabled: false,
			hasLocalAccount: false,
			hasSsoAccounts: true
		});
		assertEquals(error?.startsWith(LOCKED_OUT), true, String(error));
	}
);

const startupOkCases: {
	name: string;
	authMode: 'on' | 'off';
	oidcEnabled: boolean;
	hasLocalAccount: boolean;
	hasSsoAccounts: boolean;
}[] = [
	{
		name: 'fresh install',
		authMode: 'on',
		oidcEnabled: false,
		hasLocalAccount: false,
		hasSsoAccounts: false
	},
	{
		name: 'SSO enabled',
		authMode: 'on',
		oidcEnabled: true,
		hasLocalAccount: false,
		hasSsoAccounts: true
	},
	{
		name: 'password account to fall back on',
		authMode: 'on',
		oidcEnabled: false,
		hasLocalAccount: true,
		hasSsoAccounts: true
	},
	{
		name: 'AUTH=off',
		authMode: 'off',
		oidcEnabled: false,
		hasLocalAccount: false,
		hasSsoAccounts: true
	}
];

for (const { name, ...opts } of startupOkCases) {
	Deno.test(`getStartupAuthError: ${name} starts normally`, () => {
		assertEquals(getStartupAuthError(opts), null);
	});
}
