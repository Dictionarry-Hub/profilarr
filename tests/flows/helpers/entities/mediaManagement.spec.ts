/**
 * Checks for the readers in helpers/entities/mediaManagement.ts.
 */
import { test, expect } from '$flows/helpers/core/test.ts';
import { fixture, fixtures, SONARR_WORDS } from '$flows/helpers/core/fixtureData.ts';
import { openEntity, openSidebarPage } from '$flows/helpers/core/nav.ts';
import {
	mediaSettingsPages,
	namingPages,
	qualityDefinitionsPages
} from '$flows/helpers/entities/mediaManagement.ts';

const allNames = (configs: Record<'radarr' | 'sonarr', { name: string }[]>) =>
	[...configs.radarr, ...configs.sonarr].map((config) => config.name).sort();

test('naming list reads every naming config', async ({ page }) => {
	await openSidebarPage(page, 'Naming Settings');
	const names = (await namingPages.list(page)).map((config) => config.name);
	expect(names.sort()).toEqual(allNames(fixtures.naming));
});

test('naming reads Radarr and Sonarr configs', async ({ page }) => {
	const radarr = fixture.naming('radarr', 'Fixture Radarr');
	await openEntity(page, 'Naming Settings', radarr.name);
	expect((await namingPages.radarr(page)).movie_format).toBe(radarr.movieFormat);

	const sonarr = fixture.naming('sonarr', 'Fixture Sonarr');
	await openEntity(page, 'Naming Settings', sonarr.name);
	const config = await namingPages.sonarr(page);
	expect(config.standard_episode_format).toBe(sonarr.standardEpisodeFormat);
	// Stored as a number, sent as a word
	expect(config.multi_episode_style).toBe(
		SONARR_WORDS.multiEpisodeStyle[sonarr.multiEpisodeStyle as number]
	);
});

test('media settings reads every config and a Radarr config', async ({ page }) => {
	await openSidebarPage(page, 'Media Settings');
	const names = (await mediaSettingsPages.list(page)).map((config) => config.name);
	expect(names.sort()).toEqual(allNames(fixtures.mediaSettings));

	const expected = fixture.mediaSettings('radarr', 'Fixture Radarr');
	await openEntity(page, 'Media Settings', expected.name);
	expect((await mediaSettingsPages.radarr(page)).propers_repacks).toBe(expected.propersRepacks);
});

test('quality definitions reads every config and one config', async ({ page }) => {
	await openSidebarPage(page, 'Quality Definitions');
	const names = (await qualityDefinitionsPages.list(page)).map((config) => config.name);
	expect(names.sort()).toEqual(allNames(fixtures.qualityDefinitions));

	const expected = fixture.qualityDefinitions('radarr', 'Fixture Radarr');
	await openEntity(page, 'Quality Definitions', expected.name);
	const { config, availableQualities } = await qualityDefinitionsPages.entity(page);
	expect(config.entries).toHaveLength(expected.qualities.length);
	expect(availableQualities.sort()).toEqual(Object.keys(fixtures.qualityApiNames.radarr).sort());
});
