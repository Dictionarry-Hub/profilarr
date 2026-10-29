/**
 * Arr instance helpers. Like the navigation helpers, each runs as one named
 * step, and a failure points at the scenario line that called it.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';
import {
	chooseOption,
	deleteEntity,
	saveForm,
	type ActionResult
} from '#flows/helpers/core/forms.ts';
import type { BasicAuth, FakeArr } from './fakeArr.ts';
import {
	openPage,
	openSidebarPage,
	openTab,
	sidebar,
	waitForHydration
} from '#flows/helpers/core/nav.ts';
import { pageData } from '#flows/helpers/core/pageData.ts';

export interface AddArrOptions {
	/** Instance name shown in Profilarr */
	name: string;
	/** The fake to connect to; gives the type, URL and API key */
	fake: FakeArr;
	/** Type a different API key, e.g. a wrong one. Defaults to the fake's key. */
	apiKey?: string;
	/** Type a different URL, e.g. one nothing listens on. Defaults to the fake's URL. */
	url?: string;
	/** The External URL field, left blank by default */
	externalUrl?: string;
	/** Tags to add, each typed and confirmed with Enter */
	tags?: string[];
	/** Basic Auth credentials to fill in, left blank by default */
	basicAuth?: BasicAuth;
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
			if (options.externalUrl !== undefined) {
				await main.getByRole('textbox', { name: /^External URL/ }).fill(options.externalUrl);
			}
			await main.getByLabel(/^API Key/).fill(options.apiKey ?? fake.apiKey);
			if (options.basicAuth) {
				await main.getByRole('textbox', { name: /^Username/ }).fill(options.basicAuth.username);
				await main.getByLabel(/^Password/).fill(options.basicAuth.password);
			}
			for (const tag of options.tags ?? []) await addTag(main, tag);

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
			if (page.url() === 'about:blank') await openPage(page, '/');
			else await waitForHydration(page);
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

/** Type a tag into the Tags box and press Enter, then check it shows */
async function addTag(scope: Locator, tag: string): Promise<void> {
	const tags = scope.getByRole('textbox', { name: 'Tags', exact: true });
	await tags.fill(tag);
	await tags.press('Enter');
	await expect(
		scope.getByRole('button', { name: `Remove ${tag}`, exact: true }),
		`The tag ${tag} should be added`
	).toBeVisible();
}

/** An Arr instance as GET /api/v1/arr lists it, never with its secrets */
export interface ArrInstance {
	id: number;
	name: string;
	type: 'radarr' | 'sonarr';
	url: string;
	external_url: string | null;
	/** JSON text of the tag list, e.g. '["4k"]' */
	tags: string | null;
	library_refresh_interval: number;
	detected_version: string | null;
	detected_api: string | null;
	[key: string]: unknown;
}

/** Every Arr instance, as GET /api/v1/arr lists them */
export async function arrInstances(page: Page): Promise<ArrInstance[]> {
	return await test.step(
		'Read the Arr instances',
		async () => {
			const response = await page.request.get('/api/v1/arr');
			expect(response.ok(), 'GET /api/v1/arr should answer').toBe(true);
			return (await response.json()) as ArrInstance[];
		},
		{ box: true }
	);
}

/** One Arr instance by name from GET /api/v1/arr; fails when there is none */
export async function arrInstance(page: Page, name: string): Promise<ArrInstance> {
	const found = (await arrInstances(page)).find((instance) => instance.name === name);
	if (!found) throw new Error(`GET /api/v1/arr lists no instance named "${name}"`);
	return found;
}

/** The cleanup schedule an instance's Settings tab loads */
export interface CleanupSettings {
	enabled: boolean;
	cron: string;
	/** ISO timestamps */
	nextRunAt: string | null;
	lastRunAt: string | null;
}

/** What an instance's Settings tab loads */
export interface ArrSettings {
	instance: ArrInstance;
	cleanupSettings: CleanupSettings | null;
	/** Whether Basic Auth is saved; the values never reach the page */
	hasBasicAuth: boolean;
}

/** The data an instance's Settings tab (`/arr/{id}/settings`) loads */
export async function arrSettings(page: Page, id: number): Promise<ArrSettings> {
	return await pageData<ArrSettings>(page, `/arr/${id}/settings`);
}

/** Changes to make on an instance's Settings tab; anything left out stays */
export interface ArrChanges {
	name?: string;
	url?: string;
	externalUrl?: string;
	apiKey?: string;
	basicAuth?: BasicAuth;
	/** Tags to remove with their "Remove <tag>" buttons */
	removeTags?: string[];
	/** Tags to add */
	addTags?: string[];
	/** A Library Refresh option, e.g. "Every hour" or "Manual" */
	libraryRefresh?: string;
	/** Turn the Cleanup switch on or off */
	cleanup?: boolean;
}

export interface EditArrOptions {
	/** Click Save and wait for the update to succeed. Default true. */
	save?: boolean;
}

/** Open an instance's Settings tab, unless the page is already on it */
async function onSettings(page: Page, name: string): Promise<void> {
	const onTab =
		page.url() !== 'about:blank' && /^\/arr\/\d+\/settings$/.test(new URL(page.url()).pathname);
	if (onTab) {
		const title = page.getByRole('main').getByRole('textbox', { name: /^Name/ });
		if ((await title.inputValue()) === name) return await waitForHydration(page);
	}
	await openArr(page, name);
	await openTab(page, 'Settings');
}

/**
 * Change an instance on its Settings tab and save with the `update` action.
 * Returns the action's result, or null with `save: false`, so a scenario can
 * check the form before it saves.
 */
export async function editArr(
	page: Page,
	name: string,
	changes: ArrChanges,
	options: EditArrOptions = {}
): Promise<ActionResult | null> {
	return await test.step(
		`Edit Arr ${name}`,
		async () => {
			await onSettings(page, name);
			const main = page.getByRole('main');

			if (changes.name !== undefined) {
				await main.getByRole('textbox', { name: /^Name/ }).fill(changes.name);
			}
			if (changes.url !== undefined) {
				await main.getByRole('textbox', { name: /^URL/ }).fill(changes.url);
			}
			if (changes.externalUrl !== undefined) {
				await main.getByRole('textbox', { name: /^External URL/ }).fill(changes.externalUrl);
			}
			if (changes.apiKey !== undefined) {
				await main.getByLabel(/^API Key/).fill(changes.apiKey);
			}
			if (changes.basicAuth) {
				await main.getByRole('textbox', { name: /^Username/ }).fill(changes.basicAuth.username);
				await main.getByLabel(/^Password/).fill(changes.basicAuth.password);
			}
			for (const tag of changes.removeTags ?? []) {
				await main.getByRole('button', { name: `Remove ${tag}`, exact: true }).click();
				await expect(
					main.getByRole('button', { name: `Remove ${tag}`, exact: true }),
					`The tag ${tag} should be removed`
				).toHaveCount(0);
			}
			for (const tag of changes.addTags ?? []) await addTag(main, tag);
			if (changes.libraryRefresh !== undefined) {
				await chooseOption(main, 'Library Refresh', changes.libraryRefresh);
			}
			if (changes.cleanup !== undefined) {
				const toggle = main.getByRole('switch', { name: 'Cleanup', exact: true });
				if ((await toggle.getAttribute('aria-checked')) !== String(changes.cleanup)) {
					await toggle.click();
				}
				await expect(toggle, `Cleanup should be ${changes.cleanup ? 'on' : 'off'}`).toHaveAttribute(
					'aria-checked',
					String(changes.cleanup)
				);
			}

			if (options.save === false) return null;
			return await saveForm(page, { action: 'update' });
		},
		{ box: true }
	);
}

/** Turn an instance's Cleanup switch on or off and save */
export async function setCleanup(page: Page, name: string, on: boolean): Promise<void> {
	await editArr(page, name, { cleanup: on });
}

/**
 * Delete an instance from its Settings tab, confirming the "Delete Instance"
 * dialog, and wait for the redirect to the instance list.
 */
export async function deleteArr(page: Page, name: string): Promise<void> {
	await test.step(
		`Delete Arr ${name}`,
		async () => {
			await onSettings(page, name);
			await deleteEntity(page, { action: 'delete' });
			await expect(page, 'Deleting should return to the instance list').toHaveURL(
				(url) => url.pathname === '/arr'
			);
		},
		{ box: true }
	);
}
