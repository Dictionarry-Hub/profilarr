/**
 * The `test` every scenario imports. It adds an `app` fixture, a fresh
 * Profilarr per test, and points `baseURL` at it so `page.goto('/databases')`
 * reaches that test's own app. `fakeRadarr` and `fakeSonarr` start a fake Arr
 * for the test, and `consumer` starts a second app that shares the first one's
 * upstream. Like every fixture, they only start when a test asks for them.
 */

import { test as base, expect } from '@playwright/test';
import { startApp, type App } from '$flows/harness/app.ts';
import { upstreamRepo } from '$flows/harness/seed.ts';
import { startFakeArr, type FakeArr } from '$flows/helpers/fakeArr.ts';

export const test = base.extend<{
	app: App;
	consumer: App;
	fakeRadarr: FakeArr;
	fakeSonarr: FakeArr;
}>({
	app: async ({}, use, testInfo) => {
		const app = await startApp();
		await use(app);
		if (testInfo.status !== testInfo.expectedStatus) {
			await testInfo.attach('app.log', { body: app.logs(), contentType: 'text/plain' });
		}
		await app.stop();
	},
	// A second install of the fixtures database that pulls from `app`'s
	// upstream, e.g. to check what `app` publishes. Pages reach it by its url.
	consumer: async ({ app }, use, testInfo) => {
		const consumer = await startApp(undefined, { upstream: upstreamRepo(app.dir) });
		await use(consumer);
		if (testInfo.status !== testInfo.expectedStatus) {
			await testInfo.attach('consumer.log', { body: consumer.logs(), contentType: 'text/plain' });
		}
		await consumer.stop();
	},
	baseURL: async ({ app }, use) => {
		await use(app.url);
	},
	// Alerts default to the top centre for 8 seconds, where they cover the tab
	// bar and delay clicks on it. Tests put them at the bottom right instead.
	page: async ({ page }, use) => {
		await page.addInitScript(() => {
			localStorage.setItem(
				'alertSettings',
				JSON.stringify({ position: 'bottom-right', durationMs: 8000 })
			);
		});
		await use(page);
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

/** The linked fixtures database's name, and the running app a test gets */
export { FIXTURES_NAME } from '$flows/harness/seed.ts';
export type { App };
