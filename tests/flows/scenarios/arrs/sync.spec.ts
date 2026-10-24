/**
 * - Protects: what each Sync section sends the Arr, read from the compiled
 *   fixtures and the app database, checked against the fake Arr's state in
 *   the Arr's own field names.
 * - Protects: the choices and triggers the Sync page stores, the status the
 *   API reports for them, and the jobs a schedule queues.
 * - The fixture to Arr API maps live in helpers/sync/expected.ts.
 */
import type { Page } from '@playwright/test';
import { test, expect, FIXTURES_NAME } from '$flows/helpers/core/test.ts';
import { fixture, fixtures, type ArrType } from '$flows/helpers/core/fixtureData.ts';
import { chooseOption, saveForm } from '$flows/helpers/core/forms.ts';
import { scheduledJobs, waitForJobRun } from '$flows/helpers/core/jobs.ts';
import { waitForHydration } from '$flows/helpers/core/nav.ts';
import { arrInstance, openArr } from '$flows/helpers/sync/arrs.ts';
import {
	expectedDelayProfile,
	expectedMediaSettings,
	expectedNaming,
	expectedProfileSettings,
	expectedQualitySizes,
	expectedScores
} from '$flows/helpers/sync/expected.ts';
import type { FakeArr, Resource } from '$flows/helpers/sync/fakeArr.ts';
import {
	addArrAndOpenSync,
	arrSyncStatus,
	chooseDelayProfile,
	chooseMediaManagement,
	chooseQualityProfiles,
	setTrigger,
	setUpProfileSync,
	syncConfig,
	syncRegion,
	syncSection
} from '$flows/helpers/sync/sync.ts';
import { TARGETS, targetsWith, hasCapability, type Target } from '$flows/helpers/sync/targets.ts';

/** The fixtures profile written for a target's app, e.g. "Sonarr Profile" */
const profileFor = (target: Target) => fixture.qualityProfile(`${target.label} Profile`);

/** How a fixtures config shows in the Sync page's dropdowns */
const fromFixtures = (config: string) => `${FIXTURES_NAME} / ${config}`;

/** The instance name the sync helpers give a fake */
const instanceName = (fake: FakeArr) => `Fake ${fake.target.label}`;

/** The profile the fake holds, by name */
function heldProfile(fake: FakeArr, name: string): Resource {
	const profile = fake.collection('qualityprofile').find((candidate) => candidate.name === name);
	if (!profile) throw new Error(`${fake.target.id} holds no quality profile "${name}"`);
	return profile;
}

/** The fixtures database's id, from /api/v1/status */
async function fixturesDatabaseId(page: Page): Promise<number> {
	const response = await page.request.get('/api/v1/status');
	const status = (await response.json()) as { databases: { id: number; name: string }[] };
	const database = status.databases.find((candidate) => candidate.name === FIXTURES_NAME);
	if (!database) throw new Error(`/api/v1/status lists no database ${FIXTURES_NAME}`);
	return database.id;
}

/** Formats that some fixture profile scores only for the other Arr, never for this one */
function otherArrOnlyFormats(app: ArrType, synced: Record<string, number>): string[] {
	const names = fixtures.qualityProfiles.flatMap((profile) =>
		profile.scores.filter((score) => score.arrType !== app && score.arrType !== 'all')
	);
	return [...new Set(names.map((score) => score.customFormatName))].filter(
		(name) => !(name in synced)
	);
}

for (const target of TARGETS) {
	/**
	 * Flow:
	 * 1. The user adds the fake and opens its Sync tab.
	 * 2. In Media Management, the user chooses the fixtures Naming and Media
	 *    Settings, and Quality Definitions where the target has that dropdown,
	 *    and saves. On a target that keeps sizes per profile, the quality
	 *    definitions choice is the Global Quality Definition in Quality
	 *    Profiles, saved there.
	 * 3. The user clicks Sync in Media Management.
	 *
	 * Expects:
	 * - the section is idle with a last sync time, and `/api/v1/status`
	 *   reports media management as configured
	 * - the fake's naming holds the fixture naming in the Arr's field names
	 * - the fake's media management holds the fixture media settings, with
	 *   the propers value mapped to the Arr's
	 * - with global quality definitions, each fixture quality has its sizes,
	 *   with a maximum or preferred size of 0 as null
	 * - on a target that keeps sizes per profile, no definitions update is
	 *   sent and the run output says the sizes were not pushed
	 * - run history has a successful media management run counting what was
	 *   synced
	 * - the sync only called endpoints the fake supports
	 */
	test(`${target.id} gets the chosen naming, media settings and quality sizes`, async ({
		page,
		startArr
	}) => {
		const fake = await startArr(target.id);
		const app = fake.type;
		const naming = fixtures.naming[app][0];
		const mediaSettings = fixtures.mediaSettings[app][0];
		const definitions = fixtures.qualityDefinitions[app][0];
		const globalDefinitions = hasCapability(target, 'qualityDefinitions');

		await addArrAndOpenSync(page, fake);
		const { id } = await arrInstance(page, instanceName(fake));
		await chooseMediaManagement(page, fake);
		if (hasCapability(target, 'profileSizes')) {
			const section = syncRegion(page, 'Quality Profiles');
			await chooseOption(section, 'Global Quality Definition', fromFixtures(definitions.name));
			await saveForm(page, { within: section, action: 'saveQualityProfiles' });
		}
		const started = Date.now();
		const result = await syncSection(page, 'Media Management');

		expect(result.status, 'The sync should succeed').toBe('idle');
		expect(result.lastSyncedAt, 'The sync should record when it ran').not.toBeNull();
		expect(
			(await arrSyncStatus(page, id)).sync.mediaManagement.configured,
			'/api/v1/status should report media management as configured'
		).toBe(true);

		expect(fake.singleton('config/naming'), 'The Arr should hold the fixture naming').toMatchObject(
			expectedNaming(app, naming)
		);
		expect(
			fake.singleton('config/mediamanagement'),
			'The Arr should hold the fixture media settings'
		).toMatchObject(expectedMediaSettings(mediaSettings));

		const run = await waitForJobRun(page, 'arr.sync.mediaManagement', { after: started });
		expect(run.status, 'The media management run should succeed').toBe('success');

		if (globalDefinitions) {
			const held = fake.collection('qualitydefinition') as unknown as {
				quality: { name: string };
				minSize?: number | null;
				maxSize?: number | null;
				preferredSize?: number | null;
			}[];
			const sizes = expectedQualitySizes(app, definitions);
			expect(sizes.length, 'The fixture should size some qualities').toBeGreaterThan(0);
			for (const quality of sizes) {
				const row = held.find((definition) => definition.quality.name === quality.name);
				expect(
					{ minSize: row?.minSize, maxSize: row?.maxSize, preferredSize: row?.preferredSize },
					`${quality.name} should have the fixture sizes`
				).toEqual({
					minSize: quality.minSize,
					maxSize: quality.maxSize,
					preferredSize: quality.preferredSize
				});
			}
			expect(run.output, 'The run should count naming, media settings and sizes').toBe(
				'mediaManagement: 3 item(s)'
			);
		} else {
			expect(
				fake.sent('PUT', '/api/v3/qualitydefinition/update'),
				'No definitions update should be sent'
			).toEqual([]);
			expect(run.output, 'The run should count naming and media settings').toMatch(
				/^mediaManagement: 2 item\(s\) \(/
			);
			expect(run.output, 'The run output should say the sizes were not pushed').toContain(
				`Quality definitions "${definitions.name}" not pushed`
			);
		}
		expect(fake.unhandled, 'The sync should only call endpoints the fake supports').toEqual([]);
	});
}

/**
 * Flow:
 * 1. The user adds the fake and opens its Sync tab.
 * 2. For each fixture delay profile, the user turns on its switch, saves and
 *    syncs Delay Profiles.
 *
 * Expects:
 * - turning one switch on turns the previous one off
 * - the fake's delay profiles keep their count, and only
 *   `PUT /delayprofile/1` is sent, never a POST
 * - the default profile (id 1) matches the fixture through the protocol
 *   table, with NULL delays and a NULL minimum score as 0, the default order
 *   and no tags
 */
test('radarr-6 writes each delay profile over the default one', async ({ page, fakeRadarr }) => {
	await addArrAndOpenSync(page, fakeRadarr);
	const count = fakeRadarr.collection('delayprofile').length;
	const toggle = (name: string) =>
		syncRegion(page, 'Delay Profiles').getByRole('switch', {
			name: `Toggle delay profile ${name} from ${FIXTURES_NAME}`
		});

	let previous: string | undefined;
	for (const profile of fixtures.delayProfiles) {
		await chooseDelayProfile(page, profile.name);
		await expect(toggle(profile.name), `${profile.name} should be on`).toHaveAttribute(
			'aria-checked',
			'true'
		);
		if (previous) {
			await expect(toggle(previous), `${previous} should turn off`).toHaveAttribute(
				'aria-checked',
				'false'
			);
		}
		const result = await syncSection(page, 'Delay Profiles');

		expect(result.status, `${profile.name} should sync`).toBe('idle');
		expect(
			fakeRadarr.collection('delayprofile').length,
			'The Arr should keep its delay profile count'
		).toBe(count);
		expect(
			fakeRadarr.collection('delayprofile').find((item) => item.id === 1),
			`The default profile should hold ${profile.name}`
		).toEqual(expectedDelayProfile(profile));
		previous = profile.name;
	}

	const writes = fakeRadarr.requests
		.filter((r) => r.method !== 'GET' && r.path.startsWith('/api/v3/delayprofile'))
		.map((r) => `${r.method} ${r.path}`);
	expect([...new Set(writes)], 'Only PUT /delayprofile/1 should be sent, never a POST').toEqual([
		'PUT /api/v3/delayprofile/1'
	]);
});

for (const target of targetsWith('qualityProfiles')) {
	/**
	 * Flow:
	 * 1. The user sets up the target's fixture profile to sync, with media
	 *    management and a delay profile saved first.
	 * 2. The user syncs Quality Profiles.
	 *
	 * Expects:
	 * - the fake holds the profile by name
	 * - its format scores are the fixture's scores for this Arr, and 0 for
	 *   every other format on the fake
	 * - its upgrade and score settings match the fixture, with a minimum
	 *   upgrade step of at least 1
	 * - every format the profile scores is on the fake, with the fixture's
	 *   include-in-rename flag
	 * - formats the fixtures score only for the other Arr are not on the fake
	 * - the section is idle with one profile, and the run output counts one
	 */
	test(`${target.id} gets the profile and the formats it scores`, async ({ page, startArr }) => {
		const fake = await startArr(target.id);
		const profile = profileFor(target);
		const scores = expectedScores(profile, fake.type);

		await setUpProfileSync(page, fake, { profiles: [profile.name] });
		const { id } = await arrInstance(page, instanceName(fake));
		const started = Date.now();
		const result = await syncSection(page, 'Quality Profiles');
		expect(result.status, 'The sync should succeed').toBe('idle');

		const held = heldProfile(fake, profile.name);
		const formats = fake.collection('customformat') as {
			name: string;
			includeCustomFormatWhenRenaming?: boolean;
		}[];
		const formatItems = held.formatItems as { name: string; score: number }[];
		expect(
			Object.fromEntries(formatItems.map((item) => [item.name, item.score])),
			'The profile should score its formats and 0 for every other'
		).toEqual(Object.fromEntries(formats.map((cf) => [cf.name, scores[cf.name] ?? 0])));
		expect(held, 'The profile settings should match the fixture').toMatchObject(
			expectedProfileSettings(profile)
		);
		expect(
			held.minUpgradeFormatScore,
			'The minimum upgrade step should be at least 1'
		).toBeGreaterThanOrEqual(1);

		expect(Object.keys(scores).length, 'The profile should score some formats').toBeGreaterThan(0);
		for (const name of Object.keys(scores)) {
			const format = formats.find((cf) => cf.name === name);
			expect(format, `${name} should be on the Arr`).toBeDefined();
			// The sync leaves the flag out when it's off, which the Arr reads as false
			expect(
				format?.includeCustomFormatWhenRenaming ?? false,
				`${name} should keep the fixture's include-in-rename flag`
			).toBe(fixture.customFormat(name).includeInRename);
		}
		const formatNames = formats.map((cf) => cf.name);
		for (const name of otherArrOnlyFormats(fake.type, scores)) {
			expect(formatNames, `${name} is only scored for the other Arr`).not.toContain(name);
		}

		const status = (await arrSyncStatus(page, id)).sync.qualityProfiles;
		expect(
			{ status: status.status, count: status.count },
			'The section should be idle with one profile'
		).toEqual({ status: 'idle', count: 1 });
		const run = await waitForJobRun(page, 'arr.sync.qualityProfiles', { after: started });
		expect(run.output, 'The run should count one profile').toBe('qualityProfiles: 1 item(s)');
	});
}

/**
 * Flow:
 * 1. The user sets up the Radarr fixture profile to sync and syncs Quality
 *    Profiles.
 * 2. The user syncs Quality Profiles again.
 *
 * Expects:
 * - the second sync sends no POST
 * - it updates the profile and each of its formats with PUT
 * - every collection keeps its length
 */
test('syncing twice updates by name', async ({ page, fakeRadarr }) => {
	const profile = profileFor(fakeRadarr.target);
	await setUpProfileSync(page, fakeRadarr, { profiles: [profile.name] });
	await syncSection(page, 'Quality Profiles');
	const lengths = () => ({
		qualityprofile: fakeRadarr.collection('qualityprofile').length,
		customformat: fakeRadarr.collection('customformat').length
	});
	const before = lengths();
	const from = fakeRadarr.requests.length;

	const result = await syncSection(page, 'Quality Profiles');

	expect(result.status, 'The second sync should succeed').toBe('idle');
	const sent = fakeRadarr.requests.slice(from);
	expect(
		sent.filter((r) => r.method === 'POST').map((r) => r.path),
		'The second sync should create nothing'
	).toEqual([]);
	const heldId = heldProfile(fakeRadarr, profile.name).id;
	expect(
		sent.filter((r) => r.method === 'PUT').map((r) => r.path),
		'The second sync should update the profile'
	).toContain(`/api/v3/qualityprofile/${heldId}`);
	const updatedFormats = sent
		.filter((r) => r.method === 'PUT' && r.path.startsWith('/api/v3/customformat/'))
		.map((r) => (r.body as { name: string }).name);
	expect(
		[...updatedFormats].sort(),
		'The second sync should update each format the profile scores'
	).toEqual(Object.keys(expectedScores(profile, fakeRadarr.type)).sort());
	expect(lengths(), 'Every collection should keep its length').toEqual(before);
});

/**
 * Flow:
 * 1. The user sets Media Management's Trigger to Manual and saves its
 *    choices.
 * 2. The user sets Delay Profiles' Trigger to Schedule and saves a delay
 *    profile.
 * 3. The user sets Quality Profiles' Trigger to On Pull and saves a profile.
 * 4. The user reloads the Sync page.
 *
 * Expects:
 * - the Sync page data holds every database id, config name, profile
 *   selection and trigger
 * - the dropdowns read `<label>: <database> / <config>`, the triggers show
 *   what was chosen, and the profile switches are on
 * - `/api/v1/status` counts one quality profile and reports delay profiles
 *   and media management as configured
 * - of the instance's sync jobs, Settings › Jobs lists only the delay
 *   profile schedule, due in the future
 * - opening the instance now lands on Library
 */
test('choices and triggers survive a reload', async ({ page, fakeRadarr }) => {
	const app = fakeRadarr.type;
	const naming = fixtures.naming[app][0].name;
	const definitions = fixtures.qualityDefinitions[app][0].name;
	const mediaSettings = fixtures.mediaSettings[app][0].name;
	const delayProfile = fixtures.delayProfiles[0].name;
	const profile = profileFor(fakeRadarr.target).name;

	await addArrAndOpenSync(page, fakeRadarr);
	const { id } = await arrInstance(page, instanceName(fakeRadarr));
	await setTrigger(page, 'Media Management', 'Manual');
	await chooseMediaManagement(page, fakeRadarr);
	await setTrigger(page, 'Delay Profiles', 'Schedule');
	await chooseDelayProfile(page, delayProfile);
	await setTrigger(page, 'Quality Profiles', 'On Pull');
	await chooseQualityProfiles(page, fakeRadarr, [profile]);
	await page.reload();
	await waitForHydration(page);

	const databaseId = await fixturesDatabaseId(page);
	const { syncData } = await syncConfig(page, id);
	expect(syncData.mediaManagement, 'Media Management should keep its choices').toMatchObject({
		namingDatabaseId: databaseId,
		namingConfigName: naming,
		qualityDefinitionsDatabaseId: databaseId,
		qualityDefinitionsConfigName: definitions,
		mediaSettingsDatabaseId: databaseId,
		mediaSettingsConfigName: mediaSettings,
		trigger: 'manual'
	});
	expect(syncData.delayProfiles, 'Delay Profiles should keep its choice').toMatchObject({
		databaseId,
		profileName: delayProfile,
		trigger: 'schedule'
	});
	expect(syncData.qualityProfiles, 'Quality Profiles should keep its selection').toMatchObject({
		selections: [{ databaseId, profileName: profile, qualityDefinitionsConfigName: null }],
		config: { trigger: 'on_pull' }
	});

	const shows = [
		['Media Management', `Naming: ${fromFixtures(naming)}`],
		['Media Management', `Quality Definitions: ${fromFixtures(definitions)}`],
		['Media Management', `Media Settings: ${fromFixtures(mediaSettings)}`],
		['Media Management', 'Trigger: Manual'],
		['Delay Profiles', 'Trigger: Schedule'],
		['Quality Profiles', 'Trigger: On Pull']
	] as const;
	for (const [section, name] of shows) {
		await expect(
			syncRegion(page, section).getByRole('button', { name, exact: true }),
			`${section} should show ${name}`
		).toBeVisible();
	}
	for (const [section, kind, name] of [
		['Delay Profiles', 'delay profile', delayProfile],
		['Quality Profiles', 'quality profile', profile]
	] as const) {
		await expect(
			syncRegion(page, section).getByRole('switch', {
				name: `Toggle ${kind} ${name} from ${FIXTURES_NAME}`
			}),
			`${name} should be on`
		).toHaveAttribute('aria-checked', 'true');
	}

	const { sync } = await arrSyncStatus(page, id);
	expect(sync.qualityProfiles.count, '/api/v1/status should count one quality profile').toBe(1);
	expect(sync.delayProfiles.configured, 'Delay profiles should be configured').toBe(true);
	expect(sync.mediaManagement.configured, 'Media management should be configured').toBe(true);

	const syncJobs = (await scheduledJobs(page)).filter(
		(job) => job.name.startsWith('arr.sync') && job.description.endsWith(`:${id}`)
	);
	expect(
		syncJobs.map((job) => job.description),
		'Only the scheduled delay profile sync should be queued'
	).toEqual([`arr.sync.delayProfiles:${id}`]);
	expect(
		new Date(syncJobs[0].next_run_at).getTime(),
		'The delay profile sync should be due in the future'
	).toBeGreaterThan(Date.now());

	await openArr(page, instanceName(fakeRadarr));
	await expect(page, 'The instance should now open on Library').toHaveURL(
		(url) => url.pathname === `/arr/${id}/library`
	);
});
