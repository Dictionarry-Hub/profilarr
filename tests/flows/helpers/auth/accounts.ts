/**
 * Local accounts and signing in, for apps started with `AUTH=on`
 * (`test.use({ appEnv: { AUTH: 'on' } })`).
 *
 * Accounts are made through the first-run setup form, the way a user makes
 * one. The harness can't write one into the database itself: password hashes
 * use the app's bcrypt library, which only runs in Deno.
 */

import { expect, test, type Page } from '@playwright/test';
import type { RunningSso, SsoUser } from '$flows/helpers/auth/sso/providers.ts';
import { openPage, sidebar, waitForHydration } from '$flows/helpers/core/nav.ts';

export interface LocalUser {
	username: string;
	password: string;
}

/** The account tests use unless they need another */
export const FLOWS_USER: LocalUser = { username: 'flows', password: 'flows-password-1' };

const signedIn = (url: URL) => !url.pathname.startsWith('/auth/');

/**
 * Make the first account through `/auth/setup`. The app signs the new user
 * in and leaves the setup page.
 */
export async function createAccount(page: Page, user: LocalUser = FLOWS_USER): Promise<void> {
	await test.step(
		`Create the account ${user.username}`,
		async () => {
			await openPage(page, '/auth/setup');
			const main = page.getByRole('main');
			await main.getByLabel(/^Username/).fill(user.username);
			await main.getByLabel(/^Password/).fill(user.password);
			await main.getByLabel(/^Confirm Password/).fill(user.password);
			await main.getByRole('button', { name: 'Create Account', exact: true }).click();
			await expect(page, 'Setup should sign the new user in').toHaveURL(signedIn);
		},
		{ box: true }
	);
}

export interface SignInOptions {
	/** The sign-in should fail; return the error the page shows instead */
	expectError?: boolean;
}

/**
 * Sign in on `/auth/login`. Waits until the user is signed in, or with
 * `expectError`, returns the error the login page shows.
 */
export async function signIn(
	page: Page,
	user: LocalUser = FLOWS_USER,
	options: SignInOptions = {}
): Promise<string | undefined> {
	return await test.step(
		`Sign in as ${user.username}${options.expectError ? ', expecting an error' : ''}`,
		async () => {
			await openPage(page, '/auth/login');
			const main = page.getByRole('main');
			await main.getByLabel(/^Username/).fill(user.username);
			await main.getByLabel(/^Password/).fill(user.password);
			await main.getByRole('button', { name: 'Sign In', exact: true }).click();

			if (options.expectError) {
				const error = page.getByRole('alert').last();
				await expect(error, 'The login page should show an error').toBeVisible();
				await expect(page, 'A failed sign-in should stay on the login page').toHaveURL(
					(url) => url.pathname === '/auth/login'
				);
				return (await error.textContent())?.trim();
			}
			await expect(page, 'Signing in should leave the login page').toHaveURL(signedIn);
			return undefined;
		},
		{ box: true }
	);
}

/** Sign in with the `sso` fixture's provider, from the login page's SSO button */
export async function signInWithSso(page: Page, sso: RunningSso, user?: SsoUser): Promise<void> {
	await test.step(
		`Sign in with ${sso.provider.label}`,
		async () => {
			await openPage(page, '/auth/login');
			await page.getByRole('main').getByRole('link', { name: 'Sign in with SSO' }).click();
			await sso.signIn(page, user);
			await expect(page, 'SSO should leave the user signed in').toHaveURL(signedIn);
			await waitForHydration(page);
		},
		{ box: true }
	);
}

/** Sign out with the sidebar's Log Out link, which returns to the login page */
export async function signOut(page: Page): Promise<void> {
	await test.step(
		'Sign out',
		async () => {
			// The sidebar only shows outside the auth pages
			if (new URL(page.url()).pathname.startsWith('/auth/')) await openPage(page, '/');
			else await waitForHydration(page);
			const logOut = sidebar(page).getByRole('link', { name: 'Log Out', exact: true });
			await expect(logOut, 'The sidebar should offer Log Out').toBeVisible();
			await logOut.click();
			await expect(page, 'Logging out should return to the login page').toHaveURL(
				(url) => url.pathname === '/auth/login'
			);
			await waitForHydration(page);
		},
		{ box: true }
	);
}
