/**
 * - Covers: the `appEnv`, `ssoProvider` and `appProxy` options in test.ts.
 * - Each option changes how the test's app starts; these tests check the
 *   change reached the app.
 */
import { test, expect } from '$flows/helpers/core/test.ts';

test.describe('appEnv', () => {
	test.use({ appEnv: { AUTH: 'on' } });

	/**
	 * Flow:
	 * 1. The app starts with `AUTH=on` and no account.
	 * 2. The browser opens the home page.
	 *
	 * Expects:
	 * - the app sends the browser to first-run setup
	 */
	test('reaches the app', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveURL((url) => url.pathname === '/auth/setup');
	});
});

test.describe('ssoProvider', () => {
	test.use({ appEnv: { AUTH: 'on' }, ssoProvider: 'fake' });

	/**
	 * Flow:
	 * 1. The fake provider starts, then the app with its OIDC settings.
	 * 2. The user opens the login page and clicks Sign in with SSO.
	 *
	 * Expects:
	 * - the app sends the browser to the provider's login page
	 */
	test("gives the app the provider's settings", async ({ page, sso }) => {
		const provider = new URL(sso.env.OIDC_DISCOVERY_URL).origin;
		await page.goto('/auth/login');
		await page.getByRole('main').getByRole('link', { name: 'Sign in with SSO' }).click();

		await expect(page).toHaveURL((url) => url.origin === provider);
	});
});

test.describe('appProxy', () => {
	test.use({ appProxy: { tls: true } });

	/**
	 * Flow:
	 * 1. The fake proxy starts with HTTPS, then the app with the proxy as its
	 *    `ORIGIN`.
	 * 2. The browser opens the home page.
	 *
	 * Expects:
	 * - the browser talks to the proxy over HTTPS
	 * - the proxy forwarded the request to the app
	 */
	test('puts the proxy in front of the app', async ({ page, reverseProxy }) => {
		await page.goto('/');

		expect(new URL(page.url()).origin).toBe(reverseProxy.url);
		expect(reverseProxy.url).toMatch(/^https:/);
		expect(reverseProxy.requests.some((request) => request.status === 200)).toBe(true);
	});
});
