/**
 * - Protects: upgrade runs, from Dry Run and the `run` action through the
 *   `arr.upgrade` job, the requests it sends the Arr, and the run history,
 *   filter index and schedule the app database stores.
 * - A dry run only looks up releases. A live run searches, records what the
 *   Arr grabbed and tags each searched title with the filter's cooldown tag.
 * - Tagged titles wait until every match has been searched, then the tags
 *   are cleared and the pool starts again.
 * - Each test sets a yearly schedule, so no scheduled run lands during it.
 *   Live runs post the `run` action, as the dev-only Live Run button does.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '$flows/helpers/core/test.ts';
import { waitForAction } from '$flows/helpers/core/forms.ts';
import { latestJobRunId, scheduledJobs } from '$flows/helpers/core/jobs.ts';
import { logEntries } from '$flows/helpers/core/logs.ts';
import { createNotificationService } from '$flows/helpers/settings/notifications.ts';
import { addArr, arrInstance } from '$flows/helpers/sync/arrs.ts';
import type { FakeArr } from '$flows/helpers/sync/fakeArr.ts';
import {
	episodeFile,
	movieFile,
	queueRecord,
	radarrMovie,
	release,
	seedLibrary,
	sonarrSeries,
	taggedIds,
	type Library
} from '$flows/helpers/sync/library.ts';
import {
	addDefaultFilter,
	dryRun,
	editFilter,
	liveRun,
	openUpgrades,
	resetDryRunCache,
	saveUpgrades,
	setUpgradeCore,
	upgradesData,
	type FilterChanges,
	type UpgradeCore,
	type UpgradeRun
} from '$flows/helpers/sync/upgrades.ts';

/** Once a year, so no scheduled run lands during a test */
const YEARLY: UpgradeCore['schedule'] = { custom: '0 3 1 1 *' };
/** The cooldown tag a filter named "Filter" gets */
const FILTER_TAG = 'profilarr-filter';
const DRY_RUN_COOLDOWN = 'Dry run cooldown active. Try again in 10 minutes.';

/** The instance name each test gives its fake */
const nameOf = (fake: FakeArr) => `Flow ${fake.target.label}`;

/** Requests the fake got with this method and path, from request `from` on */
const requests = (fake: FakeArr, method: string, path: string, from = 0) =>
	fake.requests.slice(from).filter((r) => r.method === method && r.path === path);

/** Requests the fake got that change something, from request `from` on */
const writes = (fake: FakeArr, from: number) =>
	fake.requests
		.slice(from)
		.filter((r) => r.method !== 'GET')
		.map((r) => `${r.method} ${r.path}`);

/** A run's selected item ids, in the order it picked them */
const pickedIds = (run: UpgradeRun) => run.selection.items.map((item) => item.id);

/** The newest stored run */
async function newestRun(page: Page, id: number): Promise<UpgradeRun> {
	const [run] = (await upgradesData(page, id)).upgradeRuns;
	if (!run) throw new Error('No upgrade run is stored');
	return run;
}

/** The run history's row for a run, by text only its row holds */
const historyRow = (page: Page, text: string) =>
	page.getByRole('main').getByRole('row').filter({ hasText: text });

/**
 * Seed the library, add the fake and open its Upgrades tab, turn upgrades on
 * with a yearly schedule and one Default filter, change the filter and save.
 * Returns the instance id.
 */
async function setUp(
	page: Page,
	fake: FakeArr,
	library: Library,
	filter: FilterChanges = {}
): Promise<number> {
	await seedLibrary(fake, library);
	await addArr(page, { name: nameOf(fake), fake });
	const { id } = await arrInstance(page, nameOf(fake));
	await openUpgrades(page, nameOf(fake));
	await setUpgradeCore(page, { enabled: true, schedule: YEARLY });
	await addDefaultFilter(page);
	await editFilter(page, 'Filter', filter);
	await saveUpgrades(page);
	return id;
}

/** Two movies with files scoring 10 and 60, A added first */
const SCORED_MOVIES: Library = {
	items: [
		radarrMovie({ id: 1, title: 'Alpha', added: '2020-01-01T00:00:00Z' }),
		radarrMovie({ id: 2, title: 'Bravo', added: '2021-01-01T00:00:00Z' })
	],
	files: [movieFile(1, 10), movieFile(2, 60)]
};

/** What an interactive search finds for each movie: a rejected 90, then approved 50 and 30 */
const RELEASES = [
	release('Movie.2160p.Rejected', 90, { approved: false, rejected: true }),
	release('Movie.1080p.Upgrade', 50),
	release('Movie.720p.Smaller', 30)
];

/** Three movies that match the default rules, added in the order A, B, C */
const THREE_MOVIES: Library = {
	items: [
		radarrMovie({ id: 1, title: 'Alpha', added: '2019-01-01T00:00:00Z' }),
		radarrMovie({ id: 2, title: 'Bravo', added: '2020-01-01T00:00:00Z' }),
		radarrMovie({ id: 3, title: 'Charlie', added: '2021-01-01T00:00:00Z' })
	],
	files: [movieFile(1, 10), movieFile(2, 20), movieFile(3, 30)]
};

/** Two titles that match the default rules, A added first */
function twoTitles(fake: FakeArr, tags: string[] = []): Library {
	if (fake.type === 'radarr') {
		return {
			items: [
				radarrMovie({ id: 1, title: 'Alpha', added: '2019-01-01T00:00:00Z', tags }),
				radarrMovie({ id: 2, title: 'Bravo', added: '2020-01-01T00:00:00Z', tags })
			],
			files: [movieFile(1, 10), movieFile(2, 20)]
		};
	}
	const seasons = [{ seasonNumber: 1, episodeFileCount: 1 }];
	return {
		items: [
			sonarrSeries({ id: 1, title: 'Alpha', added: '2019-01-01T00:00:00Z', tags, seasons }),
			sonarrSeries({ id: 2, title: 'Bravo', added: '2020-01-01T00:00:00Z', tags, seasons })
		],
		files: [episodeFile(1, 1, 10), episodeFile(2, 1, 20)]
	};
}

/**
 * Flow:
 * 1. A's file scores 10 and B's 60. A search finds a rejected release
 *    scoring 90, then approved ones at 50 and 30.
 * 2. The user saves a filter with Method Oldest and Count 2, and clicks Dry
 *    Run.
 *
 * Expects:
 * - the job run succeeds with `Processed 2 item(s) using "Filter"`
 * - the newest run is a dry run that succeeded, searched 2 and upgraded 1:
 *   A's upgrade is the 50 release over its score of 10, B has none
 * - two GET release, for A and B; no command, tag or movie update
 * - the run history row reads "Dry Run", "Success" and "1 upgraded"
 */
test('a Radarr dry run records the best approved release above the current score', async ({
	page,
	fakeRadarr: fake
}) => {
	fake.answer('GET', 'release', RELEASES);
	const id = await setUp(page, fake, SCORED_MOVIES, { method: 'Oldest', count: 2 });
	const from = fake.requests.length;

	const job = await dryRun(page);

	expect(job.status, `The job should succeed: ${job.error}`).toBe('success');
	expect(job.output, 'The job should report what it processed').toBe(
		'Processed 2 item(s) using "Filter"'
	);
	const run = await newestRun(page, id);
	expect(
		{ dryRun: run.config.dryRun, status: run.status, ...run.results },
		'The run should be a successful dry run with one upgrade'
	).toEqual({
		dryRun: true,
		status: 'success',
		searchesTriggered: 2,
		successful: 1,
		failed: 0,
		errors: []
	});
	expect(run.selection.items, 'A should get the 50 release, B nothing').toEqual([
		{
			id: 1,
			title: 'Alpha',
			original: { type: 'movie', fileName: 'Movie 1.mkv', formats: [], score: 10 },
			upgrades: [{ release: 'Movie.1080p.Upgrade', formats: [], score: 50 }]
		},
		{
			id: 2,
			title: 'Bravo',
			original: { type: 'movie', fileName: 'Movie 2.mkv', formats: [], score: 60 },
			upgrades: []
		}
	]);
	expect(
		requests(fake, 'GET', '/api/v3/release', from).map((r) => r.query.get('movieId')),
		'Releases should be looked up for A and B'
	).toEqual(['1', '2']);
	expect(writes(fake, from), 'A dry run should change nothing').toEqual([]);
	const row = historyRow(page, 'Dry Run');
	for (const text of ['Dry Run', 'Success', '1 upgraded']) {
		await expect(row, `The run history row should read "${text}"`).toContainText(text);
	}
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. Season 1 is monitored with files scoring 10 and 20, season 2 monitored
 *    with a file scoring 30, season 3 unmonitored with a file. A search
 *    finds one approved release at 50.
 * 2. The user saves a filter and clicks Dry Run.
 *
 * Expects:
 * - exactly one GET release, for the series and season 2
 * - the item searched season 2 and its upgrade is the 50 release on season 2
 * - nothing is written to the Arr
 */
test('a Sonarr dry run looks at the newest monitored season that has files', async ({
	page,
	fakeSonarr: fake
}) => {
	fake.answer('GET', 'release', [release('Series.S02.Upgrade', 50)]);
	const id = await setUp(page, fake, {
		items: [
			sonarrSeries({
				id: 1,
				title: 'Seasons',
				seasons: [
					{ seasonNumber: 1, episodeFileCount: 2 },
					{ seasonNumber: 2, episodeFileCount: 1 },
					{ seasonNumber: 3, episodeFileCount: 1, monitored: false }
				]
			})
		],
		files: [
			episodeFile(1, 1, 10),
			episodeFile(1, 1, 20),
			episodeFile(1, 2, 30),
			episodeFile(1, 3, 5)
		]
	});
	const from = fake.requests.length;

	await dryRun(page);

	expect(
		requests(fake, 'GET', '/api/v3/release', from).map((r) => [
			r.query.get('seriesId'),
			r.query.get('seasonNumber')
		]),
		'One release lookup should go to season 2'
	).toEqual([['1', '2']]);
	const [item] = (await newestRun(page, id)).selection.items;
	expect(item.searchedSeasonNumber, 'Season 2 should be searched').toBe(2);
	expect(item.upgrades, 'The upgrade should be the 50 release on season 2').toEqual([
		{ release: 'Series.S02.Upgrade', formats: [], score: 50, seasonNumber: 2 }
	]);
	expect(writes(fake, from), 'A dry run should change nothing').toEqual([]);
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. The series' only season with files is unmonitored.
 * 2. The user saves a filter and clicks Dry Run.
 *
 * Expects:
 * - no GET release
 * - the item has no upgrades and no searched season
 * - the run succeeded with no searches
 */
test('a Sonarr dry run skips a series with no eligible season', async ({
	page,
	fakeSonarr: fake
}) => {
	const id = await setUp(page, fake, {
		items: [
			sonarrSeries({
				id: 1,
				title: 'Unwatched Season',
				seasons: [
					{ seasonNumber: 1, episodeFileCount: 2, monitored: false },
					{ seasonNumber: 2, episodeFileCount: 0 }
				]
			})
		],
		files: [episodeFile(1, 1, 10), episodeFile(1, 1, 20)]
	});
	const from = fake.requests.length;

	await dryRun(page);

	expect(requests(fake, 'GET', '/api/v3/release', from), 'No release should be looked up').toEqual(
		[]
	);
	const run = await newestRun(page, id);
	expect(
		run.selection.items.map((item) => item.upgrades),
		'No upgrade should be found'
	).toEqual([[]]);
	expect(
		run.selection.items[0].searchedSeasonNumber,
		'No season should be searched'
	).toBeUndefined();
	expect(
		{ status: run.status, searchesTriggered: run.results.searchesTriggered },
		'The run should succeed with no searches'
	).toEqual({ status: 'success', searchesTriggered: 0 });
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. R1's library and filter. The user clicks Dry Run.
 * 2. The user clicks Dry Run again.
 * 3. The user clicks Reset Cache.
 *
 * Expects:
 * - the second `run` action fails with "Dry run cooldown active. Try again
 *   in 10 minutes.", shown as an alert, and no new job runs
 * - Reset Cache shows "Dry run cache cleared"
 * - the log reads "Dry run cache cleared for <instance>: 2 items removed"
 */
test('a second dry run within 10 minutes is refused, and Reset Cache clears the picks', async ({
	page,
	fakeRadarr: fake
}) => {
	fake.answer('GET', 'release', RELEASES);
	await setUp(page, fake, SCORED_MOVIES, { method: 'Oldest', count: 2 });
	const first = await dryRun(page);

	const refused = waitForAction(page, 'run');
	await page.getByRole('main').getByRole('button', { name: 'Dry Run', exact: true }).click();
	const result = await refused;
	expect(result.type, 'The second dry run should be refused').toBe('failure');
	expect(result.data, `The refusal should say "${DRY_RUN_COOLDOWN}"`).toEqual({
		error: DRY_RUN_COOLDOWN
	});
	await expect(
		page.getByText(DRY_RUN_COOLDOWN, { exact: true }).last(),
		'The refusal should show'
	).toBeVisible();
	expect(await latestJobRunId(page, 'arr.upgrade'), 'No new job should run').toBe(first.id);

	await resetDryRunCache(page);
	await expect(
		page.getByText('Dry run cache cleared', { exact: true }).last(),
		'Reset Cache should confirm'
	).toBeVisible();
	const message = `Dry run cache cleared for ${nameOf(fake)}: 2 items removed`;
	expect(await logEntries(page, { message }), `The log should read "${message}"`).toHaveLength(1);
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. A, B and C match. MoviesSearch completes with "1 reports downloaded"
 *    and leaves a queue record for A scoring 70 with HDR.
 * 2. The user saves a filter with Method Oldest and Count 2, and a live run
 *    starts.
 *
 * Expects:
 * - one POST command for A and B, and at least one status check of it
 * - the run is live, succeeded, searched 2, upgraded 1, with 3 after
 *   cooldown
 * - A's upgrade is what the Arr grabbed
 */
test('a Radarr live run records what the Arr grabbed', async ({ page, fakeRadarr: fake }) => {
	const grab = queueRecord('Alpha.2160p.HDR', 70, { movieId: 1, formats: ['HDR'] });
	fake.commandOutcome('MoviesSearch', {
		status: 'completed',
		message: '1 reports downloaded',
		queue: [grab]
	});
	const id = await setUp(page, fake, THREE_MOVIES, { method: 'Oldest', count: 2 });

	const job = await liveRun(page, id);

	expect(job.status, `The job should succeed: ${job.error}`).toBe('success');
	expect(fake.commands(), 'One search should go out for A and B').toEqual([
		{ name: 'MoviesSearch', movieIds: [1, 2] }
	]);
	expect(
		requests(fake, 'GET', '/api/v3/command/1').length,
		'The run should check the command'
	).toBeGreaterThan(0);
	const run = await newestRun(page, id);
	expect(
		{
			dryRun: run.config.dryRun,
			status: run.status,
			searchesTriggered: run.results.searchesTriggered,
			successful: run.results.successful,
			afterCooldown: run.filter.afterCooldown
		},
		'The run should be a live run with one grab'
	).toEqual({
		dryRun: false,
		status: 'success',
		searchesTriggered: 2,
		successful: 1,
		afterCooldown: 3
	});
	expect(run.selection.items[0].upgrades, "A's upgrade should be the grab").toEqual([
		{ release: 'Alpha.2160p.HDR', formats: ['HDR'], score: 70 }
	]);
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. Series S has seasons 1 and 2. SeriesSearch completes with "2 reports
 *    downloaded" and leaves three queue records: two of one download, a
 *    season 1 pack, and one of season 2.
 * 2. The user saves a filter and a live run starts.
 *
 * Expects:
 * - `POST command { name: 'SeriesSearch', seriesId: S }` and GET
 *   episodefile for S
 * - the run's upgrades are two entries, seasons 1 and 2, and it upgraded 1
 */
test('a Sonarr live run searches series one by one and merges season-pack grabs', async ({
	page,
	fakeSonarr: fake
}) => {
	fake.commandOutcome('SeriesSearch', {
		status: 'completed',
		message: '2 reports downloaded',
		queue: [
			queueRecord('Series.S01.Pack', 90, { seriesId: 1, seasonNumber: 1, downloadId: 'pack' }),
			queueRecord('Series.S01.Pack', 90, { seriesId: 1, seasonNumber: 1, downloadId: 'pack' }),
			queueRecord('Series.S02E01', 60, { seriesId: 1, seasonNumber: 2, downloadId: 'single' })
		]
	});
	const id = await setUp(page, fake, {
		items: [
			sonarrSeries({
				id: 1,
				title: 'Packed',
				seasons: [
					{ seasonNumber: 1, episodeFileCount: 2 },
					{ seasonNumber: 2, episodeFileCount: 1 }
				]
			})
		],
		files: [episodeFile(1, 1, 10), episodeFile(1, 1, 10), episodeFile(1, 2, 20)]
	});

	const job = await liveRun(page, id);

	expect(job.status, `The job should succeed: ${job.error}`).toBe('success');
	expect(fake.commands(), 'One search should go out for S').toEqual([
		{ name: 'SeriesSearch', seriesId: 1 }
	]);
	expect(
		requests(fake, 'GET', '/api/v3/episodefile').map((r) => r.query.get('seriesId')),
		"S's episode files should be read"
	).toContain('1');
	const run = await newestRun(page, id);
	expect(run.selection.items[0].upgrades, 'The season pack should count once').toEqual([
		{ release: 'Series.S01.Pack', formats: [], score: 90, seasonNumber: 1 },
		{ release: 'Series.S02E01', formats: [], score: 60, seasonNumber: 2 }
	]);
	expect(run.results.successful, 'The series should count as upgraded once').toBe(1);
	expect(fake.unhandled).toEqual([]);
});

/** Two live runs on A and B with Method Oldest and Count 1; returns the stored runs, oldest first */
async function twoCooldownRuns(page: Page, id: number): Promise<UpgradeRun[]> {
	const runs: UpgradeRun[] = [];
	for (let count = 0; count < 2; count++) {
		const job = await liveRun(page, id);
		expect(job.status, `The live run should succeed: ${job.error}`).toBe('success');
		runs.push(await newestRun(page, id));
	}
	return runs;
}

/** The command a live run sends for one title */
const searchFor = (fake: FakeArr, itemId: number) =>
	fake.type === 'radarr'
		? { name: 'MoviesSearch', movieIds: [itemId] }
		: { name: 'SeriesSearch', seriesId: itemId };

/**
 * Flow:
 * 1. A was added before B, and both match. The user saves a filter with
 *    Method Oldest and Count 1.
 * 2. Two live runs start.
 *
 * Expects:
 * - run 1 searches A and tags it, with 2 after cooldown
 * - run 2 skips A and searches B, with 1 after cooldown
 */
test('a tagged title is skipped', async ({ page, fakeRadarr: fake }) => {
	const id = await setUp(page, fake, twoTitles(fake), { method: 'Oldest', count: 1 });

	const [first, second] = await twoCooldownRuns(page, id);

	expect(fake.commands(), 'Run 1 should search A, run 2 B').toEqual([
		searchFor(fake, 1),
		searchFor(fake, 2)
	]);
	expect([pickedIds(first), first.filter.afterCooldown], 'Run 1 should pick A of 2').toEqual([
		[1],
		2
	]);
	expect([pickedIds(second), second.filter.afterCooldown], 'Run 2 should pick B of 1').toEqual([
		[2],
		1
	]);
	expect(taggedIds(fake, FILTER_TAG), 'A and B should carry the tag').toEqual([1, 2]);
	expect(fake.unhandled).toEqual([]);
});

for (const targetId of ['radarr-6', 'sonarr-4']) {
	/**
	 * Flow:
	 * 1. C1: two live runs search A, then B.
	 * 2. A third live run starts.
	 *
	 * Expects:
	 * - the third run takes the tag off A and B: Radarr sends each movie
	 *   without the tag, Sonarr one editor `remove` for both
	 * - it then searches A again, with 2 after cooldown
	 * - the run history lists the three runs, newest first
	 */
	test(`an exhausted pool clears the tags and starts again from the top (${targetId})`, async ({
		page,
		startArr
	}) => {
		const fake = await startArr(targetId);
		const id = await setUp(page, fake, twoTitles(fake), { method: 'Oldest', count: 1 });
		await twoCooldownRuns(page, id);
		const tagId = fake.collection('tag').find((tag) => tag.label === FILTER_TAG)?.id;
		const from = fake.requests.length;

		const job = await liveRun(page, id);

		expect(job.status, `The third run should succeed: ${job.error}`).toBe('success');
		if (fake.type === 'radarr') {
			const resets = [1, 2].map(
				(movieId) => requests(fake, 'PUT', `/api/v3/movie/${movieId}`, from)[0]
			);
			expect(
				resets.map((r) => (r?.body as { tags?: number[] } | undefined)?.tags),
				'A and B should each be sent without the tag'
			).toEqual([[], []]);
		} else {
			expect(
				requests(fake, 'PUT', '/api/v3/series/editor', from)[0]?.body,
				'One editor call should take the tag off A and B'
			).toEqual({ seriesIds: [1, 2], tags: [tagId], applyTags: 'remove' });
		}
		expect(fake.commands().at(-1), 'The third run should search A again').toEqual(
			searchFor(fake, 1)
		);
		const { upgradeRuns } = await upgradesData(page, id);
		expect(
			[pickedIds(upgradeRuns[0]), upgradeRuns[0].filter.afterCooldown],
			'The third run should pick A of 2'
		).toEqual([[1], 2]);
		const started = upgradeRuns.map((run) => run.startedAt);
		expect(started, 'The run history should hold three runs').toHaveLength(3);
		expect(started, 'The run history should list the newest first').toEqual(
			[...started].sort().reverse()
		);
		const rows = page.getByRole('main').getByRole('row').filter({ hasText: /#\d/ });
		await expect(rows, 'The run history should show three rows').toHaveCount(3);
		for (const [index, number] of ['#3', '#2', '#1'].entries()) {
			await expect(rows.nth(index), `Row ${index + 1} should be run ${number}`).toContainText(
				number
			);
		}
		expect(fake.unhandled).toEqual([]);
	});
}

/**
 * Flow:
 * 1. C2 on Radarr: three live runs search A, B, then A again after the
 *    reset.
 *
 * Expects:
 * - after the third run, A carries the tag in the Arr and B doesn't
 */
test("the reset run's picks get the tag again", async ({ page, fakeRadarr: fake }) => {
	const id = await setUp(page, fake, twoTitles(fake), { method: 'Oldest', count: 1 });
	await twoCooldownRuns(page, id);

	const job = await liveRun(page, id);

	expect(job.status, `The third run should succeed: ${job.error}`).toBe('success');
	expect(taggedIds(fake, FILTER_TAG), 'Only A should carry the tag again').toEqual([1]);
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. A and B match and both carry the filter's tag.
 * 2. The user saves a filter with Oldest and count 1, then clicks Dry Run.
 *
 * Expects:
 * - no tag removal is sent, and A and B keep their tags
 * - the dry run previews the pool as if reset: it picks A of 2
 */
test('a dry run on an exhausted pool changes nothing', async ({ page, fakeRadarr: fake }) => {
	const id = await setUp(page, fake, twoTitles(fake, [FILTER_TAG]), { method: 'Oldest', count: 1 });
	const from = fake.requests.length;

	await dryRun(page);

	expect(writes(fake, from), 'A dry run should send no tag removal').toEqual([]);
	expect(taggedIds(fake, FILTER_TAG), 'A and B should keep their tags').toEqual([1, 2]);
	const run = await newestRun(page, id);
	expect(run.config.dryRun, 'The dry run should be stored').toBe(true);
	expect(
		[pickedIds(run), run.filter.afterCooldown],
		'The dry run should preview the pool as if reset and pick A of 2'
	).toEqual([[1], 2]);
	expect(fake.unhandled).toEqual([]);
});

/** Add filters named First, Second and so on, with the last ones disabled, and save */
async function addNamedFilters(
	page: Page,
	names: string[],
	disabled: string[] = []
): Promise<void> {
	// The first is the Default filter "Filter" that setUp saved
	await editFilter(page, 'Filter', { rename: names[0] });
	for (const [index, name] of names.slice(1).entries()) {
		await addDefaultFilter(page);
		await editFilter(page, `Filter ${index + 2}`, {
			rename: name,
			...(disabled.includes(name) ? { enabled: false } : {})
		});
	}
	await saveUpgrades(page);
}

/**
 * Flow:
 * 1. The user saves filters "First" and "Second", plus a disabled "Third".
 * 2. Three live runs start.
 *
 * Expects:
 * - the runs use First, Second, then First
 * - the stored filter index moves after each run and wraps: 1, 0, 1
 * - no run uses Third
 */
test('round robin runs each enabled filter in turn', async ({ page, fakeRadarr: fake }) => {
	const id = await setUp(page, fake, twoTitles(fake));
	await addNamedFilters(page, ['First', 'Second', 'Third'], ['Third']);

	const used: string[] = [];
	const indexes: number[] = [];
	for (let count = 0; count < 3; count++) {
		const job = await liveRun(page, id);
		expect(job.status, `The live run should succeed: ${job.error}`).toBe('success');
		const { config, upgradeRuns } = await upgradesData(page, id);
		used.push(upgradeRuns[0].config.selectedFilter);
		indexes.push(config?.currentFilterIndex ?? -1);
	}

	expect(used, 'The runs should take the enabled filters in turn').toEqual([
		'First',
		'Second',
		'First'
	]);
	expect(indexes, 'The filter index should move after each run and wrap').toEqual([1, 0, 1]);
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. The user saves five enabled filters with Mode Random Shuffle.
 * 2. Ten live runs start.
 *
 * Expects:
 * - each round of five runs uses every filter exactly once
 */
test('Random Shuffle runs each filter once per round', async ({ page, fakeRadarr: fake }) => {
	const names = ['One', 'Two', 'Three', 'Four', 'Five'];
	const id = await setUp(page, fake, twoTitles(fake));
	await setUpgradeCore(page, { mode: 'Random Shuffle' });
	await addNamedFilters(page, names);

	const used: string[] = [];
	for (let count = 0; count < 2 * names.length; count++) {
		const job = await liveRun(page, id);
		expect(job.status, `The live run should succeed: ${job.error}`).toBe('success');
		used.push((await newestRun(page, id)).config.selectedFilter);
	}

	expect(used.slice(0, 5).sort(), 'The first round should use every filter once').toEqual(
		[...names].sort()
	);
	expect(used.slice(5).sort(), 'The second round should use every filter once').toEqual(
		[...names].sort()
	);
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. MoviesSearch ends failed with "Indexer unavailable". The user saves two
 *    filters.
 * 2. A live run starts.
 *
 * Expects:
 * - the job run fails with "Command 1 failed: Indexer unavailable"
 * - the stored run failed, and its first error starts "Search failed:"
 * - no tag is created and no movie updated
 * - the filter index stays 0
 */
test('a failed search command fails the run', async ({ page, fakeRadarr: fake }) => {
	fake.commandOutcome('MoviesSearch', { status: 'failed', message: 'Indexer unavailable' });
	const id = await setUp(page, fake, twoTitles(fake));
	await addNamedFilters(page, ['First', 'Second']);
	const from = fake.requests.length;

	const job = await liveRun(page, id);

	expect(job.status, 'The job should fail').toBe('failure');
	expect(job.error, 'The job should say the command failed').toBe(
		'Search failed: Command 1 failed: Indexer unavailable'
	);
	const { config, upgradeRuns } = await upgradesData(page, id);
	expect(upgradeRuns[0].status, 'The run should be stored as failed').toBe('failed');
	expect(upgradeRuns[0].results.errors[0], 'The error should name the search').toMatch(
		/^Search failed:/
	);
	expect(writes(fake, from), 'Only the search should be sent').toEqual(['POST /api/v3/command']);
	expect(config?.currentFilterIndex, 'The filter index should not move').toBe(0);
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. A Webhook service has Upgrade Failed on.
 * 2. The user saves a filter. The Arr answers its library with 404.
 * 3. A live run starts.
 *
 * Expects:
 * - the job run fails
 * - the run history has a Failed run holding the error
 * - the webhook gets one `upgrade.failed`, whose message gives the error
 * - no search is sent and the filter index stays 0
 */
test("a run that can't read the library is recorded and notified", async ({
	page,
	fakeRadarr: fake,
	fakeWebhook
}) => {
	const hook = '/hooks/upgrades';
	await createNotificationService(page, {
		name: 'Upgrades Webhook',
		url: fakeWebhook.url(hook),
		types: ['Upgrade Failed']
	});
	const id = await setUp(page, fake, twoTitles(fake));
	// 404, not 500: the client retries a 500
	fake.fail('GET', '/api/v3/movie', 404);

	const job = await liveRun(page, id);

	expect(job.status, 'The job should fail').toBe('failure');
	const { config, upgradeRuns } = await upgradesData(page, id);
	expect(
		upgradeRuns.map((run) => [run.status, run.results.errors]),
		'The failed run should be recorded with its error'
	).toEqual([['failed', ['HTTP 404: Not Found']]]);
	await expect(
		historyRow(page, 'Failed'),
		'The run history should show the failed run'
	).toBeVisible();
	await expect
		.poll(
			() =>
				fakeWebhook.requests
					.filter((request) => request.path === hook)
					.map((request) => (request.body as { type?: string } | null)?.type),
			{ message: 'The webhook should get one upgrade.failed' }
		)
		.toEqual(['upgrade.failed']);
	const [notified] = fakeWebhook.requests.filter((request) => request.path === hook);
	expect(
		(notified.body as { message?: string }).message,
		'The notification should give the error'
	).toBe(`Upgrade failed for ${nameOf(fake)}: HTTP 404: Not Found`);
	expect(fake.commands(), 'No search should be sent').toEqual([]);
	expect(config?.currentFilterIndex, 'The filter index should not move').toBe(0);
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. The library holds only unmonitored movies.
 * 2. The user saves a filter and clicks Dry Run.
 *
 * Expects:
 * - the run is stored as a success that matched and selected nothing
 * - the job run is skipped with `Processed 0 item(s) using "Filter"`
 * - no release is looked up
 */
test('a filter that matches nothing records an empty run', async ({ page, fakeRadarr: fake }) => {
	const id = await setUp(page, fake, {
		items: [
			radarrMovie({ id: 1, title: 'Alpha', monitored: false }),
			radarrMovie({ id: 2, title: 'Bravo', monitored: false })
		]
	});

	const job = await dryRun(page);

	const run = await newestRun(page, id);
	expect(
		[run.status, run.filter.matchedCount, run.selection.actualCount],
		'The run should be an empty success'
	).toEqual(['success', 0, 0]);
	expect([job.status, job.output], 'The job should be skipped').toEqual([
		'skipped',
		'Processed 0 item(s) using "Filter"'
	]);
	expect(requests(fake, 'GET', '/api/v3/release'), 'No release should be looked up').toEqual([]);
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. The user saves a filter. A dry run runs, then a live run whose search
 *    fails.
 * 2. Profilarr restarts.
 *
 * Expects:
 * - the config, its filter index, and every run with its items and errors
 *   are the same as before the restart
 * - the scheduled job keeps its next run
 */
test('the config and run history survive a restart', async ({ app, page, fakeRadarr: fake }) => {
	fake.answer('GET', 'release', RELEASES);
	fake.commandOutcome('MoviesSearch', { status: 'failed', message: 'Indexer unavailable' });
	const id = await setUp(page, fake, SCORED_MOVIES, { method: 'Oldest', count: 2 });
	await dryRun(page);
	expect((await liveRun(page, id)).status, 'The live run should fail').toBe('failure');
	const before = await upgradesData(page, id);
	expect(before.upgradeRuns, 'Both runs should be stored').toHaveLength(2);
	const job = async () =>
		(await scheduledJobs(page)).find((j) => j.description === `arr.upgrade:${id}`)?.next_run_at;
	const nextRun = await job();
	expect(nextRun, 'The upgrade job should be scheduled').toBeDefined();

	await app.restart();

	expect(await upgradesData(page, id), 'The config and runs should survive').toEqual(before);
	expect(await job(), 'The job should keep its next run').toBe(nextRun);
	expect(fake.unhandled).toEqual([]);
});
