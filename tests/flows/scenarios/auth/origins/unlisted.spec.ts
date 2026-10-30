/**
 * - Serves an address that isn't in ORIGIN from the request itself, so health
 *   probes and API clients on internal names keep working.
 * - Keeps SvelteKit's CSRF check for a browser on such an address behind HTTPS.
 * - The selection rules themselves are unit tested in tests/unit/runtime/origins.test.ts.
 */
import { test, expect } from '#flows/helpers/core/test.ts';

test.describe('unlisted address', () => {
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
	 * 3. The browser reads the health endpoint and the setup page, then posts a form.
	 *
	 * Expects:
	 * - reads work, the app takes its address from the request as if ORIGIN were unset
	 * - the form is refused by the CSRF check, because that address is http://unknown.internal
	 *   while the browser's Origin is the HTTPS one
	 */
	test('serves reads and refuses forms on an unlisted address', async ({ page, baseURL }) => {
		const health = await page.goto('/api/v1/health');
		expect(health?.status(), 'The health endpoint should answer on an unlisted Host').toBe(200);

		const setup = await page.goto('/auth/setup');
		expect(setup?.status(), 'Pages should load on an unlisted Host').toBe(200);

		const response = await page.request.post('/auth/setup', {
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
				origin: baseURL ?? ''
			},
			data: 'username=admin&password=password123&confirmPassword=password123'
		});
		expect(response.status(), 'A form from the HTTPS origin should be refused').toBe(403);
		expect(await response.text(), 'The refusal should come from the CSRF check').toContain(
			'Cross-site POST form submissions are forbidden'
		);
	});
});
