/**
 * Arr instance helpers. Like the navigation helpers, each runs as one named
 * step, and a failure points at the scenario line that called it.
 */

import { expect, test, type Page } from '@playwright/test';
import { chooseOption } from '$flows/helpers/core/forms.ts';
import type { FakeArr } from '$flows/helpers/sync/fakeArr.ts';
import { openSidebarPage, sidebar } from '$flows/helpers/core/nav.ts';

export interface AddArrOptions {
	/** Instance name shown in Profilarr */
	name: string;
	/** The fake to connect to; gives the type, URL and API key */
	fake: FakeArr;
	/** Type a different API key, e.g. a wrong one. Defaults to the fake's key. */
	apiKey?: string;
	/** Type a different URL, e.g. one nothing listens on. Defaults to the fake's URL. */
	url?: string;
	/** Click Test Connection and wait for success first. Defaults to true. */
	testConnection?: boolean;
	/** Click Save and wait for the instance list. Defaults to true. */
	save?: boolean;
}

/**
 * Add an Arr instance through the new instance form. With the defaults it
 * tests the connection, saves, and checks the instance is listed. Turn off
 * `testConnection` or `save` to check a failure in the scenario instead.
 */
export async function addArr(page: Page, options: AddArrOptions): Promise<void> {
	const { name, fake, testConnection = true, save = true } = options;
	const typeLabel = fake.target.label;

	await test.step(
		`Add ${typeLabel} instance ${name}`,
		async () => {
			await openSidebarPage(page, 'Arrs');
			// A link on the empty page, an icon button once instances exist
			const add = page
				.getByRole('main')
				.getByRole('link', { name: 'Add Instance' })
				.or(page.getByRole('main').getByRole('button', { name: 'Add Instance' }));
			await expect(add, 'The Arrs page should offer Add Instance').toBeVisible();
			await add.click();
			await expect(page).toHaveURL((url) => url.pathname === '/arr/new');

			const main = page.getByRole('main');
			await main.getByRole('textbox', { name: /^Name/ }).fill(name);
			await chooseOption(main, 'Type', typeLabel);
			await main.getByRole('textbox', { name: /^URL/ }).fill(options.url ?? fake.url);
			await main.getByLabel(/^API Key/).fill(options.apiKey ?? fake.apiKey);

			if (testConnection) {
				await main.getByRole('button', { name: 'Test Connection' }).click();
				await expect(
					// Earlier success alerts can still be showing, so take the newest
					page.getByText(new RegExp(`^(Connected to ${typeLabel}|Connection successful)`)).last(),
					'The connection test should succeed'
				).toBeVisible();
			}

			if (save) {
				const saveButton = main.getByRole('button', { name: 'Save', exact: true });
				await expect(saveButton, 'Save should be enabled once the form is filled').toBeEnabled();
				await saveButton.click();
				await expect(page, 'Saving should return to the instance list').toHaveURL(
					(url) => url.pathname === '/arr'
				);
				await expect(
					page.getByRole('main').getByText(name, { exact: true }),
					`The instance list should show ${name}`
				).toBeVisible();
			}
		},
		{ box: true }
	);
}

/**
 * Open an Arr instance from its link under Arrs in the sidebar. It opens on
 * Sync until the instance has sync settings, then on Library.
 */
export async function openArr(page: Page, name: string): Promise<void> {
	await test.step(
		`Open Arr ${name}`,
		async () => {
			if (page.url() === 'about:blank') await page.goto('/');
			const link = sidebar(page).getByRole('link', { name, exact: true });
			await expect(link, `The sidebar should list Arr ${name}`).toBeVisible();
			await link.click();
			await expect(page, `${name} should open on its Sync or Library tab`).toHaveURL((url) =>
				/^\/arr\/\d+\/(sync|library)$/.test(url.pathname)
			);
			await expect(
				page.getByRole('navigation', { name: 'Tabs' }).locator('[aria-current="page"]'),
				'A tab should be marked as the current page'
			).toBeVisible();
		},
		{ box: true }
	);
}
