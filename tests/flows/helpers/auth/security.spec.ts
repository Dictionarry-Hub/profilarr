/**
 * - Covers: confirmIdentity, createApiKey and the securityPages readers in
 *   security.ts.
 * - Creating an API key asks the user to confirm who they are first.
 */
import { test, expect } from '$flows/helpers/core/test.ts';
import { FLOWS_USER, createAccount, signInWithSso } from '$flows/helpers/auth/accounts.ts';
import {
	confirmIdentity,
	createApiKey,
	lapseConfirmation,
	securityPages
} from '$flows/helpers/auth/security.ts';

test.describe('password accounts', () => {
	test.use({ appEnv: { AUTH: 'on' } });

	/**
	 * Flow:
	 * 1. The user creates an account, and its confirmation lapses.
	 * 2. The user opens the new API key page and confirms with their password.
	 *
	 * Expects:
	 * - the page asked for a password before
	 * - the dialog closes, and no confirmation is needed after
	 */
	test('confirmIdentity with a password', async ({ app, page }) => {
		await createAccount(page);
		lapseConfirmation(app);
		expect((await securityPages.page(page)).confirmation).toBe('password');

		await page.goto('/settings/security/api-keys/new');
		await confirmIdentity(page, { password: FLOWS_USER.password });

		expect((await securityPages.page(page)).confirmation).toBe('none');
	});

	/**
	 * Flow:
	 * 1. The user creates an account.
	 *
	 * Expects:
	 * - the readers list one session and no API keys
	 */
	test('the readers list sessions and API keys', async ({ page }) => {
		await createAccount(page);

		expect(await securityPages.sessions(page)).toHaveLength(1);
		expect(await securityPages.apiKeys(page)).toEqual([]);
	});

	/**
	 * Flow:
	 * 1. The user creates an account, which counts as confirming who they are.
	 * 2. The user clicks New Key on Settings › Security and creates a key.
	 *
	 * Expects:
	 * - New Key opens the form without asking to confirm
	 * - the key is listed on Settings › Security
	 */
	test('createApiKey creates a key', async ({ page }) => {
		await createAccount(page);
		await createApiKey(page, 'flows key');

		const keys = await securityPages.apiKeys(page);
		expect(keys.map((key) => key.name)).toEqual(['flows key']);
	});

	/**
	 * Flow:
	 * 1. The user creates an account, and its confirmation lapses.
	 * 2. The user clicks New Key, confirms with their password, and creates a
	 *    key.
	 *
	 * Expects:
	 * - New Key asks for the password on Settings › Security first
	 * - the key is listed on Settings › Security
	 */
	test('createApiKey confirms first when asked', async ({ app, page }) => {
		await createAccount(page);
		lapseConfirmation(app);
		await createApiKey(page, 'flows key', { password: FLOWS_USER.password });

		const keys = await securityPages.apiKeys(page);
		expect(keys.map((key) => key.name)).toEqual(['flows key']);
	});
});

test.describe('SSO accounts', () => {
	test.use({ appEnv: { AUTH: 'on' }, ssoProvider: 'fake' });

	/**
	 * Flow:
	 * 1. The user signs in with SSO, and its confirmation lapses.
	 * 2. The user opens the new API key page and confirms by signing in again
	 *    on the provider.
	 *
	 * Expects:
	 * - the provider was asked to show its login again (`prompt=login`)
	 * - no confirmation is needed after
	 */
	test('confirmIdentity through SSO', async ({ app, page, sso }) => {
		await signInWithSso(page, sso);
		lapseConfirmation(app);
		await page.goto('/settings/security/api-keys/new');
		await confirmIdentity(page, { sso });

		const reauth = sso.requests.filter((request) => request.query.get('prompt') === 'login');
		expect(reauth.length).toBeGreaterThan(0);
		expect((await securityPages.page(page)).confirmation).toBe('none');
	});
});
