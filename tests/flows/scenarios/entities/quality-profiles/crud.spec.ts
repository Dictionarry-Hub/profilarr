/**
 * - Protects: every quality profile save, General, Scoring and Qualities, from
 *   the form actions through the ops they write to the cache rebuilt from
 *   them.
 * - Each tab saves on its own, so each test saves a tab before opening the
 *   next one.
 * - Scores cover negative numbers, zero and unscored (NULL) Arr types. The
 *   profile fields cover a boolean stored as 0 or 1. Qualities cover groups,
 *   order, enabled and upgrade-until.
 */
import type { Locator, Page } from '@playwright/test';
import { test, expect } from '$flows/helpers/core/test.ts';
import { fixture, fixtures, type FixtureQuality } from '$flows/helpers/core/fixtureData.ts';
import { chooseOption, deleteEntity, fillField, saveForm } from '$flows/helpers/core/forms.ts';
import { newEntity, openEntity, openTab } from '$flows/helpers/core/nav.ts';
import { setScreen } from '$flows/helpers/core/screen.ts';
import { customFormatPages } from '$flows/helpers/entities/customFormats.ts';
import { qualityProfilePages } from '$flows/helpers/entities/qualityProfiles.ts';
import type { OrderedItem, QualityProfileScoring } from '$shared/pcd/display.ts';

const RADARR_PROFILE = fixture.qualityProfile('Radarr Profile');
const SONARR_PROFILE = fixture.qualityProfile('Sonarr Profile');
const SHARED_SCORES = fixture.qualityProfile('Shared Scores');
const TITLE_MATCH = fixture.customFormat('Title Match');
const HAS_TESTS = fixture.customFormat('Has Tests');
const EVERY_CONDITION = fixture.customFormat('Every Condition');
const UNSCORED = fixture.customFormat('Unscored');

const NEW_NAME = 'Flow Profile';
const NEW_DESCRIPTION = "Flow profile's description.";
const NEW_TAG = 'flow';
const NEW_GROUP = 'Flow 2160p';
const UPDATED_DESCRIPTION = "Sonarr profile's new description.";
const RENAMED = 'Renamed Radarr Profile';

type Scores = Record<string, { radarr: number | null; sonarr: number | null }>;

/** Type a tag into the Tags box and press Enter */
async function addTag(scope: Locator, tag: string): Promise<void> {
	const tags = scope.getByRole('textbox', { name: 'Tags', exact: true });
	await tags.fill(tag);
	await tags.press('Enter');
}

/** Click a checkbox or switch by its name */
async function click(scope: Locator, role: 'checkbox' | 'switch', name: string): Promise<void> {
	await scope.getByRole(role, { name, exact: true }).click();
}

/** Every custom format's Radarr and Sonarr score, from the Scoring reader */
function storedScores(scoring: QualityProfileScoring): Scores {
	return Object.fromEntries(
		scoring.customFormats.map((format) => [
			format.name,
			{ radarr: format.scores.radarr ?? null, sonarr: format.scores.sonarr ?? null }
		])
	);
}

/** Every fixture custom format's scores in a fixture profile, null where unscored */
function fixtureScores(profileName: string): Scores {
	const profile = fixture.qualityProfile(profileName);
	const score = (formatName: string, arr: 'radarr' | 'sonarr') =>
		profile.scores.find(
			(s) => s.customFormatName === formatName && (s.arrType === arr || s.arrType === 'all')
		)?.score ?? null;
	return Object.fromEntries(
		fixtures.customFormats.map((format) => [
			format.name,
			{ radarr: score(format.name, 'radarr'), sonarr: score(format.name, 'sonarr') }
		])
	);
}

/** Ordered items in the fixtures' shape: name, flags and member names */
function asFixtureQualities(items: OrderedItem[]): FixtureQuality[] {
	return items.map((item) => ({
		name: item.name,
		enabled: item.enabled,
		upgradeUntil: item.upgradeUntil,
		...(item.members ? { members: item.members.map((member) => member.name) } : {})
	}));
}

/** Another tab of the profile whose General, Scoring or Qualities tab is open */
const tabPath = (page: Page, tab: 'general' | 'scoring' | 'qualities') =>
	new URL(page.url()).pathname.replace(/\/[a-z]+$/, `/${tab}`);

/** A quality card on the Qualities tab */
const qualityCard = (page: Page, name: string) =>
	page.getByRole('main').getByRole('button', { name, exact: true });

/**
 * Flow:
 * 1. The user starts a new quality profile, fills Name and Description, adds
 *    a tag, chooses English and clicks Create. The page lands on Scoring.
 * 2. On Scoring, the user enables and scores four custom formats, including a
 *    negative score and a zero, sets the three profile scores and turns off
 *    Upgrades allowed, then saves.
 * 3. On Qualities, the user disables Remux-1080p, groups Bluray-2160p and
 *    WEBDL-2160p as Flow 2160p, makes the group upgrade-until, disables
 *    Bluray-1080p, enables HDTV-1080p and moves HDTV-1080p up to where WEB
 *    1080p started, then saves.
 *
 * Expects:
 * - each score is stored for its Arr, and unscored Arrs are null
 * - upgrades_allowed is false and the three profile scores are stored
 * - the description, tag and language are stored
 * - Flow 2160p holds its two members, which are no longer items of their own
 * - Flow 2160p is the only upgrade-until item
 * - the enabled flags match the clicks
 * - HDTV-1080p sits where WEB 1080p started, with WEB 1080p right after it
 * - every quality appears once, as an item or as a group member
 */
test('creates a quality profile across General, Scoring and Qualities', async ({ page }) => {
	await newEntity(page, 'Quality Profiles');
	const main = page.getByRole('main');
	await fillField(main, 'Name', NEW_NAME);
	await fillField(main, 'Description', NEW_DESCRIPTION);
	await addTag(main, NEW_TAG);
	await chooseOption(main, 'Language', 'English');
	await saveForm(page, { button: 'Create' });
	await expect(page, 'Create should land on the Scoring tab').toHaveURL((url) =>
		url.pathname.endsWith('/scoring')
	);

	await click(main, 'checkbox', `${TITLE_MATCH.name} Radarr enabled`);
	await fillField(main, `${TITLE_MATCH.name} Radarr score`, 150);
	await click(main, 'checkbox', `${TITLE_MATCH.name} Sonarr enabled`);
	await fillField(main, `${TITLE_MATCH.name} Sonarr score`, 150);
	await click(main, 'checkbox', `${HAS_TESTS.name} Radarr enabled`);
	await fillField(main, `${HAS_TESTS.name} Radarr score`, -75);
	await click(main, 'checkbox', `${EVERY_CONDITION.name} Sonarr enabled`);
	await fillField(main, `${EVERY_CONDITION.name} Sonarr score`, 400);
	await click(main, 'checkbox', `${UNSCORED.name} Radarr enabled`);
	await fillField(main, 'Minimum Score', -20);
	await fillField(main, 'Upgrade Until Score', 900);
	await fillField(main, 'Upgrade Score Increment', 5);
	await click(main, 'switch', 'Upgrades allowed');
	await saveForm(page);

	await openTab(page, 'Qualities');
	const start = (await qualityProfilePages.qualities(page)).orderedItems.map((item) => item.name);
	await click(main, 'checkbox', 'Remux-1080p Enabled');
	await main.getByRole('button', { name: 'Create Group', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Create Group' });
	await fillField(dialog, 'Group Name', NEW_GROUP);
	await dialog.getByRole('checkbox', { name: 'Select Bluray-2160p', exact: true }).click();
	await dialog.getByRole('checkbox', { name: 'Select WEBDL-2160p', exact: true }).click();
	await dialog.getByRole('button', { name: 'Create Group', exact: true }).click();
	await expect(dialog, 'Create Group should close the dialog').toHaveCount(0);
	await click(main, 'checkbox', `${NEW_GROUP} Upgrade Until`);
	await click(main, 'checkbox', 'Bluray-1080p Enabled');
	await click(main, 'checkbox', 'HDTV-1080p Enabled');

	// The group took the place of its two members, so WEB 1080p moved up by
	// one item less than the members before it
	const grouped = ['Bluray-2160p', 'WEBDL-2160p'];
	const webIndex = start.indexOf('WEB 1080p');
	const groupedBefore = grouped.filter((name) => start.indexOf(name) < webIndex).length;
	const webNow = webIndex - (groupedBefore > 0 ? groupedBefore - 1 : 0);
	const moves = start.indexOf('HDTV-1080p') - webIndex;
	await setScreen(page, 'mobile');
	for (let i = 0; i < moves; i++) {
		await main.getByRole('button', { name: 'Move HDTV-1080p up', exact: true }).click();
	}
	await saveForm(page);

	const scoring = await qualityProfilePages.scoring(page, tabPath(page, 'scoring'));
	expect(storedScores(scoring), 'each score should be stored for its Arr').toEqual({
		[TITLE_MATCH.name]: { radarr: 150, sonarr: 150 },
		[HAS_TESTS.name]: { radarr: -75, sonarr: null },
		[EVERY_CONDITION.name]: { radarr: null, sonarr: 400 },
		[UNSCORED.name]: { radarr: 0, sonarr: null }
	});
	expect(
		{
			upgrades_allowed: scoring.upgrades_allowed,
			minimum_custom_format_score: scoring.minimum_custom_format_score,
			upgrade_until_score: scoring.upgrade_until_score,
			upgrade_score_increment: scoring.upgrade_score_increment
		},
		'the profile scores should be stored, with upgrades off'
	).toEqual({
		upgrades_allowed: false,
		minimum_custom_format_score: -20,
		upgrade_until_score: 900,
		upgrade_score_increment: 5
	});

	const general = await qualityProfilePages.general(page, tabPath(page, 'general'));
	expect(general.description, 'the description should be stored').toBe(NEW_DESCRIPTION);
	expect(
		general.tags.map((tag) => tag.name),
		'the tag should be stored'
	).toEqual([NEW_TAG]);
	expect(general.language, 'the language should be stored').toBe('English');

	const { orderedItems, allQualities } = await qualityProfilePages.qualities(page);
	const items = asFixtureQualities(orderedItems);
	const names = items.map((item) => item.name);
	expect(
		items.find((item) => item.name === NEW_GROUP),
		'Flow 2160p should hold its two members, enabled and upgrade-until'
	).toEqual({ name: NEW_GROUP, enabled: true, upgradeUntil: true, members: grouped });
	expect(
		names.filter((name) => grouped.includes(name)),
		'the grouped qualities should not be items of their own'
	).toEqual([]);
	expect(
		items.filter((item) => item.upgradeUntil).map((item) => item.name),
		'Flow 2160p should be the only upgrade-until item'
	).toEqual([NEW_GROUP]);
	const enabled = (name: string) => items.find((item) => item.name === name)?.enabled;
	expect(
		{
			[NEW_GROUP]: enabled(NEW_GROUP),
			'HDTV-1080p': enabled('HDTV-1080p'),
			'Remux-1080p': enabled('Remux-1080p'),
			'Bluray-1080p': enabled('Bluray-1080p')
		},
		'the enabled flags should match the clicks'
	).toEqual({
		[NEW_GROUP]: true,
		'HDTV-1080p': true,
		'Remux-1080p': false,
		'Bluray-1080p': false
	});
	expect(
		names.slice(webNow, webNow + 2),
		'HDTV-1080p should sit where WEB 1080p started, with WEB 1080p right after it'
	).toEqual(['HDTV-1080p', 'WEB 1080p']);
	expect(
		items.flatMap((item) => item.members ?? [item.name]).sort(),
		'every quality should appear once, as an item or a member'
	).toEqual(allQualities.map((quality) => quality.name).sort());
});

/**
 * Flow:
 * 1. The user opens Sonarr Profile, changes Description, removes the beta
 *    tag, adds a tag, chooses French and saves General.
 * 2. On Scoring, the user sets a negative Sonarr score for Every Condition,
 *    moves Title Match from Sonarr to Radarr, turns on Upgrades allowed, sets
 *    the three profile scores and saves.
 * 3. On Qualities, the user adds HDTV-1080p to the WEB 1080p group, makes
 *    Bluray-1080p upgrade-until, enables Remux-1080p, disables WEB 1080p,
 *    moves Bluray-1080p up one place and saves.
 *
 * Expects:
 * - the description, tags and language are stored
 * - Every Condition is -150 for Sonarr only, Title Match is 60 for Radarr
 *   only, and the other formats stay unscored
 * - upgrades_allowed is true and the three profile scores are stored
 * - the qualities equal the fixture with only those changes
 */
test('updates a quality profile across General, Scoring and Qualities', async ({ page }) => {
	await openEntity(page, 'Quality Profiles', SONARR_PROFILE.name);
	const main = page.getByRole('main');
	await fillField(main, 'Description', UPDATED_DESCRIPTION);
	await main.getByRole('button', { name: `Remove ${SONARR_PROFILE.tags[0]}`, exact: true }).click();
	await addTag(main, NEW_TAG);
	await chooseOption(main, 'Language', 'French');
	await saveForm(page);

	await openTab(page, 'Scoring');
	await fillField(main, `${EVERY_CONDITION.name} Sonarr score`, -150);
	await click(main, 'checkbox', `${TITLE_MATCH.name} Sonarr enabled`);
	await click(main, 'checkbox', `${TITLE_MATCH.name} Radarr enabled`);
	await fillField(main, `${TITLE_MATCH.name} Radarr score`, 60);
	await click(main, 'switch', 'Upgrades allowed');
	await fillField(main, 'Minimum Score', 50);
	await fillField(main, 'Upgrade Until Score', 1200);
	await fillField(main, 'Upgrade Score Increment', 10);
	await saveForm(page);

	await openTab(page, 'Qualities');
	await setScreen(page, 'mobile');
	await qualityCard(page, 'WEB 1080p')
		.getByRole('button', { name: 'Edit group', exact: true })
		.click();
	const dialog = page.getByRole('dialog', { name: 'Edit Group' });
	await dialog.getByRole('checkbox', { name: 'Select HDTV-1080p', exact: true }).click();
	await dialog.getByRole('button', { name: 'Save Group', exact: true }).click();
	await expect(dialog, 'Save Group should close the dialog').toHaveCount(0);
	await click(main, 'checkbox', 'Bluray-1080p Upgrade Until');
	await click(main, 'checkbox', 'Remux-1080p Enabled');
	await click(main, 'checkbox', 'WEB 1080p Enabled');
	await main.getByRole('button', { name: 'Move Bluray-1080p up', exact: true }).click();
	await saveForm(page);

	const general = await qualityProfilePages.general(page, tabPath(page, 'general'));
	expect(general.description, 'the new description should be stored').toBe(UPDATED_DESCRIPTION);
	expect(
		general.tags.map((tag) => tag.name),
		'the beta tag should be gone and the new tag stored'
	).toEqual([NEW_TAG]);
	expect(general.language, 'the language should be stored').toBe('French');

	const scoring = await qualityProfilePages.scoring(page, tabPath(page, 'scoring'));
	expect(storedScores(scoring), 'only the changed scores should differ').toEqual({
		...fixtureScores(SONARR_PROFILE.name),
		[EVERY_CONDITION.name]: { radarr: null, sonarr: -150 },
		[TITLE_MATCH.name]: { radarr: 60, sonarr: null }
	});
	expect(
		{
			upgrades_allowed: scoring.upgrades_allowed,
			minimum_custom_format_score: scoring.minimum_custom_format_score,
			upgrade_until_score: scoring.upgrade_until_score,
			upgrade_score_increment: scoring.upgrade_score_increment
		},
		'the profile scores should be stored, with upgrades on'
	).toEqual({
		upgrades_allowed: true,
		minimum_custom_format_score: 50,
		upgrade_until_score: 1200,
		upgrade_score_increment: 10
	});

	const expected = SONARR_PROFILE.qualities
		.filter((quality) => quality.name !== 'HDTV-1080p')
		.map((quality): FixtureQuality => {
			switch (quality.name) {
				case 'WEB 1080p':
					return {
						...quality,
						enabled: false,
						upgradeUntil: false,
						members: [...(quality.members ?? []), 'HDTV-1080p']
					};
				case 'Bluray-1080p':
					return { ...quality, enabled: true, upgradeUntil: true };
				case 'Remux-1080p':
					return { ...quality, enabled: true };
				default:
					return quality;
			}
		});
	const bluray = expected.findIndex((quality) => quality.name === 'Bluray-1080p');
	expected.splice(bluray - 1, 0, ...expected.splice(bluray, 1));
	const { orderedItems } = await qualityProfilePages.qualities(page);
	expect(
		asFixtureQualities(orderedItems),
		'the qualities should equal the fixture with only the changes made'
	).toEqual(expected);
});

/**
 * Flow:
 * 1. The user opens Radarr Profile, changes its name and saves.
 *
 * Expects:
 * - General has the new name, with the fixture tags and language
 * - Scoring has the fixture scores
 * - Qualities lists the fixture items in the fixture order
 */
test('renames a quality profile and keeps its scores and qualities', async ({ page }) => {
	await openEntity(page, 'Quality Profiles', RADARR_PROFILE.name);
	await fillField(page.getByRole('main'), 'Name', RENAMED);
	await saveForm(page);

	const general = await qualityProfilePages.general(page, tabPath(page, 'general'));
	expect(general.name, 'the profile should have the new name').toBe(RENAMED);
	expect(
		general.tags.map((tag) => tag.name),
		'the fixture tags should stay'
	).toEqual(RADARR_PROFILE.tags);
	expect(general.language, 'the fixture language should stay').toBe(
		RADARR_PROFILE.language?.languageName ?? null
	);

	const scoring = await qualityProfilePages.scoring(page, tabPath(page, 'scoring'));
	expect(storedScores(scoring), 'the fixture scores should stay').toEqual(
		fixtureScores(RADARR_PROFILE.name)
	);

	const { orderedItems } = await qualityProfilePages.qualities(page, tabPath(page, 'qualities'));
	expect(
		asFixtureQualities(orderedItems),
		'the fixture qualities should stay in the fixture order'
	).toEqual(RADARR_PROFILE.qualities);
});

/**
 * Flow:
 * 1. The user opens Shared Scores and deletes it.
 * 2. The user opens the custom format Title Match.
 *
 * Expects:
 * - the list no longer has Shared Scores
 * - every other fixture profile is still there
 * - Title Match is scored by one profile fewer
 */
test('deletes a quality profile and its scores', async ({ page }) => {
	await openEntity(page, 'Quality Profiles', SHARED_SCORES.name);
	await deleteEntity(page);

	const names = (await qualityProfilePages.list(page)).map((profile) => profile.name);
	expect(names.sort(), 'only the deleted profile should be gone').toEqual(
		fixtures.qualityProfiles
			.map((profile) => profile.name)
			.filter((name) => name !== SHARED_SCORES.name)
			.sort()
	);

	await openEntity(page, 'Custom Formats', TITLE_MATCH.name);
	const { profileRefs } = await customFormatPages.general(page);
	const scoringBefore = fixtures.qualityProfiles.filter((profile) =>
		profile.scores.some((score) => score.customFormatName === TITLE_MATCH.name)
	);
	expect(profileRefs, 'Title Match should be scored by one profile fewer').toHaveLength(
		scoringBefore.length - 1
	);
});
