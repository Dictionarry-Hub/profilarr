/**
 * - Protects: every delay profile save, from the form action through the op
 *   it writes to the cache rebuilt from it, read back through the list page.
 * - The values cover NULL delays and scores for the protocol a profile
 *   doesn't use, delays entered in hours and stored in minutes, and booleans
 *   stored as 0 or 1.
 */
import { test, expect } from '$flows/helpers/core/test.ts';
import { fixture, fixtures, type FixtureDelayProfile } from '$flows/helpers/core/fixtureData.ts';
import { chooseOption, deleteEntity, fillField, saveForm } from '$flows/helpers/core/forms.ts';
import { newEntity, openEntity } from '$flows/helpers/core/nav.ts';
import { delayProfilePages } from '$flows/helpers/entities/delayProfiles.ts';
import type { DelayProfilesRow } from '$shared/pcd/display.ts';
import type { Page } from '@playwright/test';

const PREFER_USENET = fixture.delayProfile('Prefer Usenet');
const TORRENT_ONLY = fixture.delayProfile('Torrent Only');
const BYPASS_SCORE = fixture.delayProfile('Bypass Score');

const NEW_NAME = 'Flow Delay';
const RENAMED = 'Renamed Torrent Only';

/** A stored delay profile's fields, in the fixtures' shape */
function asFixture(row: DelayProfilesRow): FixtureDelayProfile {
	return {
		name: row.name,
		preferredProtocol: row.preferred_protocol,
		usenetDelay: row.usenet_delay,
		torrentDelay: row.torrent_delay,
		bypassIfHighestQuality: row.bypass_if_highest_quality,
		bypassIfAboveCustomFormatScore: row.bypass_if_above_custom_format_score,
		minimumCustomFormatScore: row.minimum_custom_format_score
	};
}

/** Every stored delay profile by name, read from the list page */
async function storedProfiles(page: Page): Promise<Map<string, FixtureDelayProfile>> {
	const rows = await delayProfilePages.list(page);
	return new Map(rows.map((row) => [row.name, asFixture(row)]));
}

/**
 * Flow:
 * 1. The user starts a new delay profile and fills Name.
 * 2. The user chooses Only Torrent and shows delays in hours.
 * 3. The user sets Torrent Delay to 3 hours and turns on Bypass if Highest
 *    Quality.
 * 4. The user clicks Create Profile and lands on the list.
 *
 * Expects:
 * - the protocol is only_torrent
 * - the Usenet delay is null, and the torrent delay is 180 minutes
 * - bypass if highest quality is true
 * - the minimum custom format score is null
 */
test('creates a torrent-only profile with its delay in hours', async ({ page }) => {
	await newEntity(page, 'Delay Profiles');
	const main = page.getByRole('main');
	await fillField(main, 'Name', NEW_NAME);
	await chooseOption(main, 'Protocol Preference', 'Only Torrent');
	await chooseOption(main, 'Delay Unit', 'Hours', { shows: 'Show in hours' });
	await fillField(main, 'Torrent Delay (hours)', 3);
	await main.getByRole('switch', { name: 'Bypass if Highest Quality' }).click();
	await saveForm(page, { button: 'Create Profile' });

	expect(
		(await storedProfiles(page)).get(NEW_NAME),
		'the new profile should be stored with a null Usenet delay and minutes for torrents'
	).toEqual({
		name: NEW_NAME,
		preferredProtocol: 'only_torrent',
		usenetDelay: null,
		torrentDelay: 180,
		bypassIfHighestQuality: true,
		bypassIfAboveCustomFormatScore: false,
		minimumCustomFormatScore: null
	});
});

/**
 * Flow:
 * 1. The user opens Prefer Usenet, which shows its delays in hours.
 * 2. The user chooses Only Usenet.
 * 3. The user turns on Bypass if Above Custom Format Score and sets the
 *    minimum score to 250.
 * 4. The user clicks Save Changes and lands on the list.
 *
 * Expects:
 * - the protocol is only_usenet
 * - the Usenet delay is still 60 minutes, and the torrent delay is null
 * - bypass if above custom format score is true, with a minimum of 250
 * - bypass if highest quality matches the fixture
 */
test('updates a profile to Usenet only with a score bypass', async ({ page }) => {
	await openEntity(page, 'Delay Profiles', PREFER_USENET.name);
	const main = page.getByRole('main');
	await chooseOption(main, 'Protocol Preference', 'Only Usenet');
	await main.getByRole('switch', { name: 'Bypass if Above Custom Format Score' }).click();
	await fillField(main, 'Minimum Custom Format Score', 250);
	await saveForm(page, { button: 'Save Changes' });

	expect(
		(await storedProfiles(page)).get(PREFER_USENET.name),
		'the profile should be stored as Usenet only with a null torrent delay'
	).toEqual({
		...PREFER_USENET,
		preferredProtocol: 'only_usenet',
		usenetDelay: 60,
		torrentDelay: null,
		bypassIfAboveCustomFormatScore: true,
		minimumCustomFormatScore: 250
	});
});

/**
 * Flow:
 * 1. The user opens Torrent Only, changes its name and clicks Save Changes.
 *
 * Expects:
 * - the list has the new name, and not the old one
 * - the Usenet delay is still null, and every other field matches the fixture
 */
test('renames a profile and keeps its delays', async ({ page }) => {
	await openEntity(page, 'Delay Profiles', TORRENT_ONLY.name);
	await fillField(page.getByRole('main'), 'Name', RENAMED);
	await saveForm(page, { button: 'Save Changes' });

	const stored = await storedProfiles(page);
	expect(stored.has(TORRENT_ONLY.name), 'the list should not have the old name').toBe(false);
	expect(stored.get(RENAMED), 'the new name should keep the fixture fields').toEqual({
		...TORRENT_ONLY,
		name: RENAMED
	});
	expect(stored.get(RENAMED)?.usenetDelay, 'the Usenet delay should still be null').toBe(null);
});

/**
 * Flow:
 * 1. The user opens Bypass Score and deletes it.
 *
 * Expects:
 * - the list no longer has Bypass Score
 * - every other fixture profile is still there
 */
test('deletes a delay profile', async ({ page }) => {
	await openEntity(page, 'Delay Profiles', BYPASS_SCORE.name);
	await deleteEntity(page);

	const names = [...(await storedProfiles(page)).keys()];
	expect(names.sort(), 'only the deleted profile should be gone').toEqual(
		fixtures.delayProfiles
			.map((profile) => profile.name)
			.filter((name) => name !== BYPASS_SCORE.name)
			.sort()
	);
});
