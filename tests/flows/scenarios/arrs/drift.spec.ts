/**
 * - Protects: drift detection, which compares what Profilarr would sync now,
 *   from the compiled fixtures and the app database, with what the Arr holds,
 *   and stores the latest result in the app database.
 * - Each test syncs first, then turns drift on, so no chained drift run from
 *   a sync lands in the check. Changes made in the Arr are made on the fake
 *   directly, the way a user editing in the Arr would.
 * - `/api/v1/status` always reports `drift: null`, so results are read from
 *   the Drift tab's data and the Sync page's progress chips.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '#flows/helpers/core/test.ts';
import { fixture, fixtures } from '#flows/helpers/core/fixtureData.ts';
import type { JobRun } from '#flows/helpers/core/jobs.ts';
import { openTab } from '#flows/helpers/core/nav.ts';
import { pageData } from '#flows/helpers/core/pageData.ts';
import { arrInstance } from '#flows/helpers/sync/arrs.ts';
import { driftState, enableDrift, runDriftCheck } from '#flows/helpers/sync/drift.ts';
import { expectedQualitySizes, expectedScores } from '#flows/helpers/sync/expected.ts';
import type { FakeArr, Resource } from '#flows/helpers/sync/fakeArr.ts';
import {
	setUpProfileSync,
	syncConfig,
	syncSection,
	type SectionProgress,
	type SyncSection
} from '#flows/helpers/sync/sync.ts';
import { hasCapability, targetsWith, type Target } from '#flows/helpers/sync/targets.ts';

/** The fixtures profile written for a target's app, e.g. "Sonarr Profile" */
const profileFor = (target: Target) => fixture.qualityProfile(`${target.label} Profile`);

/** A value no fixture uses, for a change made in the Arr */
const CHANGED_SIZE = 123;
const CHANGED_FORMAT = '{Movie Title} changed in Radarr';

/** Formats, a profile and a delay profile a user added in the Arr, which Profilarr doesn't manage */
const UNMANAGED_FORMAT = 'Arr Only';
const UNMANAGED_PROFILE = 'Arr Only Profile';
const UNMANAGED_DELAY_PROFILE_ID = 2;

const SECTIONS: SyncSection[] = ['Media Management', 'Delay Profiles', 'Quality Profiles'];

type ProgressKey =
	| 'customFormats'
	| 'qualityProfiles'
	| 'delayProfiles'
	| 'naming'
	| 'qualityDefinitions'
	| 'mediaSettings';

/**
 * Add the fake, save the target's fixture profile with media management and
 * a delay profile, and sync all three sections. Returns the instance id.
 */
async function syncEverything(page: Page, fake: FakeArr): Promise<number> {
	await setUpProfileSync(page, fake, { profiles: [profileFor(fake.target).name] });
	const { id } = await arrInstance(page, `Fake ${fake.target.label}`);
	for (const section of SECTIONS) {
		expect((await syncSection(page, section)).status, `${section} should sync`).toBe('idle');
	}
	return id;
}

/** The progress chips a clean check shows: every synced section, none drifted */
function cleanProgress(fake: FakeArr): Partial<Record<ProgressKey, SectionProgress>> {
	const scored = Object.keys(expectedScores(profileFor(fake.target), fake.type)).length;
	return {
		qualityProfiles: { total: 1, drifted: 0 },
		customFormats: { total: scored, drifted: 0 },
		delayProfiles: { total: 1, drifted: 0 },
		naming: { total: 1, drifted: 0 },
		mediaSettings: { total: 1, drifted: 0 },
		...(hasCapability(fake.target, 'qualityDefinitions')
			? { qualityDefinitions: { total: 1, drifted: 0 } }
			: {})
	};
}

/** Each chip's drifted count, by section */
function driftedBySection(progress: Partial<Record<ProgressKey, SectionProgress>> | null) {
	return Object.fromEntries(
		Object.entries(progress ?? {}).map(([key, chip]) => [key, chip?.drifted])
	);
}

/** Every finished run Settings › Jobs lists, of one job type */
async function runsOf(page: Page, jobType: string): Promise<JobRun[]> {
	const { jobRuns } = await pageData<{ jobRuns: JobRun[] }>(page, '/settings/jobs');
	return jobRuns.filter((run) => run.jobType === jobType);
}

interface ProfileItem {
	quality?: { name: string };
	items?: ProfileItem[];
	maxSize?: number | null;
}

/** A quality's row in a profile, looking inside groups */
function qualityRow(items: ProfileItem[], name: string): ProfileItem | undefined {
	for (const item of items) {
		if (item.quality?.name === name) return item;
		const inside = qualityRow(item.items ?? [], name);
		if (inside) return inside;
	}
	return undefined;
}

for (const target of targetsWith('qualityProfiles')) {
	/**
	 * Flow:
	 * 1. The user sets up the target's fixture profile and syncs Media
	 *    Management, Delay Profiles and Quality Profiles.
	 * 2. The user turns on drift detection and clicks Run Now.
	 *
	 * Expects:
	 * - the drift run succeeds with "No drift detected"
	 * - the stored result is clean with a check time and no drifted items,
	 *   and the tab shows "All synced up"
	 * - the Sync page chips show nothing drifted, with one quality profile,
	 *   each scored format, one delay profile, one naming, one media settings
	 *   and, where the target has them, one quality definitions
	 * - the instance shows no drift count
	 */
	test(`${target.id} reads clean right after a sync`, async ({ page, startArr }) => {
		const fake = await startArr(target.id);
		const id = await syncEverything(page, fake);
		await enableDrift(page);
		const run = await runDriftCheck(page);

		expect(run.status, 'The drift run should succeed').toBe('success');
		expect(run.output, 'The drift run should find nothing').toBe('No drift detected');
		const state = await driftState(page, id);
		expect(state.status, 'The stored result should be clean').toBe('clean');
		expect(state.lastCheckedAt, 'The check time should be stored').not.toBeNull();
		expect(state.entities, 'No item should be drifted').toEqual([]);
		await expect(
			page.getByRole('main').getByText(/All synced up/),
			'The Drift tab should show the clean result'
		).toBeVisible();
		expect((await syncConfig(page, id)).driftProgress, 'Every chip should be clean').toEqual(
			cleanProgress(fake)
		);
		expect(state.driftCount, 'The instance should show no drift count').toBe(0);
	});
}

interface ArrChange {
	/** What the user changes in the Arr */
	what: string;
	/** The drift section and title the item shows with */
	section: string;
	title: (fake: FakeArr) => string;
	/** The Sync page chip that counts it */
	chip: ProgressKey;
	change: (fake: FakeArr) => void;
}

const RADARR_PROFILE = fixture.qualityProfile('Radarr Profile');
const RADARR_DELAY_PROFILE = fixtures.delayProfiles[0];
const RADARR_NAMING = fixtures.naming.radarr[0];
const RADARR_MEDIA_SETTINGS = fixtures.mediaSettings.radarr[0];
const RADARR_DEFINITIONS = fixtures.qualityDefinitions.radarr[0];
const SCORED_FORMAT = fixture.customFormat(
	Object.keys(expectedScores(RADARR_PROFILE, 'radarr'))[0]
);
const SIZED_QUALITY = expectedQualitySizes('radarr', RADARR_DEFINITIONS)[0];

const CHANGES: ArrChange[] = [
	{
		what: "the delay profile's usenet delay",
		section: 'delay_profiles',
		title: () => RADARR_DELAY_PROFILE.name,
		chip: 'delayProfiles',
		change: (fake) =>
			fake.edit('delayprofile', (item) => item.id === 1, {
				usenetDelay: (RADARR_DELAY_PROFILE.usenetDelay ?? 0) + 1
			})
	},
	{
		what: "naming's movie format",
		section: 'media_management',
		title: () => `Naming: ${RADARR_NAMING.name}`,
		chip: 'naming',
		change: (fake) =>
			fake.edit('config/naming', () => true, { standardMovieFormat: CHANGED_FORMAT })
	},
	{
		what: "media settings' media info",
		section: 'media_management',
		title: () => `Media Settings: ${RADARR_MEDIA_SETTINGS.name}`,
		chip: 'mediaSettings',
		change: (fake) =>
			fake.edit('config/mediamanagement', () => true, {
				enableMediaInfo: !RADARR_MEDIA_SETTINGS.enableMediaInfo
			})
	},
	{
		what: "a managed quality's maximum size",
		section: 'media_management',
		title: () => `Quality Definitions: ${RADARR_DEFINITIONS.name}`,
		chip: 'qualityDefinitions',
		change: (fake) =>
			fake.edit(
				'qualitydefinition',
				(item) => (item.quality as { name: string }).name === SIZED_QUALITY.name,
				{ maxSize: CHANGED_SIZE }
			)
	},
	{
		what: "a custom format's include-in-rename flag",
		section: 'custom_formats',
		title: () => SCORED_FORMAT.name,
		chip: 'customFormats',
		change: (fake) =>
			fake.edit('customformat', (item) => item.name === SCORED_FORMAT.name, {
				includeCustomFormatWhenRenaming: !SCORED_FORMAT.includeInRename
			})
	},
	{
		what: "the profile's minimum format score",
		section: 'quality_profiles',
		title: () => RADARR_PROFILE.name,
		chip: 'qualityProfiles',
		change: (fake) =>
			fake.edit('qualityprofile', (item) => item.name === RADARR_PROFILE.name, {
				minFormatScore: RADARR_PROFILE.minimumCustomFormatScore + 1
			})
	}
];

for (const arrChange of CHANGES) {
	/**
	 * Flow:
	 * 1. The user syncs all three sections to Radarr and turns on drift.
	 * 2. The user changes one managed value in Radarr.
	 * 3. The user clicks Run Now.
	 *
	 * Expects:
	 * - the stored result is drifted with one item, in the changed section,
	 *   modified, with at least one change listed
	 * - only the matching Sync page chip shows one drifted
	 * - the instance shows a drift count of 1, and the run output counts one
	 */
	test(`radarr-6 notices a change to ${arrChange.what}`, async ({ page, fakeRadarr }) => {
		const id = await syncEverything(page, fakeRadarr);
		await enableDrift(page);
		arrChange.change(fakeRadarr);
		const run = await runDriftCheck(page);

		const state = await driftState(page, id);
		expect(state.status, 'The stored result should be drifted').toBe('drift_detected');
		expect(
			state.entities.map(({ section, title, state }) => ({ section, title, state })),
			'One modified item should be listed'
		).toEqual([
			{ section: arrChange.section, title: arrChange.title(fakeRadarr), state: 'modified' }
		]);
		expect(
			state.entities[0].changes.length,
			'The item should list what changed'
		).toBeGreaterThanOrEqual(1);

		const expected = Object.fromEntries(
			Object.keys(cleanProgress(fakeRadarr)).map((key) => [key, key === arrChange.chip ? 1 : 0])
		);
		expect(
			driftedBySection((await syncConfig(page, id)).driftProgress),
			`Only the ${arrChange.chip} chip should show a drift`
		).toEqual(expected);
		expect(state.driftCount, 'The instance should show one drift').toBe(1);
		expect(run.output, 'The run should count one drift').toBe('Detected 1 drift item(s)');
	});
}

/**
 * Flow:
 * 1. The user syncs all three sections to Radarr and turns on drift.
 * 2. The user deletes the synced profile in Radarr.
 * 3. The user clicks Run Now.
 *
 * Expects:
 * - one quality profile item, missing
 */
test('a profile deleted in the Arr reads as missing', async ({ page, fakeRadarr }) => {
	const id = await syncEverything(page, fakeRadarr);
	await enableDrift(page);
	fakeRadarr.remove('qualityprofile', (item) => item.name === RADARR_PROFILE.name);
	await runDriftCheck(page);

	expect(
		(await driftState(page, id)).entities.map(({ section, title, state }) => ({
			section,
			title,
			state
		})),
		'The profile should be listed as missing'
	).toEqual([{ section: 'quality_profiles', title: RADARR_PROFILE.name, state: 'missing' }]);
});

/**
 * Flow:
 * 1. The user syncs all three sections to Sonarr v5 and turns on drift.
 * 2. The user changes the maximum size of a quality the chosen definitions
 *    cover, on the synced profile in Sonarr.
 * 3. The user clicks Run Now.
 *
 * Expects:
 * - one modified item, in the quality profiles section
 */
test('sonarr-5 notices profile sizes changed in the Arr', async ({ page, startArr }) => {
	const fake = await startArr('sonarr-5');
	const profile = profileFor(fake.target);
	const id = await syncEverything(page, fake);
	await enableDrift(page);

	const held = fake.collection('qualityprofile').find((item) => item.name === profile.name);
	const items = (held?.items ?? []) as ProfileItem[];
	const covered = expectedQualitySizes(fake.type, fixtures.qualityDefinitions[fake.type][0]).find(
		(quality) => qualityRow(items, quality.name) && quality.maxSize !== CHANGED_SIZE
	);
	if (!covered) throw new Error(`${profile.name} has no quality the definitions cover`);
	fake.edit(
		'qualityprofile',
		(item) => item.name === profile.name,
		(item: Resource) => {
			const row = qualityRow(item.items as ProfileItem[], covered.name);
			if (row) row.maxSize = CHANGED_SIZE;
		}
	);
	await runDriftCheck(page);

	expect(
		(await driftState(page, id)).entities.map(({ section, title, state }) => ({
			section,
			title,
			state
		})),
		'The profile should be listed as modified'
	).toEqual([{ section: 'quality_profiles', title: profile.name, state: 'modified' }]);
});

/**
 * Flow:
 * 1. The user syncs all three sections to Radarr and turns on drift.
 * 2. The user changes the delay profile in Radarr and clicks Run Now, so
 *    the delay profile reads as drifted.
 * 3. On the Sync tab, the user clicks Sync in Delay Profiles.
 *
 * Expects:
 * - a new drift run starts after the sync, without Run Now
 * - the stored result is clean again
 */
test('a sync refreshes drift without Run Now', async ({ page, fakeRadarr }) => {
	const id = await syncEverything(page, fakeRadarr);
	await enableDrift(page);
	CHANGES[0].change(fakeRadarr);
	const checked = await runDriftCheck(page);
	expect((await driftState(page, id)).status, 'The delay profile should be drifted').toBe(
		'drift_detected'
	);

	await openTab(page, 'Sync');
	await syncSection(page, 'Delay Profiles');
	// Run history keeps start times to the second, so the newer run is told apart by its id
	await expect
		.poll(
			async () =>
				(await runsOf(page, 'arr.drift')).find((run) => run.id > checked.id)?.status ?? null,
			{ message: 'A drift run should follow the sync', timeout: 30_000 }
		)
		.toBe('success');
	expect((await driftState(page, id)).status, 'The result should be clean again').toBe('clean');
});

/**
 * Flow:
 * 1. The user syncs all three sections to Radarr and turns on drift.
 * 2. In Radarr, the user adds a custom format, a quality profile and a
 *    second delay profile.
 * 3. The user clicks Run Now.
 *
 * Expects:
 * - the stored result is clean
 */
test("ignores what Profilarr doesn't manage", async ({ page, fakeRadarr }) => {
	const id = await syncEverything(page, fakeRadarr);
	await enableDrift(page);
	const [defaultProfile] = fakeRadarr.collection('qualityprofile');
	const [defaultDelay] = fakeRadarr.collection('delayprofile');
	fakeRadarr.seed('customformat', [
		{ name: UNMANAGED_FORMAT, includeCustomFormatWhenRenaming: false, specifications: [] }
	]);
	fakeRadarr.seed('qualityprofile', [
		{ ...defaultProfile, id: undefined, name: UNMANAGED_PROFILE }
	]);
	fakeRadarr.seed('delayprofile', [
		{ ...defaultDelay, id: UNMANAGED_DELAY_PROFILE_ID, order: 1, tags: [1] }
	]);
	await runDriftCheck(page);

	const state = await driftState(page, id);
	expect(state.entities, 'Nothing should be listed').toEqual([]);
	expect(state.status, 'The stored result should be clean').toBe('clean');
});

/**
 * Flow:
 * 1. The user syncs all three sections to Radarr and turns on drift.
 * 2. Radarr refuses to list its custom formats.
 * 3. The user clicks Run Now.
 *
 * Expects:
 * - the stored result is failed with an error, which the tab shows
 * - the drift run fails with that error
 * - the Sync page shows no chips
 */
test("reports a check that can't read the Arr", async ({ page, fakeRadarr }) => {
	const id = await syncEverything(page, fakeRadarr);
	await enableDrift(page);
	fakeRadarr.fail('GET', '/api/v3/customformat', 400);
	const run = await runDriftCheck(page);

	const state = await driftState(page, id);
	expect(state.status, 'The stored result should be failed').toBe('failed');
	expect(state.lastError, 'The error should be stored').toBeTruthy();
	await expect(
		page.getByRole('main').getByText(state.lastError ?? '', { exact: true }),
		'The Drift tab should show the error'
	).toBeVisible();
	expect(
		{ status: run.status, error: run.error },
		'The drift run should fail with the error'
	).toEqual({ status: 'failure', error: state.lastError });
	expect((await syncConfig(page, id)).driftProgress, 'No chip should show').toBeNull();
});

/**
 * Flow:
 * 1. The user syncs all three sections to Radarr, leaving drift off.
 * 2. The user opens the Drift tab.
 *
 * Expects:
 * - no drift run exists
 * - Run Now is disabled, and the tab says detection is off
 * - the Sync page shows no chips
 */
test('stays off until detection is turned on', async ({ page, fakeRadarr }) => {
	const id = await syncEverything(page, fakeRadarr);
	await openTab(page, 'Drift');

	expect(await runsOf(page, 'arr.drift'), 'No drift run should exist').toEqual([]);
	await expect(
		page.getByRole('main').getByRole('button', { name: 'Run Now', exact: true }),
		'Run Now should be disabled'
	).toBeDisabled();
	await expect(
		page
			.getByRole('main')
			.getByText('Drift detection is disabled. Toggle it on above to start checking.'),
		'The tab should say detection is off'
	).toBeVisible();
	expect((await syncConfig(page, id)).driftProgress, 'No chip should show').toBeNull();
});
