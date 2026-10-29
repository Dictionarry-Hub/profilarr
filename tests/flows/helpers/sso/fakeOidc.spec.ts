/**
 * - Covers: the fake SSO provider in fakeOidc.ts.
 * - Every test signs in through the app's real SSO flow; the failure tests
 *   make the provider break one way each.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '#flows/helpers/core/test.ts';
import type { Misbehaviour } from './providers.ts';

test.use({ appEnv: { AUTH: 'on' }, ssoProvider: 'fake' });

/** Start an SSO sign-in from the login page */
async function startSsoSignIn(page: Page) {
	await page.goto('/auth/login');
	await page.getByRole('main').getByRole('link', { name: 'Sign in with SSO' }).click();
}

/**
 * Flow:
 * 1. The user starts SSO from the login page and signs in on the provider.
 *
 * Expects:
 * - the provider received the authorize, token and key set requests
 * - the user is signed in
 */
test('a sign-in goes through the whole flow', async ({ page, sso }) => {
	await startSsoSignIn(page);
	await sso.signIn(page);

	await expect(page).not.toHaveURL((url) => url.pathname.startsWith('/auth/'));
	const paths = sso.requests.map((request) => `${request.method} ${request.path}`);
	expect(paths).toEqual(
		expect.arrayContaining(['GET /authorize', 'POST /authorize', 'POST /token', 'GET /jwks'])
	);
});

/** Each way the provider can break, with the error the app shows */
const FAILURES: [Misbehaviour, string][] = [
	['refuse-login', 'access_denied'],
	['wrong-issuer', 'Failed to verify ID token'],
	['expired-token', 'Failed to verify ID token'],
	['wrong-nonce', 'Invalid nonce parameter']
];

for (const [kind, message] of FAILURES) {
	/**
	 * Flow:
	 * 1. The provider is told to misbehave one way.
	 * 2. The user starts SSO and signs in on the provider.
	 *
	 * Expects:
	 * - the app refuses the sign-in with the matching error
	 * - the user stays signed out
	 */
	test(`a sign-in fails when the provider sends ${kind}`, async ({ page, sso }) => {
		sso.misbehave(kind);
		await startSsoSignIn(page);
		await sso.signIn(page);

		await expect(page.getByText(message)).toBeVisible();
		await page.goto('/settings/security');
		await expect(page).toHaveURL((url) => url.pathname === '/auth/login');
	});
}
