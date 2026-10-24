/**
 * - Protects: signing in with Authelia, a real SSO provider, and confirming
 *   identity through it before creating an API key.
 * - Every test runs once with no proxy and once behind each real reverse
 *   proxy (`proxySetups()`), the ways users reach the app.
 * - Authelia and the proxies run in containers, so these tests need the
 *   Docker socket.
 */
import { test, expect } from '$flows/helpers/core/test.ts';
import { signInWithSso, signOut } from '$flows/helpers/auth/accounts.ts';
import { createApiKey, lapseConfirmation, securityPages } from '$flows/helpers/auth/security.ts';
import { ssoProvider } from '$flows/helpers/auth/sso/providers.ts';
import { skipWithoutDocker, tagsFor } from '$flows/helpers/core/realServices.ts';
import { proxySetups } from '$flows/helpers/proxy/proxies.ts';

const AUTHELIA = ssoProvider('authelia');

test.use({ appEnv: { AUTH: 'on' }, ssoProvider: AUTHELIA.id });

for (const setup of proxySetups()) {
	const services: { id: string; needsDocker: boolean }[] = setup.proxy
		? [AUTHELIA, setup.proxy]
		: [AUTHELIA];
	const tag = [...new Set(services.flatMap((service) => tagsFor(service)))];

	test.describe(setup.label, { tag }, () => {
		test.use({ appProxy: setup.appProxy });
		for (const service of services) skipWithoutDocker(service);

		/**
		 * Flow:
		 * 1. The user opens the app, which has SSO set up and no account yet.
		 * 2. The user clicks Sign in with SSO and signs in on Authelia.
		 *
		 * Expects:
		 * - the app sends the user to the login page, not to first-run setup
		 * - the login page offers SSO and no password form
		 * - Authelia sends the user back to the app's own address
		 * - the user is signed in with SSO, with one session
		 */
		test('signs the user in', async ({ page, sso, baseURL }) => {
			await page.goto('/');
			await expect(page, 'With SSO set up, a new install should skip setup').toHaveURL(
				(url) => url.pathname === '/auth/login'
			);
			const main = page.getByRole('main');
			await expect(
				main.getByRole('link', { name: 'Sign in with SSO' }),
				'The login page should offer SSO'
			).toBeVisible();
			await expect(
				main.getByLabel(/^Password/),
				'Without a password account, there should be no password form'
			).toHaveCount(0);

			await signInWithSso(page, sso);

			expect(new URL(page.url()).origin, 'Authelia should send the user back to the app').toBe(
				new URL(baseURL ?? '').origin
			);
			const security = await securityPages.page(page);
			expect(security.signedInWithSso, 'The session should be an SSO one').toBe(true);
			expect(
				security.sessions.map((session) => session.isCurrent),
				'There should be one session, the current one'
			).toEqual([true]);
		});

		/**
		 * Flow:
		 * 1. The user signs in with SSO, then signs out of the app.
		 * 2. The user clicks Sign in with SSO again. Authelia still has its own
		 *    session, so it sends the user straight back without its login page.
		 *
		 * Expects:
		 * - Authelia sends the user straight back to the app, signed in
		 * - the app has one session, a new one, because signing out ended the first
		 */
		test('signs back in after signing out', async ({ page, sso, baseURL }) => {
			await signInWithSso(page, sso);
			const [first] = await securityPages.sessions(page);
			await signOut(page);

			await page.getByRole('main').getByRole('link', { name: 'Sign in with SSO' }).click();
			const appOrigin = new URL(baseURL ?? '').origin;
			await expect(page, 'Authelia should send the user straight back, signed in').toHaveURL(
				(url) => url.origin === appOrigin && !url.pathname.startsWith('/auth/')
			);

			const sessions = await securityPages.sessions(page);
			expect(
				sessions.map((session) => session.isCurrent),
				'There should be one session, the current one'
			).toEqual([true]);
			expect(sessions[0].handle, 'Signing out should have ended the first session').not.toBe(
				first.handle
			);
		});

		/**
		 * Flow:
		 * 1. The user signs in with SSO, and the app's confirmation lapses.
		 * 2. The user opens Settings › Security from the sidebar and clicks
		 *    New Key.
		 * 3. The user confirms with SSO. The app asks Authelia to authenticate
		 *    the user again (`prompt=login`), so Authelia asks for the password
		 *    before it sends the user back.
		 * 4. The user creates an API key.
		 *
		 * Expects:
		 * - the app asks for SSO confirmation before the key
		 * - New Key opens the confirm dialog on the Security page
		 * - confirming moves on to the new API key page
		 * - the key is listed, and the session is the same one as before
		 */
		test('confirms through SSO before creating an API key', async ({ app, page, sso }) => {
			await signInWithSso(page, sso);
			const before = await securityPages.sessions(page);
			lapseConfirmation(app);
			expect(
				(await securityPages.page(page)).confirmation,
				'The app should ask for SSO confirmation'
			).toBe('sso');

			await createApiKey(page, 'authelia key', { sso });

			const security = await securityPages.page(page);
			expect(
				security.apiKeys.map((key) => key.name),
				'The new key should be listed'
			).toEqual(['authelia key']);
			expect(
				security.sessions.map((session) => session.handle),
				'Confirming should keep the same session'
			).toEqual(before.map((session) => session.handle));
		});

		/**
		 * Flow:
		 * 1. The user signs in with SSO, and the app's confirmation lapses.
		 * 2. Authelia's own session ends too, as it does after 5 minutes
		 *    without activity by default.
		 * 3. The user opens Settings › Security from the sidebar and clicks
		 *    New Key.
		 * 4. The user confirms with SSO. Authelia no longer knows the user, so
		 *    it shows its login page for the username and password, then asks
		 *    the user to accept Profilarr's request.
		 * 5. The user creates an API key.
		 *
		 * Expects:
		 * - Authelia had a session to end
		 * - the key is listed, and the session is the same one as before
		 */
		test('confirms through SSO after the Authelia session ends', async ({
			app,
			context,
			page,
			sso
		}) => {
			await signInWithSso(page, sso);
			const before = await securityPages.sessions(page);
			lapseConfirmation(app);
			const autheliaSession = (await context.cookies()).some(
				(cookie) => cookie.name === 'authelia_session'
			);
			expect(autheliaSession, 'Authelia should have a session to end').toBe(true);
			await context.clearCookies({ name: 'authelia_session' });

			await createApiKey(page, 'authelia key', { sso });

			const security = await securityPages.page(page);
			expect(
				security.apiKeys.map((key) => key.name),
				'The new key should be listed'
			).toEqual(['authelia key']);
			expect(
				security.sessions.map((session) => session.handle),
				'Confirming should keep the same session'
			).toEqual(before.map((session) => session.handle));
		});
	});
}
