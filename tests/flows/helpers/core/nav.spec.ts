/**
 * Checks for the navigation helpers in helpers/core/nav.ts.
 */
import { test, expect, FIXTURES_NAME } from '$flows/helpers/core/test.ts';
import {
	SIDEBAR_PAGES,
	newEntity,
	openDatabase,
	openEntity,
	openPage,
	openSidebarPage,
	openTab,
	type EntitySection,
	type PageTab
} from '$flows/helpers/core/nav.ts';

/**
 * Flow:
 * 1. The browser cannot load the app's client entry script.
 * 2. The user opens the Databases page, which still renders on the server.
 *
 * Expects:
 * - openPage refuses to return a page whose controls have not hydrated
 * - the Databases controls still render on the server
 */
test('openPage rejects a server-rendered page that cannot hydrate', async ({ page }) => {
	await page.route('**/_app/immutable/entry/start.*.js', (route) => route.abort());

	await expect(openPage(page, '/databases')).rejects.toThrow('Profilarr should finish hydrating');
	await expect(page.getByRole('main').getByPlaceholder('Search databases...')).toBeVisible();
});

test.describe('openSidebarPage', () => {
	// One test per sidebar link, so a broken page fails on its own line
	for (const name of SIDEBAR_PAGES) {
		test(`opens ${name}`, async ({ page }) => {
			await openSidebarPage(page, name);
		});
	}
});

test.describe('openEntity', () => {
	// One fixtures entity per section. Bypass Score has a space, which ends up in the URL.
	const ENTITIES: [EntitySection, string][] = [
		['Quality Profiles', 'Radarr Profile'],
		['Custom Formats', 'Every Condition'],
		['Regular Expressions', 'Title Regex'],
		['Delay Profiles', 'Bypass Score'],
		['Naming Settings', 'Fixture Sonarr'],
		['Quality Definitions', 'Fixture Radarr'],
		['Media Settings', 'Fixture Sonarr']
	];

	for (const [section, name] of ENTITIES) {
		test(`opens ${section} › ${name}`, async ({ page }) => {
			await openEntity(page, section, name);
		});
	}
});

test.describe('newEntity', () => {
	test('opens the new Quality Profile form', async ({ page }) => {
		await newEntity(page, 'Quality Profiles');
	});
	test('opens the new Custom Format form', async ({ page }) => {
		await newEntity(page, 'Custom Formats');
	});
	test('opens the new Delay Profile form', async ({ page }) => {
		await newEntity(page, 'Delay Profiles');
	});
	for (const option of ['Blank', 'Release Group'] as const) {
		test(`opens the new Regular Expression form › ${option}`, async ({ page }) => {
			await newEntity(page, 'Regular Expressions', option);
		});
	}
	for (const section of ['Naming Settings', 'Quality Definitions', 'Media Settings'] as const) {
		for (const option of ['Radarr', 'Sonarr'] as const) {
			test(`opens the new ${section} form › ${option}`, async ({ page }) => {
				await newEntity(page, section, option);
			});
		}
	}
});

test.describe('openDatabase', () => {
	test('opens Fixtures', async ({ page }) => {
		await openDatabase(page, FIXTURES_NAME);
	});
});

test.describe('openTab', () => {
	const ENTITY_TABS: [EntitySection, string, PageTab[]][] = [
		['Quality Profiles', 'Radarr Profile', ['Scoring', 'Qualities', 'General']],
		// Testing needs the parser, which flow tests don't run
		['Custom Formats', 'Every Condition', ['Conditions', 'General']]
	];

	for (const [section, name, tabs] of ENTITY_TABS) {
		test(`walks every tab of ${section} › ${name}`, async ({ page }) => {
			await openEntity(page, section, name);
			for (const tab of tabs) await openTab(page, tab);
		});
	}

	// Announcements and Config need a personal access token; Tweaks is behind a feature flag
	test('walks every tab of the Fixtures database', async ({ page }) => {
		await openDatabase(page, FIXTURES_NAME);
		for (const tab of ['Updates', 'Conflicts', 'Settings', 'Changes'] as const) {
			await openTab(page, tab);
		}
	});
});
