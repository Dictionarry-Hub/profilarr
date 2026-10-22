/**
 * The `test` every scenario imports. It adds an `app` fixture, a fresh
 * Profilarr per test, and points `baseURL` at it so `page.goto('/databases')`
 * reaches that test's own app. `fakeRadarr` and `fakeSonarr` start a fake Arr
 * for the test; like every fixture, they only start when a test asks for them.
 */

import { test as base, expect } from '@playwright/test';
import { startApp, type App } from '$flows/helpers/app.ts';
import { startFakeArr, type FakeArr } from '$flows/helpers/fakeArr.ts';

export const test = base.extend<{ app: App; fakeRadarr: FakeArr; fakeSonarr: FakeArr }>({
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
	},
	fakeRadarr: async ({}, use) => {
		const fake = await startFakeArr('radarr');
		await use(fake);
		await fake.stop();
	},
	fakeSonarr: async ({}, use) => {
		const fake = await startFakeArr('sonarr');
		await use(fake);
		await fake.stop();
	}
});

export { expect };
