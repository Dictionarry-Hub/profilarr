/**
 * - Protects: a database developer's change reaching a second install's Arr:
 *   a draft syncs to the developer's own Radarr, publishing pushes it
 *   upstream, and the user's pull brings it in and syncs it On Pull, with
 *   the user's own score kept on top.
 * - Two installs: `app` is the developer's, `consumer` the user's, which
 *   pulls from the same upstream. The user works in a second tab at absolute
 *   `consumer.url` paths, since relative ones reach `app`.
 * - Two Radarrs, one per install. Login off.
 */
import type { Page } from '@playwright/test';
import { test, expect, FIXTURES_NAME } from '#flows/helpers/core/test.ts';
import { fixture } from '#flows/helpers/core/fixtureData.ts';
import { latestJobRunId, waitForIdleJobs, waitForNextJobRun } from '#flows/helpers/core/jobs.ts';
import { openDatabase, openPage, openTab } from '#flows/helpers/core/nav.ts';
import { qualityProfilePages, setProfileScores } from '#flows/helpers/entities/qualityProfiles.ts';
import { conflictsPage } from '#flows/helpers/git/conflicts.ts';
import { publishChanges, pullDatabase, setDeveloperAccess } from '#flows/helpers/git/databases.ts';
import { upstream } from '#flows/helpers/git/upstream.ts';
import { openArr } from '#flows/helpers/sync/arrs.ts';
import { expectedProfileSettings, expectedScores } from '#flows/helpers/sync/expected.ts';
import type { FakeArr, Resource } from '#flows/helpers/sync/fakeArr.ts';
import {
	addArrAndOpenSync,
	chooseDelayProfile,
	chooseMediaManagement,
	chooseQualityProfiles,
	setTrigger,
	setUpProfileSync,
	syncConfig,
	syncSection,
	type SyncSection
} from '#flows/helpers/sync/sync.ts';

const HOME = 'Home Radarr';
const DEV = 'Dev Radarr';
const PROFILE = fixture.qualityProfile('Radarr Profile');
const TITLE_MATCH = fixture.customFormat('Title Match');
const HAS_TESTS = fixture.customFormat('Has Tests');
const SCORES = expectedScores(PROFILE, 'radarr');

/** The user's own Has Tests score, and the developer's Title Match score and minimum */
const USER_HAS_TESTS = SCORES[HAS_TESTS.name] * 2;
const DEV_TITLE_MATCH = SCORES[TITLE_MATCH.name] + 75;
const DEV_MINIMUM = PROFILE.minimumCustomFormatScore + 10;
const MESSAGE = 'Raise Title Match for Radarr';

const SECTIONS: SyncSection[] = ['Media Management', 'Delay Profiles', 'Quality Profiles'];

/** The profile a Radarr holds */
function heldProfile(fake: FakeArr): Resource {
	const profile = fake.collection('qualityprofile').find((p) => p.name === PROFILE.name);
	if (!profile) throw new Error(`Radarr holds no quality profile "${PROFILE.name}"`);
	return profile;
}

/** The format scores a Radarr's profile holds, by format name */
function heldScores(fake: FakeArr): Record<string, number> {
	const items = heldProfile(fake).formatItems as { name: string; score: number }[];
	return Object.fromEntries(items.map((item) => [item.name, item.score]));
}

/** The held profile without its ids or the Has Tests score, which only the user changed */
function sharedPart(fake: FakeArr): Record<string, unknown> {
	const { id: _id, formatItems, ...rest } = heldProfile(fake);
	const items = (formatItems as { name: string; format: number }[])
		.filter((item) => item.name !== HAS_TESTS.name)
		.map(({ format: _format, ...item }) => item);
	return { ...rest, formatItems: items };
}

/** Requests that change something in a Radarr, from the `from`-th on */
function writesSince(fake: FakeArr, from: number): string[] {
	return fake.requests
		.slice(from)
		.filter((request) => request.method !== 'GET')
		.map((request) => `${request.method} ${request.path}`);
}

/** The open Arr's id, from its page's URL */
function arrIdOf(page: Page): number {
	const id = Number(new URL(page.url()).pathname.match(/^\/arr\/(\d+)\//)?.[1]);
	if (!id) throw new Error(`Expected an Arr's page, not ${new URL(page.url()).pathname}`);
	return id;
}

/** The stored scores the story changes, from the profile's Scoring tab */
async function storedScores(page: Page, scoringPath: string) {
	const scoring = await qualityProfilePages.scoring(page, scoringPath);
	const radarr = (name: string) =>
		scoring.customFormats.find((format) => format.name === name)?.scores.radarr;
	return {
		titleMatch: radarr(TITLE_MATCH.name),
		hasTests: radarr(HAS_TESTS.name),
		minimum: scoring.minimum_custom_format_score
	};
}

/**
 * Flow:
 * 1. On the second install, the user connects Home Radarr, chooses Media
 *    Management, a delay profile and Radarr Profile with Quality Profiles on
 *    On Pull, and syncs each section.
 * 2. The user lowers Has Tests' Radarr score and syncs Quality Profiles.
 * 3. On the first install, the developer turns on developer access,
 *    connects Dev Radarr for Radarr Profile, raises Title Match's Radarr
 *    score and the minimum score as a draft, and syncs Quality Profiles.
 * 4. The developer publishes the draft.
 * 5. The user pulls on the second install.
 * 6. The second install restarts.
 *
 * Expects:
 * - the draft reaches Dev Radarr before it is published, and nothing
 *   reaches upstream or Home Radarr until then
 * - the published op holds the new score
 * - the pull syncs Home Radarr On Pull with the developer's change and the
 *   user's own score, matching Dev Radarr apart from that score, with no
 *   conflict
 * - the scores and the On Pull trigger survive the restart, nothing is left
 *   to pull, and Home Radarr gets no writes from it
 */
test("a developer's published change reaches a second install's Radarr", async ({
	app,
	consumer,
	page,
	context,
	startArr
}) => {
	test.setTimeout(120_000);
	const homeRadarr = await startArr('radarr-6');
	const devRadarr = await startArr('radarr-6');
	const userPage = await context.newPage();
	let homeId = 0;
	let scoringPath = '';
	let homeFrom = 0;
	let filename: string | undefined;

	await test.step('1. The user follows pulls (consumer)', async () => {
		await openPage(userPage, consumer.url);
		await addArrAndOpenSync(userPage, homeRadarr, HOME);
		homeId = arrIdOf(userPage);
		await chooseMediaManagement(userPage, homeRadarr);
		await chooseDelayProfile(userPage);
		await setTrigger(userPage, 'Quality Profiles', 'On Pull');
		await chooseQualityProfiles(userPage, homeRadarr, [PROFILE.name]);
		for (const section of SECTIONS) {
			expect((await syncSection(userPage, section)).status, `${section} should sync`).toBe('idle');
		}
		expect(heldScores(homeRadarr), 'Home Radarr should hold the fixture scores').toMatchObject(
			SCORES
		);
		expect(heldProfile(homeRadarr), 'Home Radarr should hold the fixture settings').toMatchObject(
			expectedProfileSettings(PROFILE)
		);
	});

	await test.step('2. The user tweaks a score (consumer)', async () => {
		await setProfileScores(userPage, PROFILE.name, [
			{ format: HAS_TESTS.name, arr: 'Radarr', score: USER_HAS_TESTS }
		]);
		scoringPath = new URL(userPage.url()).pathname;
		await openArr(userPage, HOME);
		await openTab(userPage, 'Sync');
		expect(
			(await syncSection(userPage, 'Quality Profiles')).status,
			'The sync should succeed'
		).toBe('idle');
		expect(heldScores(homeRadarr)[HAS_TESTS.name], "Home Radarr should hold the user's score").toBe(
			USER_HAS_TESTS
		);
	});

	await test.step('3. The developer tries a change (app)', async () => {
		homeFrom = homeRadarr.requests.length;
		const head = upstream(app).log()[0];
		await setDeveloperAccess(page);
		await setUpProfileSync(page, devRadarr, { name: DEV, profiles: [PROFILE.name] });
		await setProfileScores(
			page,
			PROFILE.name,
			[{ format: TITLE_MATCH.name, arr: 'Radarr', score: DEV_TITLE_MATCH }],
			{ minimumScore: DEV_MINIMUM }
		);
		await openArr(page, DEV);
		await openTab(page, 'Sync');
		expect((await syncSection(page, 'Quality Profiles')).status, 'The sync should succeed').toBe(
			'idle'
		);

		expect(
			{
				titleMatch: heldScores(devRadarr)[TITLE_MATCH.name],
				minimum: heldProfile(devRadarr).minFormatScore
			},
			'Dev Radarr should hold the draft'
		).toEqual({ titleMatch: DEV_TITLE_MATCH, minimum: DEV_MINIMUM });
		await openDatabase(page, FIXTURES_NAME);
		await expect(
			page
				.getByRole('main')
				.getByRole('checkbox', { name: `Select ${PROFILE.name}`, exact: true })
				.first(),
			`Changes should list a draft for ${PROFILE.name}`
		).toBeVisible();
		expect(upstream(app).log()[0], 'Nothing should be published yet').toEqual(head);
		expect(writesSince(homeRadarr, homeFrom), 'Home Radarr should be untouched').toEqual([]);
	});

	await test.step('4. Publish (app)', async () => {
		filename = await publishChanges(page, MESSAGE, { rows: [PROFILE.name] });
		const origin = upstream(app);
		expect(origin.log()[0].subject, "The upstream's newest commit should be the publish").toBe(
			MESSAGE
		);
		expect(filename, 'The publish should name its op file').toBeTruthy();
		expect(origin.show(`ops/${filename}`), 'The op file should hold the new score').toContain(
			String(DEV_TITLE_MATCH)
		);
	});

	await test.step('5. The user pulls (consumer)', async () => {
		await openDatabase(userPage, FIXTURES_NAME);
		const lastSync = await latestJobRunId(userPage, 'arr.sync.qualityProfiles');
		await pullDatabase(userPage);
		const run = await waitForNextJobRun(userPage, 'arr.sync.qualityProfiles', {
			afterId: lastSync
		});
		expect(run.status, 'The On Pull sync should succeed').toBe('success');

		const expected = {
			titleMatch: DEV_TITLE_MATCH,
			hasTests: USER_HAS_TESTS,
			minimum: DEV_MINIMUM
		};
		expect(
			await storedScores(userPage, scoringPath),
			"Scoring should show the developer's change and the user's score"
		).toEqual(expected);
		expect(
			{
				titleMatch: heldScores(homeRadarr)[TITLE_MATCH.name],
				hasTests: heldScores(homeRadarr)[HAS_TESTS.name],
				minimum: heldProfile(homeRadarr).minFormatScore
			},
			'Home Radarr should hold the same'
		).toEqual(expected);
		expect(sharedPart(homeRadarr), 'Home Radarr should match Dev Radarr').toEqual(
			sharedPart(devRadarr)
		);
		expect(await conflictsPage.list(userPage), 'The pull should leave no conflict').toEqual([]);
	});

	await test.step('6. The user restarts (consumer)', async () => {
		await waitForIdleJobs(userPage);
		const before = await storedScores(userPage, scoringPath);
		const from = homeRadarr.requests.length;

		await consumer.restart();
		await openPage(userPage, consumer.url);

		expect(await storedScores(userPage, scoringPath), 'The scores should survive').toEqual(before);
		expect(
			(await syncConfig(userPage, homeId)).syncData.qualityProfiles.config.trigger,
			'Quality Profiles should still be On Pull'
		).toBe('on_pull');
		await openDatabase(userPage, FIXTURES_NAME);
		await expect(
			userPage
				.getByRole('main')
				.getByText(/No changes to pull or publish right now|Nothing to ship/),
			'Changes should have nothing left to pull'
		).toBeVisible();
		expect(
			writesSince(homeRadarr, from),
			'The restart should write nothing to Home Radarr'
		).toEqual([]);
	});

	expect(homeRadarr.unhandled, 'Home Radarr should have had a route for every request').toEqual([]);
	expect(devRadarr.unhandled, 'Dev Radarr should have had a route for every request').toEqual([]);
});
