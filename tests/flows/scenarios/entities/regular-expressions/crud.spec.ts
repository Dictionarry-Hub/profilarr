/**
 * - Protects: every regular expression save, from the form action through the
 *   op it writes to the cache rebuilt from it, read back through the pages.
 * - Patterns hold backslashes, single quotes and non-ASCII letters, which the
 *   SQL an op stores must escape and the cache must return unchanged.
 * - A regex that conditions still use can't be deleted while the default
 *   "Block Referenced Deletes" setting is on.
 */
import type { Locator } from '@playwright/test';
import { test, expect } from '#flows/helpers/core/test.ts';
import { fixture, fixtures } from '#flows/helpers/core/fixtureData.ts';
import {
	deleteEntity,
	expectDeleteBlocked,
	fillField,
	saveForm
} from '#flows/helpers/core/forms.ts';
import { newEntity, openEntity } from '#flows/helpers/core/nav.ts';
import { regularExpressionPages } from '#flows/helpers/entities/regularExpressions.ts';

const TITLE = fixture.regularExpression('Title Regex');
const GROUP = fixture.regularExpression('Group Regex');
const UNUSED = fixture.regularExpression('Unused Regex');

const NEW_NAME = 'Flow Regex';
const NEW_PATTERN = "^\\d+'s\\.(?:x264|ÄÖ)$";
const NEW_DESCRIPTION = "Matches a year's cut, with an *escaped* dot.";
const NEW_TAG = 'flow';
const UPDATED_PATTERN = "\\bO'Brien\\b";
const UPDATED_DESCRIPTION = "Matches O'Brien's group.";
const RENAMED = 'Renamed Title Regex';

/** Type a tag into the Tags box and press Enter */
async function addTag(scope: Locator, tag: string): Promise<void> {
	const tags = scope.getByRole('textbox', { name: 'Tags', exact: true });
	await tags.fill(tag);
	await tags.press('Enter');
}

/** The pattern box; its two labels both read "Regular Expression*" */
const patternField = (scope: Locator) =>
	scope.getByRole('textbox', { name: /^Regular Expression\*/ });

/** Every custom format condition that uses a regex, as "format/condition" */
function conditionsUsing(regexName: string): string[] {
	return fixtures.customFormats
		.flatMap((format) =>
			format.conditions
				.filter((condition) => condition.value?.regularExpressionName === regexName)
				.map((condition) => `${format.name}/${condition.name}`)
		)
		.sort();
}

/** How many custom formats use a regex in any condition */
function formatsUsing(regexName: string): number {
	return fixtures.customFormats.filter((format) =>
		format.conditions.some((condition) => condition.value?.regularExpressionName === regexName)
	).length;
}

/**
 * Flow:
 * 1. The user opens a blank new regular expression.
 * 2. The user fills Name, adds a tag and fills Description.
 * 3. The user fills a pattern holding a backslash, a single quote and
 *    non-ASCII letters. Regex101 ID stays empty.
 * 4. The user clicks Create and lands on the list.
 *
 * Expects:
 * - the pattern comes back exactly as typed
 * - the description and tag are stored
 * - regex101_id is null
 */
test('creates a regex with a pattern that needs escaping', async ({ page }) => {
	await newEntity(page, 'Regular Expressions', 'Blank');
	const main = page.getByRole('main');
	await fillField(main, 'Name', NEW_NAME);
	await addTag(main, NEW_TAG);
	await fillField(main, 'Description', NEW_DESCRIPTION);
	await patternField(main).fill(NEW_PATTERN);
	await saveForm(page, { button: 'Create' });

	const created = (await regularExpressionPages.list(page)).find((r) => r.name === NEW_NAME);
	expect(created, `the list should have ${NEW_NAME}`).toBeDefined();
	expect(created?.pattern, 'the pattern should come back exactly as typed').toBe(NEW_PATTERN);
	expect(created?.description, 'the description should be stored').toBe(NEW_DESCRIPTION);
	expect(
		created?.tags.map((tag) => tag.name),
		'the tag should be stored'
	).toEqual([NEW_TAG]);
	expect(created?.regex101_id, 'an empty Regex101 ID should be stored as null').toBe(null);
});

/**
 * Flow:
 * 1. The user opens Group Regex.
 * 2. The user changes the pattern to one with a single quote and a backslash,
 *    and changes the description.
 * 3. The user removes the beta tag and adds a new tag.
 * 4. The user clicks Save Changes and lands on the list.
 *
 * Expects:
 * - the new pattern, description and tags are stored
 * - the name is unchanged
 */
test('updates the pattern, description and tags of a regex', async ({ page }) => {
	await openEntity(page, 'Regular Expressions', GROUP.name);
	const main = page.getByRole('main');
	await patternField(main).fill(UPDATED_PATTERN);
	await fillField(main, 'Description', UPDATED_DESCRIPTION);
	await main.getByRole('button', { name: `Remove ${GROUP.tags[0]}`, exact: true }).click();
	await addTag(main, NEW_TAG);
	await saveForm(page, { button: 'Save Changes' });

	const updated = (await regularExpressionPages.list(page)).find((r) => r.name === GROUP.name);
	expect(updated, `the list should still have ${GROUP.name}`).toBeDefined();
	expect(updated?.pattern, 'the new pattern should be stored').toBe(UPDATED_PATTERN);
	expect(updated?.description, 'the new description should be stored').toBe(UPDATED_DESCRIPTION);
	expect(
		updated?.tags.map((tag) => tag.name),
		'the beta tag should be gone and the new tag stored'
	).toEqual([NEW_TAG]);
});

/**
 * Flow:
 * 1. The user opens Title Regex.
 * 2. The user changes its name and clicks Save Changes.
 * 3. The user opens the regex under its new name.
 *
 * Expects:
 * - the list has the new name with the fixture pattern, and not the old name
 * - every fixture condition that used Title Regex now uses the new name
 */
test('renames a regex and keeps the conditions using it', async ({ page }) => {
	await openEntity(page, 'Regular Expressions', TITLE.name);
	await fillField(page.getByRole('main'), 'Name', RENAMED);
	await saveForm(page, { button: 'Save Changes' });

	const list = await regularExpressionPages.list(page);
	const names = list.map((regex) => regex.name);
	expect(names, 'the list should not have the old name').not.toContain(TITLE.name);
	expect(
		list.find((regex) => regex.name === RENAMED)?.pattern,
		'the new name should keep the fixture pattern'
	).toBe(TITLE.pattern);

	await openEntity(page, 'Regular Expressions', RENAMED);
	const { conditionRefs } = await regularExpressionPages.entity(page);
	expect(
		conditionRefs.map((ref) => `${ref.cfName}/${ref.conditionName}`).sort(),
		'every condition that used the old name should use the new one'
	).toEqual(conditionsUsing(TITLE.name));
});

/**
 * Flow:
 * 1. The user opens Unused Regex and deletes it.
 *
 * Expects:
 * - the list no longer has Unused Regex
 * - every other fixture regex is still there
 */
test('deletes an unused regex', async ({ page }) => {
	await openEntity(page, 'Regular Expressions', UNUSED.name);
	await deleteEntity(page);

	const names = (await regularExpressionPages.list(page)).map((regex) => regex.name);
	expect(names.sort(), 'only the deleted regex should be gone').toEqual(
		fixtures.regularExpressions
			.map((regex) => regex.name)
			.filter((name) => name !== UNUSED.name)
			.sort()
	);
});

/**
 * Flow:
 * 1. The user opens Title Regex, which conditions in several custom formats
 *    use.
 *
 * Expects:
 * - Delete is disabled and says how many custom formats use the regex
 */
test('blocks deleting a regex that custom formats use', async ({ page }) => {
	await openEntity(page, 'Regular Expressions', TITLE.name);
	await expectDeleteBlocked(page, `Referenced by ${formatsUsing(TITLE.name)} custom formats`);
});
