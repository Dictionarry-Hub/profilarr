/**
 * - Protects: every custom format save, General and Conditions, from the form
 *   action through the ops it writes to the cache rebuilt from them.
 * - Conditions cover each kind of stored value: byte counts over 2^32 from
 *   decimal GB, NULL after clearing a size, years, booleans stored as 0 or 1,
 *   a language with its except flag, and patterns joined from their regex.
 * - A custom format that quality profiles score can't be deleted while the
 *   default "Block Referenced Deletes" setting is on.
 */
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '$flows/helpers/core/test.ts';
import { fixture, fixtures } from '$flows/helpers/core/fixtureData.ts';
import {
	chooseOption,
	deleteEntity,
	expectDeleteBlocked,
	fillField,
	saveForm
} from '$flows/helpers/core/forms.ts';
import { newEntity, openEntity, openSidebarPage, openTab } from '$flows/helpers/core/nav.ts';
import { conditionFromFixture, customFormatPages } from '$flows/helpers/entities/customFormats.ts';
import type { ConditionData } from '$shared/pcd/display.ts';

const EVERY_CONDITION = fixture.customFormat('Every Condition');
const TITLE_MATCH = fixture.customFormat('Title Match');
const UNSCORED = fixture.customFormat('Unscored');
const TITLE_REGEX = fixture.regularExpression('Title Regex');
const UNUSED_REGEX = fixture.regularExpression('Unused Regex');

const NEW_NAME = 'Flow Format';
const NEW_DESCRIPTION = "Flow format's description.";
const NEW_TAG = 'flow';
const UPDATED_DESCRIPTION = "Every condition's new description.";
const RENAMED = 'Renamed Match';

/** Type a tag into the Tags box and press Enter */
async function addTag(scope: Locator, tag: string): Promise<void> {
	const tags = scope.getByRole('textbox', { name: 'Tags', exact: true });
	await tags.fill(tag);
	await tags.press('Enter');
}

/** A condition row, named by its condition */
const conditionGroup = (page: Page, name: string) =>
	page.getByRole('main').getByRole('group', { name, exact: true });

/**
 * Add a draft condition, name it, let `fill` set it up inside its row, then
 * confirm it. The row's accessible name follows the condition's name, so the
 * draft is found by its confirm button instead.
 */
async function addCondition(
	page: Page,
	name: string,
	fill: (row: Locator) => Promise<void>
): Promise<void> {
	const main = page.getByRole('main');
	const confirm = page.getByRole('button', { name: 'Confirm condition', exact: true });
	await main.getByRole('button', { name: 'Add Condition', exact: true }).click();
	await expect(
		conditionGroup(page, 'New Condition'),
		'Add Condition should open a New Condition draft'
	).toBeVisible();
	const draft = main.getByRole('group').filter({ has: confirm });
	await fillField(draft, 'Name', name);
	await expect(draft, `The draft should be named ${name}`).toHaveAccessibleName(name);
	await fill(draft);
	await draft.locator(confirm).click();
	await expect(
		conditionGroup(page, name).locator(confirm),
		`${name} should be confirmed`
	).toHaveCount(0);
}

/** The General tab's format and tag names, read beside another tab of the same format */
async function generalOf(page: Page, tabPath: string) {
	const { format } = await customFormatPages.general(
		page,
		tabPath.replace(/\/[a-z]+$/, '/general')
	);
	return { format, tags: format.tags.map((tag) => tag.name) };
}

const byName = <T extends { name: string }>(items: T[]) =>
	[...items].sort((a, b) => a.name.localeCompare(b.name));

/** How many quality profiles score a custom format */
const profilesScoring = (formatName: string) =>
	fixtures.qualityProfiles.filter((profile) =>
		profile.scores.some((score) => score.customFormatName === formatName)
	);

/** A profile's Radarr and Sonarr scores for a custom format, null where unscored */
function expectedProfileRefs(formatName: string) {
	return byName(
		profilesScoring(formatName).map((profile) => {
			const score = (arr: 'radarr' | 'sonarr') =>
				profile.scores.find((s) => s.customFormatName === formatName && s.arrType === arr)?.score ??
				null;
			return { name: profile.name, radarrScore: score('radarr'), sonarrScore: score('sonarr') };
		})
	);
}

/**
 * Flow:
 * 1. The user starts a new custom format, fills Name, turns on Include in
 *    rename, fills Description and adds a tag.
 * 2. The user clicks Create and lands on the Conditions tab.
 * 3. The user adds five conditions, confirming each one:
 *    - Big Size: Size, 4.5 to 120.25 GB
 *    - Years: Year, 2005 to 2025
 *    - No French: Language French, with Except language on
 *    - Title: Release Title Title Regex, with Required on
 *    - Bluray: Source Bluray, with Negate on
 * 4. The user saves and stays on the Conditions tab.
 * 5. The user opens the General tab.
 *
 * Expects:
 * - each condition is stored with its type and exact value, for all Arrs
 * - only the flags turned on are true
 * - include_in_rename is true and the description is stored
 * - the tag is stored
 */
test('creates a custom format with a condition of each value kind', async ({ page }) => {
	await newEntity(page, 'Custom Formats');
	const main = page.getByRole('main');
	await fillField(main, 'Name', NEW_NAME);
	await main.getByRole('switch', { name: 'Include in rename' }).click();
	await fillField(main, 'Description', NEW_DESCRIPTION);
	await addTag(main, NEW_TAG);
	await saveForm(page, { button: 'Create' });
	await expect(
		page.getByRole('navigation', { name: 'Tabs' }).getByRole('button', { name: 'Conditions' }),
		'Create should land on the Conditions tab'
	).toHaveAttribute('aria-current', 'page');

	await addCondition(page, 'Big Size', async (row) => {
		await chooseOption(row, 'Type', 'Size');
		await fillField(row, 'Minimum Size in GB', 4.5);
		await fillField(row, 'Maximum Size in GB', 120.25);
	});
	await addCondition(page, 'Years', async (row) => {
		await chooseOption(row, 'Type', 'Year');
		await fillField(row, 'Minimum Year', 2005);
		await fillField(row, 'Maximum Year', 2025);
	});
	await addCondition(page, 'No French', async (row) => {
		await chooseOption(row, 'Type', 'Language');
		await chooseOption(row, 'Value', 'French');
		await row.getByRole('switch', { name: 'Except language' }).click();
	});
	await addCondition(page, 'Title', async (row) => {
		await chooseOption(row, 'Value', TITLE_REGEX.name);
		await row.getByRole('switch', { name: 'Required' }).click();
	});
	await addCondition(page, 'Bluray', async (row) => {
		await chooseOption(row, 'Type', 'Source');
		await chooseOption(row, 'Value', 'Bluray');
		await row.getByRole('switch', { name: 'Negate' }).click();
	});
	const conditionsPath = new URL(page.url()).pathname;
	await saveForm(page);
	expect(new URL(page.url()).pathname, 'the save should stay on the Conditions tab').toBe(
		conditionsPath
	);

	const flags = { arrType: 'all', negate: false, required: false } as const;
	const expected: ConditionData[] = [
		{
			name: 'Big Size',
			type: 'size',
			...flags,
			size: { minBytes: 4831838208, maxBytes: 129117454336 }
		},
		{ name: 'Years', type: 'year', ...flags, years: { minYear: 2005, maxYear: 2025 } },
		{
			name: 'No French',
			type: 'language',
			...flags,
			languages: [{ name: 'French', except: true }]
		},
		{
			name: 'Title',
			type: 'release_title',
			...flags,
			required: true,
			patterns: [{ name: TITLE_REGEX.name, pattern: TITLE_REGEX.pattern }]
		},
		{ name: 'Bluray', type: 'source', ...flags, negate: true, sources: ['bluray'] }
	];
	const { format, conditions } = await customFormatPages.conditions(page);
	expect(byName(conditions), 'every condition should be stored with its exact value').toEqual(
		byName(expected)
	);
	expect(format.include_in_rename, 'Include in rename should be stored as on').toBe(true);
	expect(format.description, 'the description should be stored').toBe(NEW_DESCRIPTION);

	await openTab(page, 'General');
	const general = await customFormatPages.general(page);
	expect(
		general.format.tags.map((tag) => tag.name),
		'the tag should be stored'
	).toEqual([NEW_TAG]);
});

/**
 * Flow:
 * 1. The user opens Every Condition, changes Description, flips Include in
 *    rename, removes the beta tag, adds a tag and clicks Save Changes.
 * 2. The user opens the Conditions tab.
 * 3. In Size, the user clears Maximum Size in GB.
 * 4. In Resolution, the user sets Type Source and Value WEB-DL.
 * 5. The user removes Indexer Flag.
 * 6. The user adds Flow Group: Release Group Unused Regex, with Sonarr off.
 * 7. The user saves.
 *
 * Expects:
 * - the description, include_in_rename and tags are stored
 * - Size keeps its minimum, and its maximum is null
 * - Resolution is now a source condition for WEB-DL, with the fixture's Arr
 *   type and flags
 * - Indexer Flag is gone
 * - Flow Group is a Radarr-only release group condition on Unused Regex
 * - every other condition equals the fixture
 */
test('updates the general fields and conditions of a custom format', async ({ page }) => {
	await openEntity(page, 'Custom Formats', EVERY_CONDITION.name);
	const main = page.getByRole('main');
	await fillField(main, 'Description', UPDATED_DESCRIPTION);
	await main.getByRole('switch', { name: 'Include in rename' }).click();
	await main
		.getByRole('button', { name: `Remove ${EVERY_CONDITION.tags[0]}`, exact: true })
		.click();
	await addTag(main, NEW_TAG);
	await saveForm(page, { button: 'Save Changes' });

	await openTab(page, 'Conditions');
	await fillField(conditionGroup(page, 'Size'), 'Maximum Size in GB', '');
	const resolution = conditionGroup(page, 'Resolution');
	await chooseOption(resolution, 'Type', 'Source');
	await chooseOption(resolution, 'Value', 'WEB-DL');
	await conditionGroup(page, 'Indexer Flag')
		.getByRole('button', { name: 'Remove condition', exact: true })
		.click();
	await addCondition(page, 'Flow Group', async (row) => {
		await chooseOption(row, 'Type', 'Release Group');
		await chooseOption(row, 'Value', UNUSED_REGEX.name);
		await row.getByRole('switch', { name: 'Sonarr' }).click();
	});
	await saveForm(page);

	const conditionsPath = new URL(page.url()).pathname;
	const { format, tags } = await generalOf(page, conditionsPath);
	expect(format.description, 'the new description should be stored').toBe(UPDATED_DESCRIPTION);
	expect(format.include_in_rename, 'Include in rename should be flipped').toBe(
		!EVERY_CONDITION.includeInRename
	);
	expect(tags, 'the beta tag should be gone and the new tag stored').toEqual([NEW_TAG]);

	const fixtureCondition = (name: string) => {
		const condition = EVERY_CONDITION.conditions.find((c) => c.name === name);
		if (!condition) throw new Error(`Every Condition has no fixture condition ${name}`);
		return condition;
	};
	const size = fixtureCondition('Size');
	const resolutionBefore = fixtureCondition('Resolution');
	const changed = ['Size', 'Resolution', 'Indexer Flag'];
	const expected: ConditionData[] = [
		...EVERY_CONDITION.conditions
			.filter((condition) => !changed.includes(condition.name))
			.map(conditionFromFixture),
		{
			...conditionFromFixture(size),
			size: { minBytes: size.value?.minBytes as number, maxBytes: null }
		},
		{
			name: resolutionBefore.name,
			type: 'source',
			arrType: resolutionBefore.arrType,
			negate: resolutionBefore.negate,
			required: resolutionBefore.required,
			sources: ['web_dl']
		},
		{
			name: 'Flow Group',
			type: 'release_group',
			arrType: 'radarr',
			negate: false,
			required: false,
			patterns: [{ name: UNUSED_REGEX.name, pattern: UNUSED_REGEX.pattern }]
		}
	];
	const { conditions } = await customFormatPages.conditions(page);
	expect(conditions, 'Every Condition should have 11 conditions').toHaveLength(11);
	expect(
		byName(conditions),
		'the edited conditions should be stored and the rest equal the fixture'
	).toEqual(byName(expected));
});

/**
 * Flow:
 * 1. The user opens Title Match, changes its name and clicks Save Changes.
 *
 * Expects:
 * - the format has the new name, and the list no longer has the old one
 * - the same quality profiles score it, with the same scores
 */
test('renames a custom format and keeps the profiles scoring it', async ({ page }) => {
	await openEntity(page, 'Custom Formats', TITLE_MATCH.name);
	await fillField(page.getByRole('main'), 'Name', RENAMED);
	await saveForm(page, { button: 'Save Changes' });

	const { format, profileRefs } = await customFormatPages.general(page);
	expect(format.name, 'the format should have the new name').toBe(RENAMED);
	expect(
		byName(profileRefs).map(({ name, radarrScore, sonarrScore }) => ({
			name,
			radarrScore,
			sonarrScore
		})),
		'the same profiles should score it with the same scores'
	).toEqual(expectedProfileRefs(TITLE_MATCH.name));

	await openSidebarPage(page, 'Custom Formats');
	const names = (await customFormatPages.list(page)).map((f) => f.name);
	expect(names, 'the list should have the new name').toContain(RENAMED);
	expect(names, 'the list should not have the old name').not.toContain(TITLE_MATCH.name);
});

/**
 * Flow:
 * 1. The user opens Unscored and deletes it.
 *
 * Expects:
 * - the list no longer has Unscored
 * - every other fixture custom format is still there
 */
test('deletes an unscored custom format', async ({ page }) => {
	await openEntity(page, 'Custom Formats', UNSCORED.name);
	await deleteEntity(page);

	const names = (await customFormatPages.list(page)).map((format) => format.name);
	expect(names.sort(), 'only the deleted custom format should be gone').toEqual(
		fixtures.customFormats
			.map((format) => format.name)
			.filter((name) => name !== UNSCORED.name)
			.sort()
	);
});

/**
 * Flow:
 * 1. The user opens Title Match, which quality profiles score.
 *
 * Expects:
 * - Delete is disabled and says how many quality profiles score it
 */
test('blocks deleting a custom format that profiles score', async ({ page }) => {
	await openEntity(page, 'Custom Formats', TITLE_MATCH.name);
	await expectDeleteBlocked(
		page,
		`Referenced by ${profilesScoring(TITLE_MATCH.name).length} quality profiles`
	);
});
