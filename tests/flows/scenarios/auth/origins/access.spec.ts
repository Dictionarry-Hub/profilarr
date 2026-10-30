/**
 * - Protects direct HTTP access when no origin is configured.
 * - Preserves a single legacy ORIGIN even when a proxy rewrites Host.
 * - Proves one running app accepts direct HTTP and proxied HTTPS together.
 * - Checks form actions persist state and session cookies follow each origin's scheme.
 */
import { test, expect } from '#flows/helpers/core/test.ts';
import { createAccount, signIn } from '#flows/helpers/auth/accounts.ts';
import { saveForm, setSwitch } from '#flows/helpers/core/forms.ts';
import { openPage, waitForHydration } from '#flows/helpers/core/nav.ts';
import { generalSettings } from '#flows/helpers/settings/general.ts';

const SETTING = 'Block Referenced Deletes';

test.describe('direct HTTP without ORIGIN', () => {
	test.use({ appEnv: { AUTH: 'on' }, appOrigins: 'unset' });

	/**
	 * Flow:
	 * 1. The user opens Profilarr directly over HTTP with no ORIGIN configured.
	 * 2. They create the first account and change a stored setting.
	 * 3. They save and reload the page.
	 *
	 * Expects:
	 * - setup and the settings form both pass CSRF protection
	 * - the setting remains changed after reload
	 * - the direct HTTP session cookie is not Secure
	 */
	test('creates an account and saves through direct HTTP', async ({ app, context, page }) => {
		await createAccount(page);

		const session = (await context.cookies(app.url)).find((cookie) => cookie.name === 'session');
		expect(session, 'Setup should create a session cookie').toBeDefined();
		expect(session?.secure, 'A direct HTTP session cookie should not be Secure').toBe(false);

		await openPage(page, '/settings/general');
		const before = (await generalSettings(page)).generalSettings.fail_on_referenced_delete;
		await setSwitch(page.getByRole('main'), SETTING, !before);
		await saveForm(page, { action: 'save' });
		await page.reload();
		await waitForHydration(page);

		expect(
			(await generalSettings(page)).generalSettings.fail_on_referenced_delete,
			'The direct HTTP form should persist its change'
		).toBe(!before);
	});
});

test.describe('one legacy ORIGIN', () => {
	test.use({
		appEnv: { AUTH: 'on' },
		appProxy: {
			tls: true,
			publicHost: 'localhost',
			headers: { host: 'profilarr-internal:6868', 'x-forwarded-host': null }
		}
	});

	/**
	 * Flow:
	 * 1. An HTTPS proxy forwards to Profilarr and replaces Host with an internal name.
	 * 2. The deployment's existing single ORIGIN names the browser-facing address.
	 * 3. The user creates an account and saves a setting.
	 *
	 * Expects:
	 * - the existing fixed-origin behavior still allows both form submissions
	 * - the setting is stored
	 * - the HTTPS session cookie is Secure
	 */
	test('keeps fixed-origin proxy deployments working', async ({ baseURL, context, page }) => {
		await createAccount(page);

		const session = (await context.cookies(baseURL ?? '')).find(
			(cookie) => cookie.name === 'session'
		);
		expect(session, 'Setup should create a session cookie').toBeDefined();
		expect(session?.secure, 'An HTTPS session cookie should be Secure').toBe(true);

		await openPage(page, '/settings/general');
		const before = (await generalSettings(page)).generalSettings.fail_on_referenced_delete;
		await setSwitch(page.getByRole('main'), SETTING, !before);
		await saveForm(page, { action: 'save' });

		expect(
			(await generalSettings(page)).generalSettings.fail_on_referenced_delete,
			'The proxied form should persist its change'
		).toBe(!before);
	});
});

test.describe('multiple origins', () => {
	test.use({
		appEnv: { AUTH: 'on' },
		appOrigins: 'direct-and-proxy',
		appProxy: { tls: true, publicHost: 'localhost' }
	});

	/**
	 * Flow:
	 * 1. One browser creates the account through the app's direct HTTP address.
	 * 2. A second browser signs in through its proxied HTTPS address.
	 * 3. The direct browser changes a setting and the proxied browser reads it.
	 * 4. The proxied browser changes it back and the direct browser reloads.
	 *
	 * Expects:
	 * - both origins work without changing configuration or restarting the app
	 * - each origin can submit a form and read the other's stored result
	 * - HTTP and HTTPS use separate cookies with the correct Secure flag
	 */
	test('saves through direct HTTP and proxied HTTPS on one app', async ({
		app,
		browser,
		context,
		page,
		reverseProxy
	}) => {
		const directContext = await browser.newContext({ baseURL: app.url });
		const directPage = await directContext.newPage();
		try {
			await createAccount(directPage);
			await signIn(page);

			const directSession = (await directContext.cookies(app.url)).find(
				(cookie) => cookie.name === 'session'
			);
			const proxySession = (await context.cookies(reverseProxy.url)).find(
				(cookie) => cookie.name === 'session'
			);
			expect(directSession, 'Direct HTTP should have its own session').toBeDefined();
			expect(proxySession, 'Proxied HTTPS should have its own session').toBeDefined();
			expect(directSession?.secure, 'The HTTP cookie should not be Secure').toBe(false);
			expect(proxySession?.secure, 'The HTTPS cookie should be Secure').toBe(true);

			await openPage(directPage, '/settings/general');
			const original = (await generalSettings(directPage)).generalSettings
				.fail_on_referenced_delete;
			await setSwitch(directPage.getByRole('main'), SETTING, !original);
			await saveForm(directPage, { action: 'save' });

			await openPage(page, '/settings/general');
			expect(
				(await generalSettings(page)).generalSettings.fail_on_referenced_delete,
				'The HTTPS origin should read the change saved through HTTP'
			).toBe(!original);

			await setSwitch(page.getByRole('main'), SETTING, original);
			await saveForm(page, { action: 'save' });
			await directPage.reload();
			await waitForHydration(directPage);
			expect(
				(await generalSettings(directPage)).generalSettings.fail_on_referenced_delete,
				'The HTTP origin should read the change saved through HTTPS'
			).toBe(original);
		} finally {
			await directContext.close();
		}
	});
});
