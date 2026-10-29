/**
 * - Protects: cleanup, which deletes from the Arr the custom formats and
 *   quality profiles no sync selection in the app database uses, and the
 *   media the Arr flags as removed from TMDb or TheTVDB.
 * - The preview scans the Arr, and the `arr.cleanup` job deletes exactly the
 *   ids the preview sent with it: formats first, then profiles. A profile
 *   delete that answers 500 is skipped as "Profile is assigned to media".
 * - Each test checks the preview, the run and the fake Arr's state after it.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '#flows/helpers/core/test.ts';
import { fixture } from '#flows/helpers/core/fixtureData.ts';
import type { JobRun } from '#flows/helpers/core/jobs.ts';
import { logEntries } from '#flows/helpers/core/logs.ts';
import { pageData } from '#flows/helpers/core/pageData.ts';
import { arrInstance, setCleanup } from '#flows/helpers/sync/arrs.ts';
import {
	cleanupDialog,
	cleanupSettings,
	confirmCleanup,
	openCleanup,
	type StaleItem
} from '#flows/helpers/sync/cleanup.ts';
import { expectedScores } from '#flows/helpers/sync/expected.ts';
import {
	removedMediaHealth,
	type FakeArr,
	type HealthItem,
	type LibraryItem
} from '#flows/helpers/sync/fakeArr.ts';
import { setUpProfileSync, syncSection } from '#flows/helpers/sync/sync.ts';
import type { Target } from '#flows/helpers/sync/targets.ts';

/** A format a user added in the Arr, which no sync uses */
const ARR_ONLY = 'Arr Only';

/** Library items a user added in the Arr; A is flagged as removed, B isn't */
const REMOVED = { id: 7, title: 'Removed Title', externalId: 7001 };
const KEPT = { id: 8, title: 'Kept Title', externalId: 8001 };

/** The fixtures profile written for a target's app, e.g. "Sonarr Profile" */
const profileFor = (target: Target) => fixture.qualityProfile(`${target.label} Profile`);

/** The instance name the sync helpers give a fake */
const instanceName = (fake: FakeArr) => `Fake ${fake.target.label}`;

/** A library item for the fake's app, with its TMDb or TVDB id */
function libraryItem(fake: FakeArr, item: typeof REMOVED): LibraryItem {
	const { id, title, externalId } = item;
	return fake.type === 'radarr'
		? { id, title, tmdbId: externalId }
		: { id, title, tvdbId: externalId };
}

/** The fake's library collection */
const libraryOf = (fake: FakeArr) => (fake.type === 'radarr' ? 'movie' : 'series');

/** Names in a list, sorted */
const namesOf = (items: { name?: string }[]) => items.map((item) => item.name ?? '').sort();

/** Add the fake and sync the target's fixture profile. Returns the instance id. */
async function syncFixtureProfile(page: Page, fake: FakeArr): Promise<number> {
	await setUpProfileSync(page, fake, { profiles: [profileFor(fake.target).name] });
	const { id } = await arrInstance(page, instanceName(fake));
	expect((await syncSection(page, 'Quality Profiles')).status, 'The profile should sync').toBe(
		'idle'
	);
	return id;
}

/** The profiles on the fake other than the synced one, as a preview lists them */
function defaultProfiles(fake: FakeArr): StaleItem[] {
	const synced = profileFor(fake.target).name;
	return fake
		.collection('qualityprofile')
		.filter((profile) => profile.name !== synced)
		.map((profile) => ({ id: profile.id, name: profile.name ?? '' }));
}

/** Every finished cleanup run Settings › Jobs lists */
async function cleanupRuns(page: Page): Promise<JobRun[]> {
	const { jobRuns } = await pageData<{ jobRuns: JobRun[] }>(page, '/settings/jobs');
	return jobRuns.filter((run) => run.jobType === 'arr.cleanup');
}

for (const targetId of ['radarr-6', 'sonarr-4']) {
	/**
	 * Flow:
	 * 1. The user syncs the target's fixture profile.
	 * 2. In the Arr, the user adds a custom format, "Arr Only".
	 * 3. The user turns on Cleanup, clicks Run Now and then Clean Up.
	 * 4. The user clicks Run Now again.
	 *
	 * Expects:
	 * - the preview lists the Arr's default profiles and "Arr Only" as stale,
	 *   and no removed media
	 * - the dialog counts the stale formats and profiles, and "Cleanup
	 *   queued" shows
	 * - the run succeeds and counts every deleted config
	 * - every format delete comes before the first profile delete
	 * - the Arr keeps only the synced profile and the formats it scores
	 * - the cleanup settings have a last run and a future next run
	 * - the second Run Now shows "Nothing to clean up. Everything looks
	 *   good." with a Close button, and records no new run
	 */
	test(`${targetId} loses the formats and profiles no sync uses`, async ({ page, startArr }) => {
		const fake = await startArr(targetId);
		const profile = profileFor(fake.target);
		const id = await syncFixtureProfile(page, fake);
		fake.seed('customformat', [{ name: ARR_ONLY, specifications: [] }]);
		const defaults = defaultProfiles(fake);
		expect(defaults.length, 'The Arr should start with default profiles').toBeGreaterThan(0);
		await setCleanup(page, instanceName(fake), true);

		const preview = await openCleanup(page);
		expect(preview.configs.ok, 'The config scan should succeed').toBe(true);
		const configs = preview.configs.ok ? preview.configs.data : null;
		expect(configs?.staleQualityProfiles, 'The default profiles should be stale').toEqual(defaults);
		expect(
			configs?.staleCustomFormats.map((format) => format.name),
			'Only the Arr-only format should be stale'
		).toEqual([ARR_ONLY]);
		expect(preview.entities, 'No media should be flagged as removed').toEqual({
			ok: true,
			data: { removedEntities: [] }
		});
		const dialog = cleanupDialog(page);
		await expect(
			dialog.getByText('1 custom format', { exact: true }),
			'The dialog should count one stale format'
		).toBeVisible();
		await expect(
			dialog.getByText(`${defaults.length} quality profiles`, { exact: true }),
			'The dialog should count the stale profiles'
		).toBeVisible();

		const run = await confirmCleanup(page);
		await expect(
			page.getByText('Cleanup queued', { exact: true }).last(),
			'The cleanup should be queued'
		).toBeVisible();
		expect(
			{ status: run.status, output: run.output },
			'The run should delete every stale config'
		).toEqual({
			status: 'success',
			output: `Deleted ${defaults.length + 1} stale config(s), 0 removed entities`
		});

		const deletes = fake.requests
			.map((request, index) => ({ request, index }))
			.filter(({ request }) => request.method === 'DELETE');
		const formatDeletes = deletes.filter(({ request }) => request.path.includes('/customformat/'));
		const profileDeletes = deletes.filter(({ request }) =>
			request.path.includes('/qualityprofile/')
		);
		expect(formatDeletes.length, 'The format should be deleted').toBe(1);
		expect(
			Math.max(...formatDeletes.map(({ index }) => index)),
			'Every format delete should come before the first profile delete'
		).toBeLessThan(Math.min(...profileDeletes.map(({ index }) => index)));

		expect(
			namesOf(fake.collection('qualityprofile')),
			'The Arr should keep only the synced profile'
		).toEqual([profile.name]);
		expect(
			namesOf(fake.collection('customformat')),
			'The Arr should keep only the formats the profile scores'
		).toEqual(Object.keys(expectedScores(profile, fake.type)).sort());

		const settings = await cleanupSettings(page, id);
		expect(settings?.lastRunAt, 'The cleanup should record its run').not.toBeNull();
		expect(
			new Date(settings?.nextRunAt ?? 0).getTime(),
			'The cleanup should have a future next run'
		).toBeGreaterThan(Date.now());

		const runs = (await cleanupRuns(page)).length;
		await openCleanup(page);
		await expect(
			dialog.getByText('Nothing to clean up. Everything looks good.', { exact: true }),
			'A second preview should find nothing'
		).toBeVisible();
		const close = dialog.getByRole('button', { name: 'Close', exact: true });
		await expect(close, 'The dialog should only offer Close').toBeVisible();
		await close.click();
		await expect(dialog, 'Close should shut the dialog').toBeHidden();
		expect((await cleanupRuns(page)).length, 'Close should record no new run').toBe(runs);
	});
}

/**
 * Flow:
 * 1. The user syncs the Radarr fixture profile and adds "Arr Only" in
 *    Radarr.
 * 2. Radarr answers 500 to deleting one default profile, as it does for a
 *    profile assigned to media.
 * 3. The user turns on Cleanup, clicks Run Now and then Clean Up.
 *
 * Expects:
 * - that profile stays on the Arr, and the other defaults are gone
 * - the run counts one config fewer
 * - the "Cleanup complete" log line lists the profile as skipped
 */
test("keeps a profile the Arr won't delete because media uses it", async ({ page, fakeRadarr }) => {
	const profile = profileFor(fakeRadarr.target);
	await syncFixtureProfile(page, fakeRadarr);
	fakeRadarr.seed('customformat', [{ name: ARR_ONLY, specifications: [] }]);
	const defaults = defaultProfiles(fakeRadarr);
	const [inUse] = defaults;
	fakeRadarr.fail('DELETE', `/api/v3/qualityprofile/${inUse.id}`, 500);
	await setCleanup(page, instanceName(fakeRadarr), true);

	await openCleanup(page);
	const run = await confirmCleanup(page);

	expect(
		namesOf(fakeRadarr.collection('qualityprofile')),
		'Only the synced profile and the one in use should stay'
	).toEqual([inUse.name, profile.name].sort());
	expect(run.output, 'The run should count one config fewer').toBe(
		`Deleted ${defaults.length} stale config(s), 0 removed entities`
	);
	const [complete] = await logEntries(page, { source: 'Cleanup', message: 'Cleanup complete' });
	expect(
		(complete?.meta as { skippedQPs?: string[] } | undefined)?.skippedQPs,
		'The log should list the profile as skipped'
	).toEqual([inUse.name]);
});

for (const targetId of ['radarr-6', 'sonarr-4']) {
	/**
	 * Flow:
	 * 1. In the Arr, the user has two library items, A and B.
	 * 2. The Arr's health check flags A as removed from its metadata source.
	 *    Another check names B.
	 * 3. The user syncs the fixture profile, turns on Cleanup, clicks Run Now
	 *    and then Clean Up.
	 *
	 * Expects:
	 * - the preview lists A only, with its id, title and external id
	 * - the dialog shows "Removed Media" with A's title
	 * - exactly one delete is sent, for A, with no query
	 * - the Arr's library is B only
	 * - the run output ends in "1 removed entity"
	 */
	test(`${targetId} loses the media its metadata source removed`, async ({ page, startArr }) => {
		const fake = await startArr(targetId);
		const removed = libraryItem(fake, REMOVED);
		const kept = libraryItem(fake, KEPT);
		const library = libraryOf(fake);
		fake.seed(library, [{ ...removed }, { ...kept }]);
		const otherCheck: HealthItem = {
			...removedMediaHealth(fake.type, kept),
			source: 'IndexerStatusCheck'
		};
		fake.answer('GET', 'health', [removedMediaHealth(fake.type, removed), otherCheck]);
		await syncFixtureProfile(page, fake);
		await setCleanup(page, instanceName(fake), true);

		const preview = await openCleanup(page);
		expect(preview.entities, 'Only A should be flagged as removed').toEqual({
			ok: true,
			data: { removedEntities: [REMOVED] }
		});
		const dialog = cleanupDialog(page);
		await expect(
			dialog.getByText('Removed Media', { exact: true }),
			'The dialog should list removed media'
		).toBeVisible();
		await expect(
			dialog.getByText(REMOVED.title, { exact: true }),
			'The dialog should name A'
		).toBeVisible();
		const run = await confirmCleanup(page);

		const deletes = fake.requests.filter(
			(request) => request.method === 'DELETE' && request.path.startsWith(`/api/v3/${library}`)
		);
		expect(
			deletes.map((request) => ({ path: request.path, query: request.query.toString() })),
			'Exactly one delete should be sent, for A, with no query'
		).toEqual([{ path: `/api/v3/${library}/${REMOVED.id}`, query: '' }]);
		expect(fake.collection(library), 'The library should keep only B').toEqual([kept]);
		expect(run.output, 'The run should count one removed entity').toMatch(/, 1 removed entity$/);
	});
}
