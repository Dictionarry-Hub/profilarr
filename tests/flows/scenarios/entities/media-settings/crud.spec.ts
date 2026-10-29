/**
 * - Protects: every Radarr and Sonarr media settings save, from the form
 *   action through the op it writes to the cache rebuilt from it.
 * - The values cover a boolean stored as 0 or 1 and each propers and repacks
 *   choice. Any choice but Do Not Prefer needs a typed confirmation first.
 * - Every save returns to the media settings list.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '#flows/helpers/core/test.ts';
import { fixture, fixtures, type ArrType } from '#flows/helpers/core/fixtureData.ts';
import { chooseOption, deleteEntity, fillField, saveForm } from '#flows/helpers/core/forms.ts';
import { newEntity, openEntity } from '#flows/helpers/core/nav.ts';
import { mediaSettingsPages } from '#flows/helpers/entities/mediaManagement.ts';

const FIXTURE = {
	radarr: fixture.mediaSettings('radarr', 'Fixture Radarr'),
	sonarr: fixture.mediaSettings('sonarr', 'Fixture Sonarr')
};
const ARRS = ['radarr', 'sonarr'] as const satisfies ArrType[];
const LABEL = { radarr: 'Radarr', sonarr: 'Sonarr' } as const;

/** What the Change propers and repacks dialog asks the user to type */
const CONFIRM_TEXT =
	'I UNDERSTAND THIS CAN BREAK CUSTOM FORMAT SCORING AND CAUSE INCONSISTENT GRAB BEHAVIOR';

interface StoredSettings {
	propers_repacks: string;
	enable_media_info: boolean;
}

/** Every config on the list by "arr/name", with the two stored settings */
async function storedConfigs(page: Page): Promise<Map<string, StoredSettings>> {
	const configs = await mediaSettingsPages.list(page);
	return new Map(
		configs.map((config) => [
			`${config.arr_type}/${config.name}`,
			{ propers_repacks: config.propers_repacks, enable_media_info: config.enable_media_info }
		])
	);
}

/**
 * Flow:
 * 1. The user starts a new Radarr media settings config and fills Name.
 * 2. The user turns off Enable Media Info and leaves Propers and Repacks at
 *    its default.
 * 3. The user clicks Create and lands on the list.
 *
 * Expects:
 * - enable_media_info is false
 * - propers_repacks is doNotPrefer
 */
test('creates a Radarr config with media info off', async ({ page }) => {
	const name = 'Flow Radarr Settings';
	await newEntity(page, 'Media Settings', 'Radarr');
	const main = page.getByRole('main');
	await fillField(main, 'Name', name);
	await main.getByRole('switch', { name: 'Enable Media Info' }).click();
	await saveForm(page, { button: 'Create' });

	expect(
		(await storedConfigs(page)).get(`radarr/${name}`),
		'the config should be stored with media info off and the default propers choice'
	).toEqual({ propers_repacks: 'doNotPrefer', enable_media_info: false });
});

/**
 * Flow:
 * 1. The user starts a new Sonarr media settings config and fills Name.
 * 2. The user turns off Enable Media Info.
 * 3. The user chooses Prefer and Upgrade in Propers and Repacks. The Change
 *    propers and repacks dialog opens.
 * 4. The user types the confirmation text and clicks Change.
 * 5. The user clicks Create and lands on the list.
 *
 * Expects:
 * - propers_repacks is preferAndUpgrade
 * - enable_media_info is false
 */
test('creates a Sonarr config after confirming a propers change', async ({ page }) => {
	const name = 'Flow Sonarr Settings';
	await newEntity(page, 'Media Settings', 'Sonarr');
	const main = page.getByRole('main');
	await fillField(main, 'Name', name);
	await main.getByRole('switch', { name: 'Enable Media Info' }).click();

	// chooseOption can't be used: the dropdown keeps showing the old choice
	// until the dialog is confirmed
	await main.getByRole('button', { name: /^Propers and Repacks: / }).click();
	await page.getByRole('button', { name: /^Prefer and Upgrade(\s|$)/ }).click();
	const dialog = page.getByRole('dialog', { name: 'Change propers and repacks' });
	await expect(dialog, 'Choosing Prefer and Upgrade should ask for confirmation').toBeVisible();
	await fillField(dialog, 'Confirmation', CONFIRM_TEXT);
	await dialog.getByRole('button', { name: 'Change', exact: true }).click();
	await expect(
		main.getByRole('button', { name: 'Propers and Repacks: Prefer and Upgrade', exact: true }),
		'Confirming should choose Prefer and Upgrade'
	).toBeVisible();
	await saveForm(page, { button: 'Create' });

	expect(
		(await storedConfigs(page)).get(`sonarr/${name}`),
		'the config should be stored with the confirmed propers choice and media info off'
	).toEqual({ propers_repacks: 'preferAndUpgrade', enable_media_info: false });
});

/**
 * Flow:
 * 1. The user opens Fixture Radarr, whose propers choice is Prefer and
 *    Upgrade.
 * 2. The user chooses Do Not Prefer and turns off Enable Media Info.
 * 3. The user clicks Save and lands on the list.
 *
 * Expects:
 * - propers_repacks is doNotPrefer
 * - enable_media_info is false
 */
test('updates a Radarr config to Do Not Prefer with media info off', async ({ page }) => {
	await openEntity(page, 'Media Settings', FIXTURE.radarr.name);
	const main = page.getByRole('main');
	await chooseOption(main, 'Propers and Repacks', 'Do Not Prefer');
	await main.getByRole('switch', { name: 'Enable Media Info' }).click();
	await saveForm(page);

	expect(
		(await storedConfigs(page)).get(`radarr/${FIXTURE.radarr.name}`),
		'the config should be stored as Do Not Prefer with media info off'
	).toEqual({ propers_repacks: 'doNotPrefer', enable_media_info: false });
});

/**
 * Flow:
 * 1. The user opens Fixture Sonarr, whose propers choice is Do Not Upgrade
 *    Automatically.
 * 2. The user chooses Do Not Prefer and turns on Enable Media Info.
 * 3. The user clicks Save and lands on the list.
 *
 * Expects:
 * - propers_repacks is doNotPrefer
 * - enable_media_info is true
 */
test('updates a Sonarr config to Do Not Prefer with media info on', async ({ page }) => {
	await openEntity(page, 'Media Settings', FIXTURE.sonarr.name);
	const main = page.getByRole('main');
	await chooseOption(main, 'Propers and Repacks', 'Do Not Prefer');
	await main.getByRole('switch', { name: 'Enable Media Info' }).click();
	await saveForm(page);

	expect(
		(await storedConfigs(page)).get(`sonarr/${FIXTURE.sonarr.name}`),
		'the config should be stored as Do Not Prefer with media info on'
	).toEqual({ propers_repacks: 'doNotPrefer', enable_media_info: true });
});

for (const arr of ARRS) {
	const other = arr === 'radarr' ? 'sonarr' : 'radarr';

	/**
	 * Flow:
	 * 1. The user opens the fixture config, changes its name and clicks Save.
	 *
	 * Expects:
	 * - the list has the new name with the fixture settings, and not the old
	 *   name
	 */
	test(`renames a ${LABEL[arr]} config and keeps its settings`, async ({ page }) => {
		const renamed = `Renamed ${LABEL[arr]} Settings`;
		await openEntity(page, 'Media Settings', FIXTURE[arr].name);
		await fillField(page.getByRole('main'), 'Name', renamed);
		await saveForm(page);

		const stored = await storedConfigs(page);
		expect(stored.has(`${arr}/${FIXTURE[arr].name}`), 'the old name should be gone').toBe(false);
		expect(
			stored.get(`${arr}/${renamed}`),
			'the new name should keep the fixture settings'
		).toEqual({
			propers_repacks: FIXTURE[arr].propersRepacks,
			enable_media_info: FIXTURE[arr].enableMediaInfo
		});
	});

	/**
	 * Flow:
	 * 1. The user opens the fixture config and deletes it.
	 *
	 * Expects:
	 * - the list keeps only the other Arr's configs
	 */
	test(`deletes a ${LABEL[arr]} config`, async ({ page }) => {
		await openEntity(page, 'Media Settings', FIXTURE[arr].name);
		await deleteEntity(page);

		expect(
			[...(await storedConfigs(page)).keys()].sort(),
			`only the ${LABEL[other]} configs should be left`
		).toEqual(fixtures.mediaSettings[other].map((config) => `${other}/${config.name}`).sort());
	});
}
