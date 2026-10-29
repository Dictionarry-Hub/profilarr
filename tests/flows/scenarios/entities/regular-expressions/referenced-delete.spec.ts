/**
 * - Protects: deleting a regular expression that custom format conditions
 *   still use, once the user turns off "Block Referenced Deletes".
 * - The delete writes cleanup ops that drop only the conditions using the
 *   regex. The custom formats, their other conditions, their tests and the
 *   profiles scoring them all stay.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '#flows/helpers/core/test.ts';
import { fixture, fixtures } from '#flows/helpers/core/fixtureData.ts';
import { deleteEntity, expectDeleteBlocked, saveForm } from '#flows/helpers/core/forms.ts';
import { openEntity, openSidebarPage, openTab } from '#flows/helpers/core/nav.ts';
import { pageData } from '#flows/helpers/core/pageData.ts';
import { conditionFromFixture, customFormatPages } from '#flows/helpers/entities/customFormats.ts';
import { regularExpressionPages } from '#flows/helpers/entities/regularExpressions.ts';

const TITLE = fixture.regularExpression('Title Regex');
const EVERY_CONDITION = fixture.customFormat('Every Condition');
const HAS_TESTS = fixture.customFormat('Has Tests');
const TITLE_MATCH = fixture.customFormat('Title Match');
const UNSCORED = fixture.customFormat('Unscored');

interface GeneralSettingsPage {
	generalSettings: { fail_on_referenced_delete: boolean };
}

const byName = <T extends { name: string }>(items: T[]) =>
	[...items].sort((a, b) => a.name.localeCompare(b.name));

/** A custom format's stored conditions, sorted by name */
async function storedConditions(page: Page, formatName: string) {
	await openEntity(page, 'Custom Formats', formatName);
	await openTab(page, 'Conditions');
	return byName((await customFormatPages.conditions(page)).conditions);
}

/** The fixture conditions of a format that don't use a regex, in the reader's shape */
function conditionsWithout(formatName: string, regexName: string) {
	return byName(
		fixture
			.customFormat(formatName)
			.conditions.filter((condition) => condition.value?.regularExpressionName !== regexName)
			.map(conditionFromFixture)
	);
}

/** How many custom formats use a regex in any condition */
const formatsUsing = (regexName: string) =>
	fixtures.customFormats.filter((format) =>
		format.conditions.some((condition) => condition.value?.regularExpressionName === regexName)
	).length;

/** How many quality profiles score a custom format */
const profilesScoring = (formatName: string) =>
	fixtures.qualityProfiles.filter((profile) =>
		profile.scores.some((score) => score.customFormatName === formatName)
	).length;

/**
 * Flow:
 * 1. The user opens Title Regex. Delete is blocked, because custom formats
 *    use it.
 * 2. The user opens General settings, turns off Block Referenced Deletes and
 *    saves.
 * 3. The user opens Title Regex again and deletes it.
 *
 * Expects:
 * - the general settings store fail_on_referenced_delete as false
 * - the regex list no longer has Title Regex
 * - every fixture custom format is still listed
 * - Every Condition loses only the conditions that used Title Regex. Group,
 *   which uses Group Regex, stays with the rest.
 * - Has Tests and Title Match have no conditions left
 * - Unscored is unchanged
 * - Has Tests keeps its tests
 * - Title Match is still scored by the same quality profiles
 */
test('deleting a referenced regex drops only the conditions using it', async ({ page }) => {
	await openEntity(page, 'Regular Expressions', TITLE.name);
	await expectDeleteBlocked(page, `Referenced by ${formatsUsing(TITLE.name)} custom formats`);

	await openSidebarPage(page, 'General');
	await page.getByRole('main').getByRole('switch', { name: 'Block Referenced Deletes' }).click();
	await saveForm(page, { action: 'save' });
	const settings = await pageData<GeneralSettingsPage>(page);
	expect(
		settings.generalSettings.fail_on_referenced_delete,
		'Block Referenced Deletes should be stored as off'
	).toBe(false);

	await openEntity(page, 'Regular Expressions', TITLE.name);
	await deleteEntity(page);

	const regexNames = (await regularExpressionPages.list(page)).map((regex) => regex.name);
	expect(regexNames, 'the regex list should not have Title Regex').not.toContain(TITLE.name);

	await openSidebarPage(page, 'Custom Formats');
	const formats = await customFormatPages.list(page);
	expect(
		formats.map((format) => format.name).sort(),
		'every fixture custom format should still be listed'
	).toEqual(fixtures.customFormats.map((format) => format.name).sort());
	expect(
		formats.find((format) => format.name === HAS_TESTS.name)?.testCount,
		'Has Tests should keep its tests'
	).toBe(HAS_TESTS.tests.length);

	const everyCondition = await storedConditions(page, EVERY_CONDITION.name);
	expect(
		everyCondition,
		'Every Condition should keep every condition that did not use Title Regex'
	).toEqual(conditionsWithout(EVERY_CONDITION.name, TITLE.name));
	expect(
		await storedConditions(page, HAS_TESTS.name),
		'Has Tests should have no conditions left'
	).toEqual([]);
	expect(
		await storedConditions(page, TITLE_MATCH.name),
		'Title Match should have no conditions left'
	).toEqual([]);
	expect(await storedConditions(page, UNSCORED.name), 'Unscored should be unchanged').toEqual(
		byName(UNSCORED.conditions.map(conditionFromFixture))
	);

	await openEntity(page, 'Custom Formats', TITLE_MATCH.name);
	const { profileRefs } = await customFormatPages.general(page);
	expect(profileRefs, 'Title Match should still be scored by the same profiles').toHaveLength(
		profilesScoring(TITLE_MATCH.name)
	);
});
