/**
 * The `test` every scenario imports. It adds an `app` fixture, a fresh
 * Profilarr per test, and points `baseURL` at it so `page.goto('/databases')`
 * reaches that test's own app. `startArr` starts a fake for any target in
 * helpers/sync/targets.ts, such as "sonarr-5"; `fakeRadarr` and `fakeSonarr`
 * start each app's default target. `consumer` starts a second app that shares
 * the first one's upstream. Like every fixture, they only start when a test
 * asks for them.
 *
 * Options a spec sets with `test.use()`:
 * - `appEnv`: environment applied over the defaults, e.g. `{ AUTH: 'on' }`
 * - `ssoProvider`: an SSO provider id (helpers/auth/sso/providers.ts). The
 *   provider starts first, and its OIDC settings go into the app's env. The
 *   test reaches it as the `sso` fixture.
 * - `appProxy`: a reverse proxy in front of the app (helpers/proxy/proxies.ts).
 *   The app's `ORIGIN` and `baseURL` become the proxy's address. The test
 *   reaches it as the `reverseProxy` fixture.
 *
 * Once the app is up, the provider and the proxy get its address (`target`).
 * A failed test gets their logs attached. `appEnv` applies last, so a test
 * can override what the others set.
 */

import { test as base, expect, type TestInfo } from '@playwright/test';
import { startApp, type App } from '$flows/harness/app.ts';
import { upstreamRepo } from '$flows/harness/seed.ts';
import {
	ssoProvider as findSsoProvider,
	type RunningSso
} from '$flows/helpers/auth/sso/providers.ts';
import {
	reverseProxy as findReverseProxy,
	type ProxyOptions,
	type RunningProxy
} from '$flows/helpers/proxy/proxies.ts';
import { startFakeArr, type FakeArr } from '$flows/helpers/sync/fakeArr.ts';
import { defaultTarget } from '$flows/helpers/sync/targets.ts';

/** Attach a service's logs to a test that didn't end as expected */
async function attachServiceLogs(
	testInfo: TestInfo,
	name: string,
	logs: (() => Promise<string>) | undefined
): Promise<void> {
	if (!logs || testInfo.status === testInfo.expectedStatus) return;
	try {
		await testInfo.attach(`${name}.log`, { body: await logs(), contentType: 'text/plain' });
	} catch (error) {
		await testInfo.attach(`${name}.log`, { body: `No logs: ${error}`, contentType: 'text/plain' });
	}
}

export const test = base.extend<{
	appEnv: Record<string, string>;
	ssoProvider: string | undefined;
	appProxy: ProxyOptions | undefined;
	/** The running provider when `ssoProvider` is set, else null */
	ssoServer: RunningSso | null;
	/** The running proxy when `appProxy` is set, else null */
	proxyServer: RunningProxy | null;
	/** The running SSO provider; needs `ssoProvider` */
	sso: RunningSso;
	/** The running reverse proxy; needs `appProxy` */
	reverseProxy: RunningProxy;
	app: App;
	consumer: App;
	/** Start a fake for a target id; every fake it started stops after the test */
	startArr: (targetId: string) => Promise<FakeArr>;
	fakeRadarr: FakeArr;
	fakeSonarr: FakeArr;
}>({
	appEnv: [{}, { option: true }],
	ssoProvider: [undefined, { option: true }],
	appProxy: [undefined, { option: true }],
	ssoServer: async ({ ssoProvider }, use, testInfo) => {
		if (!ssoProvider) return await use(null);
		const running = await findSsoProvider(ssoProvider).start();
		await use(running);
		await attachServiceLogs(testInfo, running.provider.id, running.logs);
		await running.stop();
	},
	proxyServer: async ({ appProxy }, use, testInfo) => {
		if (!appProxy) return await use(null);
		const running = await findReverseProxy(appProxy.id ?? 'fake').start(appProxy);
		await use(running);
		await attachServiceLogs(testInfo, running.proxy.id, running.logs);
		await running.stop();
	},
	sso: async ({ ssoServer }, use) => {
		if (!ssoServer) throw new Error("The sso fixture needs test.use({ ssoProvider: '<id>' })");
		await use(ssoServer);
	},
	reverseProxy: async ({ proxyServer }, use) => {
		if (!proxyServer)
			throw new Error('The reverseProxy fixture needs test.use({ appProxy: { ... } })');
		await use(proxyServer);
	},
	// Order: the provider and proxy have their addresses, so the app starts
	// with them. The provider then accepts sign-ins for the app's origin, and
	// the proxy forwards to the app.
	app: async ({ appEnv, ssoServer, proxyServer }, use, testInfo) => {
		const env = {
			...(ssoServer?.env ?? {}),
			...(proxyServer ? { ORIGIN: proxyServer.url } : {}),
			...appEnv
		};
		const app = await startApp(undefined, { env });
		try {
			await Promise.all([
				ssoServer?.target(proxyServer?.url ?? app.url),
				proxyServer?.target(app.url)
			]);
		} catch (error) {
			await app.stop();
			throw error;
		}
		await use(app);
		if (testInfo.status !== testInfo.expectedStatus) {
			await testInfo.attach('app.log', { body: app.logs(), contentType: 'text/plain' });
		}
		await app.stop();
	},
	// A second install of the fixtures database that pulls from `app`'s
	// upstream, e.g. to check what `app` publishes. Pages reach it by its url.
	consumer: async ({ app, appEnv, ssoServer }, use, testInfo) => {
		const env = { ...(ssoServer?.env ?? {}), ...appEnv };
		const consumer = await startApp(undefined, { upstream: upstreamRepo(app.dir), env });
		await use(consumer);
		if (testInfo.status !== testInfo.expectedStatus) {
			await testInfo.attach('consumer.log', { body: consumer.logs(), contentType: 'text/plain' });
		}
		await consumer.stop();
	},
	baseURL: async ({ app, proxyServer }, use) => {
		await use(proxyServer?.url ?? app.url);
	},
	// The run's certificate, which HTTPS proxies and providers serve, is self-signed
	ignoreHTTPSErrors: async ({ appProxy, ssoProvider }, use) => {
		const providerTls = ssoProvider !== undefined && findSsoProvider(ssoProvider).tls;
		await use(appProxy?.tls === true || providerTls);
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
