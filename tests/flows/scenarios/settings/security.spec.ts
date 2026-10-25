/**
 * - Protects: the account controls on Settings › Security. A password change
 *   leaves only the new password working, and other sessions must confirm
 *   their identity again before a sensitive action.
 * - Revoking a session, or every other session, signs those browsers out on
 *   their next page load.
 * - The integration tests localAccount.test.ts and
 *   apiKeyConfirmation.test.ts cover these against the server.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '$flows/helpers/core/test.ts';
import {
	FLOWS_USER,
	createAccount,
	signIn,
	signInElsewhere,
	signOut,
	type LocalUser
} from '$flows/helpers/auth/accounts.ts';
import { securityPages } from '$flows/helpers/auth/security.ts';
import { waitForAction } from '$flows/helpers/core/forms.ts';
import { openSidebarPage, waitForHydration } from '$flows/helpers/core/nav.ts';

test.use({ appEnv: { AUTH: 'on' } });

const NEW_PASSWORD = 'flows-password-2';
const WRONG_PASSWORD = 'Invalid username or password';

/** Load a page in `browser` and check it lands on the login page */
async function expectSignedOut(browser: Page, what: string): Promise<void> {
	await browser.goto('/settings/security');
	await expect(browser, `${what} should land on /auth/login`).toHaveURL(
		(url) => url.pathname === '/auth/login'
	);
}

/**
 * Flow:
 * 1. The user creates the account and signs in from a second browser.
 * 2. In the first, the user fills Current Password, New Password and Confirm
 *    New Password, and clicks Change Password.
 * 3. The user signs out, tries the old password, then the new one.
 *
 * Expects:
 * - the old password shows an error, and the new one signs in
 * - the second browser is still signed in, and must confirm its identity
 *   again
 */
test('Only the new password signs in after a change', async ({ page, browser, baseURL }) => {
	await createAccount(page);
	const other = await signInElsewhere(browser, baseURL ?? '');
	try {
		expect(
			(await securityPages.page(other)).confirmation,
			'control: the second browser should start confirmed'
		).toBe('none');

		await openSidebarPage(page, 'Security');
		const main = page.getByRole('main');
		await main.getByLabel(/^Current Password/).fill(FLOWS_USER.password);
		await main.getByLabel(/^New Password/).fill(NEW_PASSWORD);
		await main.getByLabel(/^Confirm New Password/).fill(NEW_PASSWORD);
		const changed = waitForAction(page, 'changePassword');
		await main.getByRole('button', { name: 'Change Password', exact: true }).click();
		const result = await changed;
		expect({ type: result.type, data: result.data }, 'Change Password should succeed').toEqual({
			type: 'success',
			data: { passwordSuccess: true }
		});

		const renewed: LocalUser = { ...FLOWS_USER, password: NEW_PASSWORD };
		await signOut(page);
		expect(
			await signIn(page, FLOWS_USER, { expectError: true }),
			'The old password should be refused'
		).toBe(WRONG_PASSWORD);
		await signIn(page, renewed);

		await other.goto('/settings/security');
		await waitForHydration(other);
		await expect(other, 'The second browser should still be signed in').toHaveURL(
			(url) => url.pathname === '/settings/security'
		);
		expect(
			(await securityPages.page(other)).confirmation,
			'The second browser should have to confirm its identity again'
		).toBe('password');
	} finally {
		await other.context().close();
	}
});

/**
 * Flow:
 * 1. The user signs in from a second browser.
 * 2. In the first, the user clicks Revoke session on the row that isn't
 *    current.
 * 3. The user signs in from a third browser, then clicks Revoke Others.
 *
 * Expects:
 * - after step 2, the sessions list goes from 2 rows to 1, and the second
 *   browser's next page load lands on the login page
 * - after step 3, only the current session is listed, and the third
 *   browser's next page load lands on the login page
 */
test('Revoking a session signs that browser out', async ({ page, browser, baseURL }) => {
	await createAccount(page);
	const second = await signInElsewhere(browser, baseURL ?? '');
	const third: Page[] = [];
	try {
		await openSidebarPage(page, 'Security');
		const main = page.getByRole('main');
		expect(
			await securityPages.sessions(page),
			'control: two sessions should be listed'
		).toHaveLength(2);

		const revoke = main.getByRole('button', { name: 'Revoke session', exact: true });
		await expect(revoke, 'Only the other session should offer Revoke session').toHaveCount(1);
		const revoked = waitForAction(page, 'revokeSession');
		await revoke.click();
		expect((await revoked).type, 'Revoking the session should succeed').toBe('success');

		await expect(revoke, 'The revoked session should leave the table').toHaveCount(0);
		const left = await securityPages.sessions(page);
		expect(
			left.map((session) => session.isCurrent),
			'Only the current session should be listed'
		).toEqual([true]);
		await expectSignedOut(second, "The second browser's next page load");

		third.push(await signInElsewhere(browser, baseURL ?? ''));
		await page.reload();
		await waitForHydration(page);
		await expect(revoke, 'The third browser should be listed').toHaveCount(1);
		const revokedOthers = waitForAction(page, 'revokeOtherSessions');
		await main.getByRole('button', { name: 'Revoke Others', exact: true }).click();
		expect((await revokedOthers).type, 'Revoke Others should succeed').toBe('success');

		await expect(revoke, 'Every other session should leave the table').toHaveCount(0);
		expect(
			(await securityPages.sessions(page)).map((session) => session.isCurrent),
			'Only the current session should be listed'
		).toEqual([true]);
		await expectSignedOut(third[0], "The third browser's next page load");
	} finally {
		await second.context().close();
		for (const browserPage of third) await browserPage.context().close();
	}
});
