/**
 * Checks for the navigation helpers in helpers/nav.ts.
 */
import { test } from '$flows/helpers/test.ts';
import {
	SIDEBAR_PAGES,
	openDatabase,
	openEntity,
	openSidebarPage,
	openTab,
	type EntitySection,
	type PageTab
} from '$flows/helpers/nav.ts';

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

test.describe('openDatabase', () => {
	test('opens Fixtures', async ({ page }) => {
		await openDatabase(page, 'Fixtures');
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
		await openDatabase(page, 'Fixtures');
		for (const tab of ['Updates', 'Conflicts', 'Settings', 'Changes'] as const) {
			await openTab(page, tab);
		}
	});
});
