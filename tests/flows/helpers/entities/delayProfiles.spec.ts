/**
 * Checks for the readers in helpers/entities/delayProfiles.ts.
 */
import { test, expect } from '#flows/helpers/core/test.ts';
import { fixture, fixtures } from '#flows/helpers/core/fixtureData.ts';
import { openEntity, openSidebarPage } from '#flows/helpers/core/nav.ts';
import { delayProfilePages } from './delayProfiles.ts';

test('list reads every delay profile', async ({ page }) => {
	await openSidebarPage(page, 'Delay Profiles');
	const names = (await delayProfilePages.list(page)).map((profile) => profile.name);
	expect(names.sort()).toEqual(fixtures.delayProfiles.map((profile) => profile.name).sort());
});

test('entity reads a delay profile', async ({ page }) => {
	const expected = fixture.delayProfile('Bypass Score');
	await openEntity(page, 'Delay Profiles', expected.name);

	const profile = await delayProfilePages.entity(page);
	expect(profile.preferred_protocol).toBe(expected.preferredProtocol);
	expect(profile.usenet_delay).toBe(expected.usenetDelay);
	expect(profile.bypass_if_above_custom_format_score).toBe(true);
	expect(profile.minimum_custom_format_score).toBe(expected.minimumCustomFormatScore);
});
