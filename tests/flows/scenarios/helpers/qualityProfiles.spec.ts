/**
 * Checks for the readers in helpers/qualityProfiles.ts.
 */
import { test, expect } from '$flows/helpers/test.ts';
import { fixture, fixtures } from '$flows/helpers/fixtureData.ts';
import { openEntity, openSidebarPage, openTab } from '$flows/helpers/nav.ts';
import { qualityProfilePages } from '$flows/helpers/qualityProfiles.ts';

const expected = fixture.qualityProfile('Radarr Profile');

test('list reads every quality profile', async ({ page }) => {
	await openSidebarPage(page, 'Quality Profiles');
	const names = (await qualityProfilePages.list(page)).map((profile) => profile.name);
	expect(names.sort()).toEqual(fixtures.qualityProfiles.map((profile) => profile.name).sort());
});

test('general reads a quality profile', async ({ page }) => {
	await openEntity(page, 'Quality Profiles', expected.name);
	const profile = await qualityProfilePages.general(page);
	expect(profile.name).toBe(expected.name);
	expect(profile.description).toBe(expected.description);
});

test("scoring reads a quality profile's scores", async ({ page }) => {
	await openEntity(page, 'Quality Profiles', expected.name);
	await openTab(page, 'Scoring');
	const scoring = await qualityProfilePages.scoring(page);
	expect(scoring.minimum_custom_format_score).toBe(expected.minimumCustomFormatScore);
	const titleMatch = scoring.customFormats.find((format) => format.name === 'Title Match');
	expect(titleMatch?.scores.radarr).toBe(100);
});

test("qualities reads a quality profile's qualities in order", async ({ page }) => {
	await openEntity(page, 'Quality Profiles', expected.name);
	await openTab(page, 'Qualities');
	const { orderedItems } = await qualityProfilePages.qualities(page);
	expect(orderedItems.map((item) => item.name)).toEqual(expected.qualities.map((q) => q.name));
});
