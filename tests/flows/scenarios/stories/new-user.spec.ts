/**
 * - Protects: what the app database keeps for a new user across hand-offs:
 *   a local edit, a sync, drift, a restart and a backup restore. That is the
 *   session and password hash, the sync choices and times, the drift
 *   settings and result, and the user ops the cache recompiles at startup.
 * - One user, one Radarr, the built-in fixtures database, login on. Each
 *   stage is a named step, so a failure names the stage it broke in.
 * - Changes made in Radarr are made on the fake directly, the way a user
 *   editing in Radarr would.
 */
import type { Page } from '@playwright/test';
import { test, expect, FIXTURES_NAME } from '$flows/helpers/core/test.ts';
import { fixture, fixtures } from '$flows/helpers/core/fixtureData.ts';
import {
	latestJobRunId,
	scheduledJobs,
	waitForIdleJobs,
	waitForNextJobRun
} from '$flows/helpers/core/jobs.ts';
import { openDatabase, openPage, openTab } from '$flows/helpers/core/nav.ts';
import { createAccount, signIn, signOut } from '$flows/helpers/auth/accounts.ts';
import { qualityProfilePages, setProfileScores } from '$flows/helpers/entities/qualityProfiles.ts';
import {
	createBackup,
	listBackups,
	restoreBackup,
	restoreBanner
} from '$flows/helpers/settings/backups.ts';
import { arrInstance, openArr } from '$flows/helpers/sync/arrs.ts';
import { driftState, enableDrift, runDriftCheck } from '$flows/helpers/sync/drift.ts';
import {
	expectedDelayProfile,
	expectedMediaSettings,
	expectedNaming,
	expectedProfileSettings,
	expectedScores
} from '$flows/helpers/sync/expected.ts';
import type { FakeArr } from '$flows/helpers/sync/fakeArr.ts';
import {
	addArrAndOpenSync,
	arrSyncStatus,
	chooseDelayProfile,
	chooseMediaManagement,
	chooseQualityProfiles,
	syncConfig,
	syncSection,
	type SyncSection
} from '$flows/helpers/sync/sync.ts';

test.use({ appEnv: { AUTH: 'on' } });

const INSTANCE = 'Home Radarr';
const PROFILE = fixture.qualityProfile('Radarr Profile');
const DELAY_PROFILE = fixture.delayProfile('Bypass Score');
const TITLE_MATCH = fixture.customFormat('Title Match');
const SCORES = expectedScores(PROFILE, 'radarr');

/** Title Match's Radarr score after the user's tweak, and after the change they regret */
const TWEAKED = SCORES[TITLE_MATCH.name] + 50;
const REGRETTED = 999;

const SECTIONS: SyncSection[] = ['Media Management', 'Delay Profiles', 'Quality Profiles'];

const SNAPSHOT_COUNTS = {
	customFormats: fixtures.customFormats.length,
	qualityProfiles: fixtures.qualityProfiles.length,
	regularExpressions: fixtures.regularExpressions.length,
	delayProfiles: fixtures.delayProfiles.length
};

/** The profile Radarr holds */
function heldProfile(fake: FakeArr) {
	const profile = fake.collection('qualityprofile').find((p) => p.name === PROFILE.name);
	if (!profile) throw new Error(`Radarr holds no quality profile "${PROFILE.name}"`);
	return profile;
}

/** The format scores Radarr's profile holds, by format name */
function heldScores(fake: FakeArr): Record<string, number> {
	const items = heldProfile(fake).formatItems as { name: string; score: number }[];
	return Object.fromEntries(items.map((item) => [item.name, item.score]));
}

/** Requests that change something in Radarr, from the `from`-th on */
function writesSince(fake: FakeArr, from: number): string[] {
	return fake.requests
		.slice(from)
		.filter((request) => request.method !== 'GET')
		.map((request) => `${request.method} ${request.path}`);
}

/** Title Match's stored Radarr score, from the profile's Scoring tab */
async function storedTitleMatch(
	page: Page,
	scoringPath: string
): Promise<number | null | undefined> {
	const scoring = await qualityProfilePages.scoring(page, scoringPath);
	return scoring.customFormats.find((format) => format.name === TITLE_MATCH.name)?.scores.radarr;
}

/**
 * Flow:
 * 1. The user creates the first account.
 * 2. The user connects Radarr.
 * 3. On Sync, the user chooses Media Management, the Bypass Score delay
 *    profile and Radarr Profile, each on the default Manual trigger.
 * 4. The user syncs all three sections.
 * 5. The user turns on drift detection and runs a check.
 * 6. The user raises Title Match's Radarr score and syncs Quality Profiles.
 * 7. Someone sets the profile's minimum score to 0 in Radarr. The user runs
 *    a drift check.
 * 8. Profilarr restarts.
 * 9. The user syncs Quality Profiles.
 * 10. The user creates a backup.
 * 11. The user sets Title Match to a score they regret and syncs.
 * 12. The user restores the backup and Profilarr restarts.
 * 13. The user runs a drift check, then syncs Quality Profiles.
 * 14. The user signs out and back in.
 *
 * Expects:
 * - adding Radarr applies the default delay profile, its only write before
 *   the first sync
 * - the session, sync choices and times, drift result and the user's score
 *   survive the restart unchanged, and Radarr gets no writes from it
 * - a sync after the restart sends the user's score and fixes the drift
 * - the restore brings back the score and sync time from the backup and
 *   leaves Radarr alone, until drift finds it and a sync puts it right
 * - the password works after both restarts
 */
test("a new user's Radarr sync survives a restart and a restore", async ({
	app,
	page,
	fakeRadarr
}) => {
	test.setTimeout(120_000);
	let id = 0;
	let scoringPath = '';
	let lastSynced: string | null = null;
	let backup = '';

	await test.step('1. Create the account', async () => {
		await createAccount(page);
		await openDatabase(page, FIXTURES_NAME);
		const response = await page.request.get('/api/v1/status');
		expect(response.ok(), 'GET /api/v1/status should answer with the session').toBe(true);
		const { databases } = (await response.json()) as {
			databases: { name: string; counts: Record<string, number> }[];
		};
		expect(
			databases.find((database) => database.name === FIXTURES_NAME)?.counts,
			`/api/v1/status should list ${FIXTURES_NAME} with the snapshot's entities`
		).toEqual(SNAPSHOT_COUNTS);
	});

	await test.step('2. Connect Radarr', async () => {
		await addArrAndOpenSync(page, fakeRadarr, INSTANCE);
		const instance = await arrInstance(page, INSTANCE);
		id = instance.id;
		expect(instance.type, 'The instance should be stored as Radarr').toBe('radarr');
		expect(
			Object.keys(instance).filter((key) => /api_key|basic_auth/.test(key)),
			'The instance should be listed with no secret fields'
		).toEqual([]);
		// Adding an Arr applies the default delay profile over Radarr's own (id 1)
		expect(
			writesSince(fakeRadarr, 0),
			'Adding Radarr should only write the default delay profile'
		).toEqual([`PUT ${fakeRadarr.target.apiBase}/delayprofile/1`]);
	});

	await test.step('3. Choose what to sync', async () => {
		await chooseMediaManagement(page, fakeRadarr);
		await chooseDelayProfile(page, DELAY_PROFILE.name);
		await chooseQualityProfiles(page, fakeRadarr, [PROFILE.name]);

		const { syncData } = await syncConfig(page, id);
		expect(
			syncData.qualityProfiles.selections.map((selection) => selection.profileName),
			`Quality Profiles should select ${PROFILE.name}`
		).toEqual([PROFILE.name]);
		expect(
			syncData.delayProfiles.profileName,
			`Delay Profiles should hold ${DELAY_PROFILE.name}`
		).toBe(DELAY_PROFILE.name);
		expect(
			[
				syncData.mediaManagement.trigger,
				syncData.delayProfiles.trigger,
				syncData.qualityProfiles.config.trigger
			],
			'Every trigger should be Manual'
		).toEqual(['manual', 'manual', 'manual']);
	});

	await test.step('4. First sync', async () => {
		for (const section of SECTIONS) {
			const result = await syncSection(page, section);
			expect(result.status, `${section} should sync`).toBe('idle');
			expect(result.lastSyncedAt, `${section} should record when it synced`).not.toBeNull();
		}
		expect(fakeRadarr.singleton('config/naming'), 'Radarr should hold the naming').toMatchObject(
			expectedNaming('radarr', fixtures.naming.radarr[0])
		);
		expect(
			fakeRadarr.singleton('config/mediamanagement'),
			'Radarr should hold the media settings'
		).toMatchObject(expectedMediaSettings(fixtures.mediaSettings.radarr[0]));
		expect(
			fakeRadarr.collection('delayprofile').find((item) => item.id === 1),
			`Radarr's default delay profile should hold ${DELAY_PROFILE.name}`
		).toEqual(expectedDelayProfile(DELAY_PROFILE));
		expect(heldProfile(fakeRadarr), 'Radarr should hold the profile settings').toMatchObject(
			expectedProfileSettings(PROFILE)
		);
		expect(heldScores(fakeRadarr), 'Radarr should hold the profile scores').toMatchObject(SCORES);
		expect(
			fakeRadarr
				.collection('customformat')
				.map((format) => format.name)
				.sort(),
			"Radarr's custom formats should be the ones the profile scores"
		).toEqual(Object.keys(SCORES).sort());
	});

	await test.step('5. Turn on drift', async () => {
		await enableDrift(page);
		const run = await runDriftCheck(page);
		expect(run.status, 'The drift run should succeed').toBe('success');
		const state = await driftState(page, id);
		expect(
			{ status: state.status, entities: state.entities, driftCount: state.driftCount },
			'Drift should be clean'
		).toEqual({ status: 'clean', entities: [], driftCount: 0 });
	});

	await test.step('6. Tweak a score and sync', async () => {
		await setProfileScores(page, PROFILE.name, [
			{ format: TITLE_MATCH.name, arr: 'Radarr', score: TWEAKED }
		]);
		scoringPath = new URL(page.url()).pathname;
		await openArr(page, INSTANCE);
		await openTab(page, 'Sync');
		const lastDrift = await latestJobRunId(page, 'arr.drift');
		const from = fakeRadarr.requests.length;
		expect((await syncSection(page, 'Quality Profiles')).status, 'The sync should succeed').toBe(
			'idle'
		);

		expect(heldScores(fakeRadarr), 'Radarr should hold the new score and keep the others').toEqual(
			expect.objectContaining({ ...SCORES, [TITLE_MATCH.name]: TWEAKED })
		);
		expect(
			writesSince(fakeRadarr, from).filter((write) => write.startsWith('POST')),
			'The sync should create nothing'
		).toEqual([]);
		const drift = await waitForNextJobRun(page, 'arr.drift', { afterId: lastDrift });
		expect(drift.status, 'The drift run the sync chains should succeed').toBe('success');
		expect((await driftState(page, id)).status, 'Drift should be clean').toBe('clean');
	});

	await test.step('7. Edit Radarr by hand', async () => {
		fakeRadarr.edit('qualityprofile', (item) => item.name === PROFILE.name, {
			minFormatScore: 0
		});
		await runDriftCheck(page);
		const state = await driftState(page, id);
		expect(state.status, 'Drift should be detected').toBe('drift_detected');
		expect(
			state.entities.map(({ section, title, state }) => ({ section, title, state })),
			`Drift should find ${PROFILE.name} modified`
		).toEqual([{ section: 'quality_profiles', title: PROFILE.name, state: 'modified' }]);
	});

	await test.step('8. Restart', async () => {
		await waitForIdleJobs(page);
		const before = {
			status: await arrSyncStatus(page, id),
			syncData: (await syncConfig(page, id)).syncData,
			drift: await driftState(page, id),
			score: await storedTitleMatch(page, scoringPath)
		};
		expect(before.score, 'The tweaked score should be stored').toBe(TWEAKED);
		const from = fakeRadarr.requests.length;

		await app.restart();
		await openPage(page, '/');

		expect(new URL(page.url()).pathname, 'The user should still be signed in').not.toMatch(
			/^\/auth\//
		);
		expect(
			{
				status: await arrSyncStatus(page, id),
				syncData: (await syncConfig(page, id)).syncData,
				drift: await driftState(page, id),
				score: await storedTitleMatch(page, scoringPath)
			},
			'Sync settings, sync status, the drift result and the score should survive the restart'
		).toEqual(before);
		expect(
			(await scheduledJobs(page)).map((job) => job.description),
			'The drift job should still be scheduled'
		).toContain(`arr.drift:${id}`);
		expect(writesSince(fakeRadarr, from), 'The restart should write nothing to Radarr').toEqual([]);
	});

	await test.step('9. Sync fixes the drift', async () => {
		await openArr(page, INSTANCE);
		await openTab(page, 'Sync');
		const lastDrift = await latestJobRunId(page, 'arr.drift');
		const result = await syncSection(page, 'Quality Profiles');
		expect(result.status, 'The sync should succeed').toBe('idle');
		lastSynced = result.lastSyncedAt;

		expect(heldProfile(fakeRadarr).minFormatScore, "Radarr's minimum score should be back").toBe(
			PROFILE.minimumCustomFormatScore
		);
		expect(heldScores(fakeRadarr)[TITLE_MATCH.name], 'Title Match should still be tweaked').toBe(
			TWEAKED
		);
		await waitForNextJobRun(page, 'arr.drift', { afterId: lastDrift });
		expect((await driftState(page, id)).status, 'Drift should be clean').toBe('clean');
	});

	await test.step('10. Back up', async () => {
		backup = await createBackup(page);
		expect(
			(await listBackups(page)).map((file) => file.filename),
			'The backup should be listed'
		).toContain(backup);
	});

	await test.step('11. A regretted change', async () => {
		await setProfileScores(page, PROFILE.name, [
			{ format: TITLE_MATCH.name, arr: 'Radarr', score: REGRETTED }
		]);
		await openArr(page, INSTANCE);
		await openTab(page, 'Sync');
		const lastDrift = await latestJobRunId(page, 'arr.drift');
		expect((await syncSection(page, 'Quality Profiles')).status, 'The sync should succeed').toBe(
			'idle'
		);
		expect(heldScores(fakeRadarr)[TITLE_MATCH.name], 'Radarr should hold the regretted score').toBe(
			REGRETTED
		);
		await waitForNextJobRun(page, 'arr.drift', { afterId: lastDrift });
	});

	await test.step('12. Restore and restart', async () => {
		await restoreBackup(page, backup);
		await waitForIdleJobs(page);
		const from = fakeRadarr.requests.length;
		await app.restart();
		await openPage(page, '/settings/backups');

		expect(new URL(page.url()).pathname, 'The user should still be signed in').toBe(
			'/settings/backups'
		);
		await expect(restoreBanner(page), 'The restore banner should be gone').toHaveCount(0);
		expect(
			await storedTitleMatch(page, scoringPath),
			'Title Match should be back to the score from the backup'
		).toBe(TWEAKED);
		expect(
			(await arrSyncStatus(page, id)).sync.qualityProfiles.lastSyncedAt,
			'The last sync time should be the one from before the backup'
		).toBe(lastSynced);
		expect(
			heldScores(fakeRadarr)[TITLE_MATCH.name],
			'Radarr should still hold the regretted score'
		).toBe(REGRETTED);
		expect(writesSince(fakeRadarr, from), 'The restore should write nothing to Radarr').toEqual([]);
	});

	await test.step('13. Drift catches up', async () => {
		await openArr(page, INSTANCE);
		await runDriftCheck(page);
		const state = await driftState(page, id);
		expect(
			state.entities.map(({ section, title, state }) => ({ section, title, state })),
			`Drift should find ${PROFILE.name} modified`
		).toEqual([{ section: 'quality_profiles', title: PROFILE.name, state: 'modified' }]);

		await openTab(page, 'Sync');
		const lastDrift = await latestJobRunId(page, 'arr.drift');
		expect((await syncSection(page, 'Quality Profiles')).status, 'The sync should succeed').toBe(
			'idle'
		);
		expect(heldScores(fakeRadarr)[TITLE_MATCH.name], 'Radarr should be back to the score').toBe(
			TWEAKED
		);
		await waitForNextJobRun(page, 'arr.drift', { afterId: lastDrift });
		expect((await driftState(page, id)).status, 'Drift should be clean').toBe('clean');
	});

	await test.step('14. Sign out and in', async () => {
		await signOut(page);
		expect(await signIn(page), 'Signing in should work after both restarts').toBeUndefined();
	});

	expect(fakeRadarr.unhandled, 'Radarr should have had a route for every request').toEqual([]);
});
