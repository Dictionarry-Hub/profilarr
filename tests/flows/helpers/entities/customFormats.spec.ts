/**
 * Checks for the readers in helpers/entities/customFormats.ts.
 */
import { test, expect } from '#flows/helpers/core/test.ts';
import { fixture, fixtures } from '#flows/helpers/core/fixtureData.ts';
import { openEntity, openSidebarPage, openTab } from '#flows/helpers/core/nav.ts';
import { customFormatPages } from './customFormats.ts';

test('list reads every custom format', async ({ page }) => {
	await openSidebarPage(page, 'Custom Formats');
	const names = (await customFormatPages.list(page)).map((format) => format.name);
	expect(names.sort()).toEqual(fixtures.customFormats.map((format) => format.name).sort());
});

test('general reads a custom format and the profiles scoring it', async ({ page }) => {
	const expected = fixture.customFormat('Title Match');
	await openEntity(page, 'Custom Formats', expected.name);

	const { format, profileRefs } = await customFormatPages.general(page);
	expect(format.include_in_rename).toBe(expected.includeInRename);
	const scoring = fixtures.qualityProfiles
		.filter((profile) => profile.scores.some((s) => s.customFormatName === expected.name))
		.map((profile) => profile.name);
	expect(profileRefs.map((ref) => ref.name).sort()).toEqual(scoring.sort());
});

test('conditions reads every condition of a custom format', async ({ page }) => {
	const expected = fixture.customFormat('Every Condition');
	await openEntity(page, 'Custom Formats', expected.name);
	await openTab(page, 'Conditions');

	const { conditions } = await customFormatPages.conditions(page);
	expect(conditions.map((condition) => condition.name).sort()).toEqual(
		expected.conditions.map((condition) => condition.name).sort()
	);
});
