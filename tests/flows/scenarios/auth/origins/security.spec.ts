/**
 * - Requires an exact configured origin before SvelteKit handles a request.
 * - The selection rules themselves are unit tested in tests/unit/runtime/origins.test.ts.
 */
import { test, expect } from '#flows/helpers/core/test.ts';

test.describe('unknown external address', () => {
	test.use({
		appOrigins: 'direct-and-proxy',
		appProxy: {
			tls: true,
			publicHost: 'localhost',
			headers: { host: 'unknown.internal', 'x-forwarded-host': null }
		}
	});

	/**
	 * Flow:
	 * 1. The browser uses a configured HTTPS origin.
	 * 2. Its proxy discards that external host and sends an unknown internal Host.
	 * 3. The browser requests the health endpoint through the proxy.
	 *
	 * Expects:
	 * - Profilarr rejects the request instead of guessing an origin
	 * - the request never reaches the health route
	 */
	test('rejects a request whose external host was lost', async ({ page }) => {
		const response = await page.goto('/api/v1/health');
		expect(response?.status(), 'An unknown Host should be rejected before routing').toBe(400);
		expect(await response?.text(), 'The rejection should be a bad request').toContain(
			'Bad Request'
		);
	});
});
