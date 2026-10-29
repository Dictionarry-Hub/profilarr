/**
 * - Protects: Profilarr behind a reverse proxy that makes everyone sign in on
 *   Authelia first (forward auth), with Profilarr's own login off. This is
 *   the setup profilarr.com recommends for reaching Profilarr from outside.
 * - Every test runs behind each real proxy that supports forward auth.
 * - Authelia and the proxies run in containers, so these tests need the
 *   Docker socket.
 */
import { test, expect } from '#flows/helpers/core/test.ts';
import { ssoProvider } from '#flows/helpers/sso/providers.ts';
import { sidebar } from '#flows/helpers/core/nav.ts';
import { skipWithoutDocker, tagsFor } from '#flows/helpers/core/realServices.ts';
import { PROXIES } from '#flows/helpers/proxy/proxies.ts';

const AUTHELIA = ssoProvider('authelia');

test.use({ appEnv: { AUTH: 'off' }, ssoProvider: AUTHELIA.id });

for (const proxy of PROXIES.filter((candidate) => candidate.supports.includes('forwardAuth'))) {
	const services: { id: string; needsDocker: boolean }[] = [AUTHELIA, proxy];
	const tag = [...new Set(services.flatMap((service) => tagsFor(service)))];

	test.describe(proxy.label, { tag }, () => {
		test.use({ appProxy: { id: proxy.id, tls: true, forwardAuth: true } });
		for (const service of services) skipWithoutDocker(service);

		/**
		 * Flow:
		 * 1. The user opens the app's address.
		 * 2. The proxy sends them to Authelia, where they sign in.
		 *
		 * Expects:
		 * - the proxy sends the user to Authelia before the app opens
		 * - Authelia sends the user on to the app
		 * - the app opens without a login of its own, so there's no Log Out
		 */
		test('signs the user in before the app opens', async ({ page, sso, baseURL }) => {
			await page.goto('/');
			await expect(page, 'The proxy should send the user to Authelia first').toHaveURL(
				(url) => url.origin === sso.url
			);

			await sso.signIn(page);

			await expect(page, 'Authelia should send the user on to the app').toHaveURL(
				(url) => url.origin === new URL(baseURL ?? '').origin && !url.pathname.startsWith('/auth/')
			);
			await expect(sidebar(page), 'The app should open').toBeVisible();
			await expect(
				sidebar(page).getByRole('link', { name: 'Log Out', exact: true }),
				"With Profilarr's login off, there should be no Log Out"
			).toHaveCount(0);
		});

		/**
		 * Flow:
		 * 1. The user signs in on Authelia, and the app opens.
		 * 2. Authelia's session ends, as it does after 5 minutes without
		 *    activity by default.
		 * 3. The user clicks Databases in the sidebar.
		 * 4. The user signs in on Authelia again.
		 *
		 * Expects:
		 * - Authelia had a session to end
		 * - the click leads to Authelia's login page, not an error
		 * - after signing in, the user is on Databases
		 */
		test('sends the user back to Authelia once its session ends', async ({
			context,
			page,
			sso,
			baseURL
		}) => {
			await page.goto('/');
			await sso.signIn(page);
			await expect(sidebar(page), 'The app should open').toBeVisible();

			const autheliaSession = (await context.cookies()).some(
				(cookie) => cookie.name === 'authelia_session'
			);
			expect(autheliaSession, 'Authelia should have a session to end').toBe(true);
			await context.clearCookies({ name: 'authelia_session' });

			await sidebar(page).getByRole('link', { name: 'Databases', exact: true }).click();
			await expect(page, "The click should lead to Authelia's login page").toHaveURL(
				(url) => url.origin === sso.url
			);
			await sso.signIn(page);

			await expect(page, 'Authelia should send the user on to Databases').toHaveURL(
				(url) => url.origin === new URL(baseURL ?? '').origin && url.pathname === '/databases'
			);
		});
	});
}
