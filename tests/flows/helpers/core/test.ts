/**
 * The `test` every scenario imports. It adds an `app` fixture, a fresh
 * Profilarr per test, and points `baseURL` at it so `page.goto('/databases')`
 * reaches that test's own app. `startArr` starts a fake for any target in
 * helpers/sync/targets.ts, such as "sonarr-5"; `fakeRadarr` and `fakeSonarr`
 * start each app's default target. `consumer` starts a second app that shares
 * the first one's upstream. Like every fixture, they only start when a test
 * asks for them.
 */

import { test as base, expect } from '@playwright/test';
import { startApp, type App } from '$flows/harness/app.ts';
import { upstreamRepo } from '$flows/harness/seed.ts';
import { startFakeArr, type FakeArr } from '$flows/helpers/sync/fakeArr.ts';
import { defaultTarget } from '$flows/helpers/sync/targets.ts';

export const test = base.extend<{
	app: App;
	consumer: App;
	/** Start a fake for a target id; every fake it started stops after the test */
	startArr: (targetId: string) => Promise<FakeArr>;
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
	startArr: async ({}, use) => {
		const started: FakeArr[] = [];
		await use(async (targetId) => {
			const fake = await startFakeArr(targetId);
			started.push(fake);
			return fake;
		});
		await Promise.all(started.map((fake) => fake.stop()));
	},
	fakeRadarr: async ({ startArr }, use) => {
		await use(await startArr(defaultTarget('radarr').id));
	},
	fakeSonarr: async ({ startArr }, use) => {
		await use(await startArr(defaultTarget('sonarr').id));
	}
});

export { expect };

/** The linked fixtures database's name, and the running app a test gets */
export { FIXTURES_NAME } from '$flows/harness/seed.ts';
export type { App };
