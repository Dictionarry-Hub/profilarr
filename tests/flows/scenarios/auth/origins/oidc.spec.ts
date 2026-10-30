/**
 * - Protects OIDC authorization and token exchange across multiple app origins.
 * - Requires the callback to stay on the origin that started the flow.
 * - Checks each origin's state, nonce and session cookies use the correct security flag.
 */
import { test, expect } from '#flows/helpers/core/test.ts';
import { signInWithSso } from '#flows/helpers/auth/accounts.ts';
import { openPage } from '#flows/helpers/core/nav.ts';

test.describe('OIDC on two origins', () => {
	test.use({
		appEnv: { AUTH: 'on' },
		appOrigins: 'direct-and-proxy',
		appProxy: { tls: true, publicHost: 'localhost' },
		ssoProvider: 'fake'
	});

	/**
	 * Flow:
	 * 1. One browser signs in with OIDC through direct HTTP.
	 * 2. A second browser signs in through proxied HTTPS without restarting the app.
	 * 3. The test reads the fake provider's authorization and token requests.
	 *
	 * Expects:
	 * - both exact callback URLs were registered and accepted
	 * - authorization and token exchange use the callback for the origin that started each flow
	 * - HTTP gets a non-Secure session and HTTPS gets a Secure session
	 */
	test('returns each sign-in to the origin that started it', async ({
		app,
		browser,
		context,
		page,
		reverseProxy,
		sso
	}) => {
		const directContext = await browser.newContext({ baseURL: app.url });
		const directPage = await directContext.newPage();
		try {
			await signInWithSso(directPage, sso);
			await signInWithSso(page, sso);

			expect(new URL(directPage.url()).origin, 'The direct sign-in should return to HTTP').toBe(
				app.url
			);
			expect(new URL(page.url()).origin, 'The proxied sign-in should return to HTTPS').toBe(
				reverseProxy.url
			);

			const directSession = (await directContext.cookies(app.url)).find(
				(cookie) => cookie.name === 'session'
			);
			const proxySession = (await context.cookies(reverseProxy.url)).find(
				(cookie) => cookie.name === 'session'
			);
			expect(directSession?.secure, 'The HTTP OIDC session should not be Secure').toBe(false);
			expect(proxySession?.secure, 'The HTTPS OIDC session should be Secure').toBe(true);

			const authorizeCallbacks = sso.requests
				.filter((request) => request.method === 'GET' && request.path === '/authorize')
				.map((request) => request.query.get('redirect_uri'));
			const tokenCallbacks = sso.requests
				.filter((request) => request.method === 'POST' && request.path === '/token')
				.map((request) => request.form.get('redirect_uri'));
			const callbacks = [`${app.url}/auth/oidc/callback`, `${reverseProxy.url}/auth/oidc/callback`];
			expect(authorizeCallbacks, 'Authorization should use each exact app callback').toEqual(
				callbacks
			);
			expect(tokenCallbacks, 'Token exchange should repeat each exact app callback').toEqual(
				callbacks
			);
		} finally {
			await directContext.close();
		}
	});
});

test.describe('OIDC origin binding', () => {
	test.use({
		appEnv: { AUTH: 'on' },
		appOrigins: 'direct-and-proxy',
		appProxy: { tls: true },
		ssoProvider: 'fake'
	});

	/**
	 * Flow:
	 * 1. The user starts OIDC through direct HTTP.
	 * 2. The authorization request is changed to return through HTTPS on the same hostname.
	 * 3. The provider authenticates the user and sends the callback to that other origin.
	 *
	 * Expects:
	 * - sharing the cookie hostname does not let the callback switch origins
	 * - Profilarr rejects the callback before exchanging the authorization code
	 */
	test('rejects a callback on a different origin with the same hostname', async ({
		app,
		browser,
		reverseProxy,
		sso
	}) => {
		const context = await browser.newContext({ baseURL: app.url, ignoreHTTPSErrors: true });
		const page = await context.newPage();
		try {
			await openPage(page, '/auth/login');
			await page.getByRole('main').getByRole('link', { name: 'Sign in with SSO' }).click();
			await expect(page, 'The app should send the browser to the provider').toHaveURL(
				(url) => url.origin === sso.url && url.pathname === '/authorize'
			);

			const changed = new URL(page.url());
			changed.searchParams.set('redirect_uri', `${reverseProxy.url}/auth/oidc/callback`);
			await page.goto(changed.href);
			const tokensBefore = sso.requests.filter((request) => request.path === '/token').length;
			const callback = page.waitForResponse(
				(response) =>
					new URL(response.url()).origin === reverseProxy.url &&
					new URL(response.url()).pathname === '/auth/oidc/callback'
			);
			await sso.signIn(page);
			const response = await callback;

			expect(response.status(), 'A callback that switched origins should be rejected').toBe(400);
			expect(
				sso.requests.filter((request) => request.path === '/token').length,
				'Profilarr should reject the origin before token exchange'
			).toBe(tokensBefore);
		} finally {
			await context.close();
		}
	});
});
