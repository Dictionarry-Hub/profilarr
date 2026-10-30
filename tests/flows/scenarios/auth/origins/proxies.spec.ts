/**
 * - Protects multiple-origin form submissions through every real reverse proxy.
 * - Runs one direct HTTP and one proxied HTTPS browser against the same app.
 * - Each proxy runs in a container, so these scenarios need the Docker socket.
 */
import { test, expect } from '#flows/helpers/core/test.ts';
import { createAccount, signIn } from '#flows/helpers/auth/accounts.ts';
import { saveForm, setSwitch } from '#flows/helpers/core/forms.ts';
import { openPage } from '#flows/helpers/core/nav.ts';
import { generalSettings } from '#flows/helpers/settings/general.ts';
import { PROXIES } from '#flows/helpers/proxy/proxies.ts';
import { skipWithoutDocker, tagsFor } from '#flows/helpers/core/realServices.ts';

for (const proxy of PROXIES.filter((candidate) => candidate.needsDocker)) {
	test.describe(proxy.label, { tag: tagsFor(proxy) }, () => {
		test.use({
			appEnv: { AUTH: 'on' },
			appOrigins: 'direct-and-proxy',
			appProxy: { id: proxy.id, tls: true, publicHost: 'profilarr.test' }
		});
		skipWithoutDocker(proxy);

		/**
		 * Flow:
		 * 1. The user creates an account through direct HTTP.
		 * 2. A second browser signs in through this proxy over HTTPS.
		 * 3. The proxied browser saves a setting and the direct browser reads it.
		 *
		 * Expects:
		 * - this proxy preserves enough external request information to select its configured origin
		 * - the HTTPS form save succeeds and persists
		 * - direct access remains usable without restarting the app
		 */
		test('keeps direct access working beside the HTTPS proxy', async ({ app, browser, page }) => {
			const directContext = await browser.newContext({ baseURL: app.url });
			const directPage = await directContext.newPage();
			try {
				await createAccount(directPage);
				await signIn(page);

				await openPage(page, '/settings/general');
				const before = (await generalSettings(page)).generalSettings.fail_on_referenced_delete;
				await setSwitch(page.getByRole('main'), 'Block Referenced Deletes', !before);
				await saveForm(page, { action: 'save' });

				expect(
					(await generalSettings(directPage)).generalSettings.fail_on_referenced_delete,
					'The direct origin should read the setting saved through the proxy'
				).toBe(!before);
			} finally {
				await directContext.close();
			}
		});
	});
}
