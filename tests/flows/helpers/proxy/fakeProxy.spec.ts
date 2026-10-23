/**
 * - Covers: the fake reverse proxy's options in fakeProxy.ts.
 * - The app runs behind the proxy, with the proxy as its `ORIGIN`.
 */
import { test, expect } from '$flows/helpers/core/test.ts';
import { createAccount } from '$flows/helpers/auth/accounts.ts';

test.describe('tls', () => {
	test.use({ appEnv: { AUTH: 'on' }, appProxy: { tls: true } });

	/**
	 * Flow:
	 * 1. The user creates an account through the HTTPS proxy.
	 *
	 * Expects:
	 * - the session cookie is marked secure, because ORIGIN is https
	 */
	test('gives the app an https origin', async ({ page, context }) => {
		await createAccount(page);

		const session = (await context.cookies()).find((cookie) => cookie.name === 'session');
		expect(session?.secure).toBe(true);
	});
});

test.describe('headers', () => {
	test.use({ appProxy: { headers: { 'X-Forwarded-For': '203.0.113.7', 'X-Flows': 'set' } } });

	/**
	 * Flow:
	 * 1. The browser opens the home page through the proxy.
	 *
	 * Expects:
	 * - the app received the headers the proxy set
	 */
	test('sets request headers', async ({ page, reverseProxy }) => {
		await page.goto('/');

		expect(reverseProxy.requests[0].headers).toMatchObject({
			'x-forwarded-for': '203.0.113.7',
			'x-flows': 'set'
		});
	});
});

test.describe('maxResponseHeaderBytes', () => {
	test.use({ appProxy: { maxResponseHeaderBytes: 64 } });

	/**
	 * Flow:
	 * 1. The browser opens the home page through a proxy that allows only
	 *    64 bytes of response headers.
	 *
	 * Expects:
	 * - the proxy answers 502
	 */
	test('answers 502 for oversized response headers', async ({ page }) => {
		const response = await page.goto('/');

		expect(response?.status()).toBe(502);
	});
});

test.describe('fail', () => {
	test.use({ appProxy: {} });

	/**
	 * Flow:
	 * 1. The proxy is told to fail.
	 * 2. The browser opens the home page.
	 *
	 * Expects:
	 * - the browser gets the failure status
	 */
	test('answers with the given status', async ({ page, reverseProxy }) => {
		reverseProxy.fail(503);
		const response = await page.goto('/');

		expect(response?.status()).toBe(503);
	});
});
