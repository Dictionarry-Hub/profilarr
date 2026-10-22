/**
 * The `test` every scenario imports. It adds an `app` fixture, a fresh
 * Profilarr per test, and points `baseURL` at it so `page.goto('/databases')`
 * reaches that test's own app.
 */

import { test as base, expect } from '@playwright/test';
import { startApp, type App } from '$flows/helpers/app.ts';

export const test = base.extend<{ app: App }>({
	app: async ({}, use, testInfo) => {
		const app = await startApp();
		await use(app);
		if (testInfo.status !== testInfo.expectedStatus) {
			await testInfo.attach('app.log', { body: app.logs(), contentType: 'text/plain' });
		}
		await app.stop();
	},
	baseURL: async ({ app }, use) => {
		await use(app.url);
	}
});

export { expect };
