import { test } from '$flows/helpers/fixtures.ts';
import { openEntity, openTab, type EntitySection, type EntityTab } from '$flows/helpers/nav.ts';

// One fixtures entity per section. Delay Profiles uses a name with a space,
// which ends up in the URL.
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
	test(`openEntity opens ${section} › ${name}`, async ({ page }) => {
		await openEntity(page, section, name);
	});
}

const TABS: [EntitySection, string, EntityTab[]][] = [
	['Quality Profiles', 'Radarr Profile', ['Scoring', 'Qualities', 'General']],
	// Testing needs the parser, which flow tests don't run
	['Custom Formats', 'Every Condition', ['Conditions', 'General']]
];

for (const [section, name, tabs] of TABS) {
	test(`openTab walks every tab of ${section} › ${name}`, async ({ page }) => {
		await openEntity(page, section, name);
		for (const tab of tabs) await openTab(page, tab);
	});
}
