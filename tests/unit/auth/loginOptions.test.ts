/**
 * Tests for the login decisions: which sign-in methods the login page offers,
 * and when the first-run setup page is shown.
 */

import { expect, test } from 'vitest';
import { getLoginOptions, getStartupAuthError, needsSetup } from '#utils/auth/loginOptions.ts';

// --- getLoginOptions ---

test('getLoginOptions: password account, no SSO shows only the password form', () => {
	expect(getLoginOptions({ oidcEnabled: false, hasLocalAccount: true })).toStrictEqual({
		password: true,
		sso: false
	});
});

test('getLoginOptions: SSO, no password account shows only the SSO button', () => {
	expect(getLoginOptions({ oidcEnabled: true, hasLocalAccount: false })).toStrictEqual({
		password: false,
		sso: true
	});
});

test('getLoginOptions: SSO and a password account shows both', () => {
	expect(getLoginOptions({ oidcEnabled: true, hasLocalAccount: true })).toStrictEqual({
		password: true,
		sso: true
	});
});

test('getLoginOptions: neither shows nothing', () => {
	expect(getLoginOptions({ oidcEnabled: false, hasLocalAccount: false })).toStrictEqual({
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
	test(`needsSetup: AUTH=${authMode}, SSO ${oidcEnabled ? 'on' : 'off'}, ${hasLocalAccount ? 'has' : 'no'} password account -> ${expected}`, () => {
		expect(needsSetup({ authMode, oidcEnabled, hasLocalAccount })).toStrictEqual(expected);
	});
}

// --- getStartupAuthError ---

const LOCKED_OUT =
	"SSO accounts exist but the OIDC_* settings are missing, and there's no local password account.";

test('getStartupAuthError: SSO accounts, SSO removed, no password account refuses startup', () => {
	const error = getStartupAuthError({
		authMode: 'on',
		oidcEnabled: false,
		hasLocalAccount: false,
		hasSsoAccounts: true
	});
	expect(error?.startsWith(LOCKED_OUT), String(error)).toStrictEqual(true);
});

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
	test(`getStartupAuthError: ${name} starts normally`, () => {
		expect(getStartupAuthError(opts)).toStrictEqual(null);
	});
}
