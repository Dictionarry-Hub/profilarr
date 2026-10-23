/**
 * - Covers: createAccount, signIn, signInWithSso and signOut in accounts.ts.
 * - Every test runs an app with `AUTH=on`.
 */
import { test, expect } from '$flows/helpers/core/test.ts';
import {
	FLOWS_USER,
	createAccount,
	signIn,
	signInWithSso,
	signOut
} from '$flows/helpers/auth/accounts.ts';
import { securityPages } from '$flows/helpers/auth/security.ts';

test.describe('local accounts', () => {
	test.use({ appEnv: { AUTH: 'on' } });

	/**
	 * Flow:
	 * 1. The user creates the first account on the setup page.
	 *
	 * Expects:
	 * - the user is signed in, with one session listed on Settings › Security
	 */
	test('createAccount signs the new user in', async ({ page }) => {
		await createAccount(page);

		const sessions = await securityPages.sessions(page);
		expect(sessions).toHaveLength(1);
		expect(sessions[0].isCurrent).toBe(true);
	});

	/**
	 * Flow:
	 * 1. The user creates the account, then signs out.
	 * 2. The user signs in again.
	 *
	 * Expects:
	 * - signing out returns to the login page
	 * - signing in leaves it again
	 */
	test('signOut and signIn round trip', async ({ page }) => {
		await createAccount(page);
		await signOut(page);
		await signIn(page);

		await expect(page).not.toHaveURL((url) => url.pathname.startsWith('/auth/'));
	});

	/**
	 * Flow:
	 * 1. The user creates the account and signs out.
	 * 2. The user signs in with a wrong password.
	 *
	 * Expects:
	 * - signIn returns the login page's error
	 */
	test('signIn returns the error for a wrong password', async ({ page }) => {
		await createAccount(page);
		await signOut(page);

		const error = await signIn(
			page,
			{ ...FLOWS_USER, password: 'not-the-password' },
			{ expectError: true }
		);

		expect(error).toContain('Invalid username or password');
	});
});

test.describe('SSO accounts', () => {
	test.use({ appEnv: { AUTH: 'on' }, ssoProvider: 'fake' });

	/**
	 * Flow:
	 * 1. The user clicks Sign in with SSO and signs in on the fake provider.
	 *
	 * Expects:
	 * - the user is signed in with SSO
	 */
	test('signInWithSso signs the user in', async ({ page, sso }) => {
		await signInWithSso(page, sso);

		expect((await securityPages.page(page)).signedInWithSso).toBe(true);
	});
});
