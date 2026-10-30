/**
 * - Protects multi-origin OIDC with every real identity provider.
 * - Registers exact direct HTTP and proxied HTTPS callbacks with each provider.
 * - Each provider runs in a container, so these scenarios need the Docker socket.
 */
import { test, expect } from '#flows/helpers/core/test.ts';
import { signInWithSso } from '#flows/helpers/auth/accounts.ts';
import { PROVIDERS } from '#flows/helpers/sso/providers.ts';
import { skipWithoutDocker, tagsFor } from '#flows/helpers/core/realServices.ts';

for (const provider of PROVIDERS.filter((candidate) => candidate.needsDocker)) {
	test.describe(provider.label, { tag: tagsFor(provider) }, () => {
		test.use({
			appEnv: { AUTH: 'on' },
			appOrigins: 'direct-and-proxy',
			appProxy: { tls: true, publicHost: 'localhost' },
			ssoProvider: provider.id
		});
		skipWithoutDocker(provider);

		/**
		 * Flow:
		 * 1. One browser signs in through direct HTTP.
		 * 2. A second browser signs in through proxied HTTPS without restarting the app.
		 *
		 * Expects:
		 * - the provider accepts both exact registered callback URLs
		 * - each sign-in returns to the origin that started it
		 * - both browser sessions remain signed in
		 */
		test('signs in through both registered origins', async ({
			app,
			browser,
			page,
			reverseProxy,
			sso
		}) => {
			const directContext = await browser.newContext({ baseURL: app.url, ignoreHTTPSErrors: true });
			const directPage = await directContext.newPage();
			try {
				await signInWithSso(directPage, sso);
				await signInWithSso(page, sso);

				expect(new URL(directPage.url()).origin, 'Direct SSO should return to HTTP').toBe(app.url);
				expect(new URL(page.url()).origin, 'Proxied SSO should return to HTTPS').toBe(
					reverseProxy.url
				);
				expect(
					(await directContext.cookies(app.url)).some((cookie) => cookie.name === 'session'),
					'The direct browser should stay signed in'
				).toBe(true);
				expect(
					(await page.context().cookies(reverseProxy.url)).some(
						(cookie) => cookie.name === 'session'
					),
					'The proxied browser should stay signed in'
				).toBe(true);
			} finally {
				await directContext.close();
			}
		});
	});
}
