/**
 * - Protects: every Radarr and Sonarr naming config save, from the form
 *   action through the op it writes to the cache rebuilt from it.
 * - Formats hold single quotes and braces, which the SQL an op stores must
 *   escape and the cache must return unchanged.
 * - Sonarr stores colon replacement and multi-episode style as int codes,
 *   which the pages turn into words; Radarr stores words.
 * - Every save returns to the naming list. Format fields are filled last,
 *   because their token list stays open over the fields below.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '#flows/helpers/core/test.ts';
import { fixture, fixtures, SONARR_WORDS, type ArrType } from '#flows/helpers/core/fixtureData.ts';
import { chooseOption, deleteEntity, fillField, saveForm } from '#flows/helpers/core/forms.ts';
import { newEntity, openEntity } from '#flows/helpers/core/nav.ts';
import { camelKeys, pick, type Json } from '#flows/helpers/core/pageData.ts';
import { namingPages } from '#flows/helpers/entities/mediaManagement.ts';

const FIXTURE = {
	radarr: fixture.naming('radarr', 'Fixture Radarr'),
	sonarr: fixture.naming('sonarr', 'Fixture Sonarr')
};
const ARRS = ['radarr', 'sonarr'] as const satisfies ArrType[];
const LABEL = { radarr: 'Radarr', sonarr: 'Sonarr' } as const;

/** The fields each Arr's naming config stores its formats in */
const FORMAT_FIELDS = {
	radarr: ['movieFormat', 'movieFolderFormat'],
	sonarr: [
		'standardEpisodeFormat',
		'dailyEpisodeFormat',
		'animeEpisodeFormat',
		'seriesFolderFormat',
		'seasonFolderFormat'
	]
} as const;

const RADARR_FORMAT = "{Movie CleanTitle}'s Cut ({Release Year})";
const RADARR_UPDATED_FORMAT = "{Movie Title}'s {Edition Tags} ({Release Year})";
const SONARR_STANDARD_FORMAT = "{Series Title}'s S{season:00}E{episode:00}";
const SONARR_SEASON_FOLDER = "Season {season}'s";
const SONARR_UPDATED_FORMAT = "{Series Title} - S{season:00}E{episode:00} - {Episode Title}'s";
const CUSTOM_REPLACEMENT = ' -';

/** A config's format fields as the reader returns them, keyed like the fixtures */
async function storedFormats(page: Page, arr: ArrType): Promise<Json> {
	const config = arr === 'radarr' ? await namingPages.radarr(page) : await namingPages.sonarr(page);
	const formats = Object.fromEntries(FORMAT_FIELDS[arr].map((field) => [field, null]));
	return pick(camelKeys(config as unknown as Json), formats);
}

/** The fixture config's format fields */
function fixtureFormats(arr: ArrType): Json {
	return Object.fromEntries(FORMAT_FIELDS[arr].map((field) => [field, FIXTURE[arr][field]]));
}

/** Every naming config on the list, as "arr/name" */
async function listed(page: Page): Promise<string[]> {
	const configs = await namingPages.list(page);
	return configs.map((config) => `${config.arr_type}/${config.name}`).sort();
}

/**
 * Flow:
 * 1. The user starts a new Radarr naming config and fills Name.
 * 2. The user turns on Replace Illegal Characters and chooses Smart Replace.
 * 3. The user fills Movie Format with a format holding a single quote.
 * 4. The user clicks Create and lands on the naming list.
 * 5. The user opens the new config.
 *
 * Expects:
 * - the movie format comes back exactly as typed
 * - replace illegal characters is true
 * - colon replacement is smart
 */
test('creates a Radarr naming config', async ({ page }) => {
	const name = 'Flow Radarr Naming';
	await newEntity(page, 'Naming Settings', 'Radarr');
	const main = page.getByRole('main');
	await fillField(main, 'Name', name);
	await main.getByRole('switch', { name: 'Replace Illegal Characters' }).click();
	await chooseOption(main, 'Colon Replacement', 'Smart Replace');
	await fillField(main, 'Movie Format', RADARR_FORMAT);
	await saveForm(page, { button: 'Create' });

	await openEntity(page, 'Naming Settings', name);
	const config = await namingPages.radarr(page);
	expect(config.movie_format, 'the movie format should come back exactly as typed').toBe(
		RADARR_FORMAT
	);
	expect(config.replace_illegal_characters, 'replace illegal characters should be on').toBe(true);
	expect(config.colon_replacement_format, 'colon replacement should be smart').toBe('smart');
});

/**
 * Flow:
 * 1. The user opens Fixture Radarr.
 * 2. The user chooses Smart Replace and changes Movie Format.
 * 3. The user clicks Save and lands on the naming list.
 *
 * Expects:
 * - the new movie format and smart colon replacement are stored
 * - the movie folder format matches the fixture
 */
test('updates a Radarr naming config', async ({ page }) => {
	await openEntity(page, 'Naming Settings', FIXTURE.radarr.name);
	const main = page.getByRole('main');
	await chooseOption(main, 'Colon Replacement', 'Smart Replace');
	await fillField(main, 'Movie Format', RADARR_UPDATED_FORMAT);
	await saveForm(page);

	await openEntity(page, 'Naming Settings', FIXTURE.radarr.name);
	const config = await namingPages.radarr(page);
	expect(config.movie_format, 'the new movie format should be stored').toBe(RADARR_UPDATED_FORMAT);
	expect(config.colon_replacement_format, 'colon replacement should be smart').toBe('smart');
	expect(config.movie_folder_format, 'the movie folder format should match the fixture').toBe(
		FIXTURE.radarr.movieFolderFormat
	);
});

/**
 * Flow:
 * 1. The user starts a new Sonarr naming config and fills Name.
 * 2. The user chooses the Range multi-episode style.
 * 3. The user fills Standard Episode Format and Season Folder Format.
 * 4. The user clicks Create and lands on the naming list.
 * 5. The user opens the new config.
 *
 * Expects:
 * - both formats come back exactly as typed
 * - the multi-episode style is range
 */
test('creates a Sonarr naming config', async ({ page }) => {
	const name = 'Flow Sonarr Naming';
	await newEntity(page, 'Naming Settings', 'Sonarr');
	const main = page.getByRole('main');
	await fillField(main, 'Name', name);
	await chooseOption(main, 'Multi-Episode Style', 'Range');
	await fillField(main, 'Standard Episode Format', SONARR_STANDARD_FORMAT);
	await fillField(main, 'Season Folder Format', SONARR_SEASON_FOLDER);
	await saveForm(page, { button: 'Create' });

	await openEntity(page, 'Naming Settings', name);
	const config = await namingPages.sonarr(page);
	expect(config.standard_episode_format, 'the standard episode format should be stored').toBe(
		SONARR_STANDARD_FORMAT
	);
	expect(config.season_folder_format, 'the season folder format should be stored').toBe(
		SONARR_SEASON_FOLDER
	);
	expect(config.multi_episode_style, 'the multi-episode style should be range').toBe('range');
});

/**
 * Flow:
 * 1. The user opens Fixture Sonarr.
 * 2. The user chooses the Range multi-episode style.
 * 3. The user chooses Custom colon replacement and fills Custom Replacement
 *    with a leading space.
 * 4. The user changes Standard Episode Format.
 * 5. The user clicks Save and lands on the naming list.
 *
 * Expects:
 * - the multi-episode style is range
 * - colon replacement is custom, the word for stored code 5
 * - the custom replacement keeps its leading space, where the fixture had null
 * - the new standard episode format is stored, and the daily episode format
 *   matches the fixture
 */
test('updates a Sonarr naming config with a custom colon replacement', async ({ page }) => {
	await openEntity(page, 'Naming Settings', FIXTURE.sonarr.name);
	const main = page.getByRole('main');
	await chooseOption(main, 'Multi-Episode Style', 'Range');
	await chooseOption(main, 'Colon Replacement', 'Custom');
	await fillField(main, 'Custom Replacement', CUSTOM_REPLACEMENT);
	await fillField(main, 'Standard Episode Format', SONARR_UPDATED_FORMAT);
	await saveForm(page);

	await openEntity(page, 'Naming Settings', FIXTURE.sonarr.name);
	const config = await namingPages.sonarr(page);
	expect(config.multi_episode_style, 'the multi-episode style should be range').toBe('range');
	expect(config.colon_replacement_format, 'colon replacement should be custom, code 5').toBe(
		SONARR_WORDS.colonReplacementFormat[5]
	);
	expect(FIXTURE.sonarr.customColonReplacementFormat, 'the fixture has no custom replacement').toBe(
		null
	);
	expect(
		config.custom_colon_replacement_format,
		'the custom replacement should keep its leading space'
	).toBe(CUSTOM_REPLACEMENT);
	expect(config.standard_episode_format, 'the new standard episode format should be stored').toBe(
		SONARR_UPDATED_FORMAT
	);
	expect(config.daily_episode_format, 'the daily episode format should match the fixture').toBe(
		FIXTURE.sonarr.dailyEpisodeFormat
	);
});

for (const arr of ARRS) {
	const other = arr === 'radarr' ? 'sonarr' : 'radarr';

	/**
	 * Flow:
	 * 1. The user opens the fixture config, changes its name and clicks Save.
	 * 2. The user opens the config under its new name.
	 *
	 * Expects:
	 * - the list has the new name, and not the old one
	 * - the config keeps the fixture formats at the new name
	 */
	test(`renames a ${LABEL[arr]} naming config and keeps its formats`, async ({ page }) => {
		const renamed = `Renamed ${LABEL[arr]} Naming`;
		await openEntity(page, 'Naming Settings', FIXTURE[arr].name);
		await fillField(page.getByRole('main'), 'Name', renamed);
		await saveForm(page);

		const names = await listed(page);
		expect(names, 'the list should have the new name').toContain(`${arr}/${renamed}`);
		expect(names, 'the list should not have the old name').not.toContain(
			`${arr}/${FIXTURE[arr].name}`
		);
		await openEntity(page, 'Naming Settings', renamed);
		expect(
			await storedFormats(page, arr),
			'the config should keep the fixture formats at the new name'
		).toEqual(fixtureFormats(arr));
	});

	/**
	 * Flow:
	 * 1. The user opens the fixture config and deletes it.
	 *
	 * Expects:
	 * - the list keeps only the other Arr's configs
	 */
	test(`deletes a ${LABEL[arr]} naming config`, async ({ page }) => {
		await openEntity(page, 'Naming Settings', FIXTURE[arr].name);
		await deleteEntity(page);

		expect(await listed(page), `only the ${LABEL[other]} configs should be left`).toEqual(
			fixtures.naming[other].map((config) => `${other}/${config.name}`).sort()
		);
	});
}
