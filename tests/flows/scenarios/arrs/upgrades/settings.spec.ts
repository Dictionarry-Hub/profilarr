/**
 * - Protects: an Arr's upgrade settings, from the Upgrades tab through the
 *   config the app database stores: the schedule, the mode, and each filter
 *   with its rules, method, count, cutoff and cooldown tag.
 * - The server keeps the schedule and counts inside the indexer limits, and
 *   an import never brings in a field the app lacks.
 * - Preview and the filters pick exactly the titles their rules match, in
 *   the selector's order, and the right ids reach the Arr.
 * - Nothing here starts a search, except F1 to F3, which check the ids a
 *   live run sends.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '#flows/helpers/core/test.ts';
import { waitForAction } from '#flows/helpers/core/forms.ts';
import { latestJobRunId, scheduledJobs } from '#flows/helpers/core/jobs.ts';
import { waitForHydration } from '#flows/helpers/core/nav.ts';
import { pick } from '#flows/helpers/core/pageData.ts';
import { addArr, arrInstance } from '#flows/helpers/sync/arrs.ts';
import type { FakeArr } from '#flows/helpers/sync/fakeArr.ts';
import {
	episodeFile,
	movieFile,
	radarrMovie,
	seedLibrary,
	sonarrSeries,
	taggedIds,
	type Library,
	type LibraryEntry
} from '#flows/helpers/sync/library.ts';
import { TARGETS } from '#flows/helpers/sync/targets.ts';
import {
	addDefaultFilter,
	buildRules,
	clearOfScheduleMark,
	closePreview,
	defaultGroup,
	dryRun,
	editFilter,
	filterPanel,
	filterRow,
	importFilter,
	liveRun,
	openUpgrades,
	postPreview,
	previewDialog,
	previewFilter,
	previewIds,
	saveUpgrades,
	setUpgradeCore,
	upgradesData,
	type FilterGroup,
	type FilterPreview,
	type FilterRule,
	type GroupInput
} from '#flows/helpers/sync/upgrades.ts';

const TAG = 'flow-tag';
/** Only spaces: the save drops it, so the filter is stored with no tag */
const BLANK_TAG = '   ';
const NO_FILTER_ENABLED = 'Add and enable at least one filter before running';
const DISABLED_HINT = 'Enable upgrades to configure filters and view run history.';
/** The cooldown tag a filter named "Filter" gets */
const FILTER_TAG = 'profilarr-filter';

/** The instance name each test gives its fake */
const nameOf = (fake: FakeArr) => `Flow ${fake.target.label}`;

/** An alert with this text, the newest when several show */
const alert = (page: Page, text: string) => page.getByText(text, { exact: true }).last();

/** The ids of a preview's items that match the filter, sorted */
const matchedIds = (preview: FilterPreview) =>
	preview.items
		.filter((item) => item.status !== 'filtered_out')
		.map((item) => item.id)
		.sort((a, b) => a - b);

/** Requests the fake got that change something, from request `from` on */
const writes = (fake: FakeArr, from: number) =>
	fake.requests
		.slice(from)
		.filter((r) => r.method !== 'GET')
		.map((r) => `${r.method} ${r.path}`);

/** Seed the library, add the fake and open its Upgrades tab. Returns the instance id. */
async function setUp(page: Page, fake: FakeArr, library?: Library): Promise<number> {
	if (library) await seedLibrary(fake, library);
	await addArr(page, { name: nameOf(fake), fake });
	const { id } = await arrInstance(page, nameOf(fake));
	await openUpgrades(page, nameOf(fake));
	return id;
}

/** The Upgrades tab's buttons */
const button = (page: Page, name: string) =>
	page.getByRole('main').getByRole('button', { name, exact: true });

/** A stored rule, to compare with what the app saved */
const rule = (field: string, operator: string, value: FilterRule['value']): FilterRule => ({
	type: 'rule',
	field,
	operator,
	value
});

/**
 * Flow:
 * 1. The user adds the fake and opens Upgrades, then turns Status on.
 * 2. The user sets Frequency "Every" 30 minutes and Mode "Random Shuffle".
 * 3. The user adds a Default filter with Method Oldest, Count 3, Cutoff %
 *    80 and Cooldown Tag "flow-tag".
 * 4. The user adds a second Default filter and disables it.
 * 5. The user adds a third Default filter and types only spaces as its
 *    Cooldown Tag.
 * 6. The user saves and reloads.
 *
 * Expects:
 * - the config is on, every 30 minutes, Random Shuffle, at filter index 0
 * - the first filter holds the settings and the Radarr default rules, and
 *   the second is disabled
 * - the second and third filters are stored with no tag: the second's field
 *   was left empty, and the third's held only spaces
 * - the next run is at most 30 minutes away, there is no last run, and
 *   Settings › Jobs lists `arr.upgrade:{id}` at that time
 * - after the reload the controls show the same values and Save is off
 * - the fake got no POST, PUT or DELETE
 */
test('settings, the schedule and filters survive a reload', async ({ page, fakeRadarr }) => {
	const id = await setUp(page, fakeRadarr);
	const from = fakeRadarr.requests.length;
	await setUpgradeCore(page, { enabled: true, schedule: { every: 30 }, mode: 'Random Shuffle' });
	await addDefaultFilter(page);
	await editFilter(page, 'Filter', { method: 'Oldest', count: 3, cutoff: 80, tag: TAG });
	await addDefaultFilter(page);
	await editFilter(page, 'Filter 2', { enabled: false });
	await addDefaultFilter(page);
	await editFilter(page, 'Filter 3', { tag: BLANK_TAG });
	await clearOfScheduleMark(30);
	const saved = Date.now();
	await saveUpgrades(page);
	await page.reload();
	await waitForHydration(page);

	const { config } = await upgradesData(page, id);
	if (!config) throw new Error('The config should be stored');
	expect(
		pick(config as unknown as Record<string, unknown>, {
			enabled: true,
			cron: '',
			filterMode: '',
			currentFilterIndex: 0
		}),
		'The config should hold the status, schedule and mode'
	).toEqual({ enabled: true, cron: '*/30 * * * *', filterMode: 'random', currentFilterIndex: 0 });
	expect(config.filters, 'The filters should hold their settings').toEqual([
		{
			id: expect.any(String),
			name: 'Filter',
			enabled: true,
			group: defaultGroup('radarr'),
			selector: 'oldest',
			count: 3,
			cutoff: 80,
			tag: TAG
		},
		{
			id: expect.any(String),
			name: 'Filter 2',
			enabled: false,
			group: defaultGroup('radarr'),
			selector: 'random',
			count: 2,
			cutoff: 100
		},
		{
			id: expect.any(String),
			name: 'Filter 3',
			enabled: true,
			group: defaultGroup('radarr'),
			selector: 'random',
			count: 2,
			cutoff: 100
		}
	]);
	expect(config.lastRunAt, 'No run should have happened').toBeNull();
	const nextRun = new Date(config.nextRunAt ?? 0).getTime();
	expect(nextRun, 'The next run should be in the future').toBeGreaterThan(saved);
	expect(nextRun, 'The next run should be at most 30 minutes away').toBeLessThanOrEqual(
		saved + 30 * 60_000
	);
	const job = (await scheduledJobs(page)).find((j) => j.description === `arr.upgrade:${id}`);
	expect(job, `Settings › Jobs should list arr.upgrade:${id}`).toBeDefined();
	expect(new Date(job?.next_run_at ?? 0).getTime(), 'The job should run at the next run').toBe(
		nextRun
	);

	const main = page.getByRole('main');
	await expect(main.getByRole('switch', { name: 'Status' }), 'Status should be on').toHaveAttribute(
		'aria-checked',
		'true'
	);
	await expect(button(page, 'Frequency: Every'), 'Frequency should show Every').toBeVisible();
	await expect(
		main.getByRole('spinbutton', { name: 'Interval in Minutes' }),
		'The interval should show 30'
	).toHaveValue('30');
	await expect(
		button(page, 'Mode: Random Shuffle'),
		'Mode should show Random Shuffle'
	).toBeVisible();
	await expect(
		filterRow(page, 'Filter 2').getByText('Disabled', { exact: true }),
		'Filter 2 should show as disabled'
	).toBeVisible();
	const panel = await filterPanel(page, 'Filter');
	await expect(panel.getByRole('button', { name: 'Method: Oldest' }), 'Method').toBeVisible();
	await expect(panel.getByRole('spinbutton', { name: 'Count' }), 'Count').toHaveValue('3');
	await expect(panel.getByRole('spinbutton', { name: 'Cutoff %' }), 'Cutoff %').toHaveValue('80');
	await expect(
		panel.getByRole('textbox', { name: 'Cooldown Tag', exact: true }),
		'Cooldown Tag'
	).toHaveValue(TAG);
	await expect(button(page, 'Save'), 'Save should be off after the reload').toBeDisabled();
	expect(writes(fakeRadarr, from), 'The fake should get no writes').toEqual([]);
	expect(fakeRadarr.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. The user turns Status on with one Default filter and saves.
 * 2. The user turns Status off and saves.
 *
 * Expects:
 * - the config is off and its filters are unchanged
 * - Settings › Jobs no longer lists `arr.upgrade:{id}`
 * - the page shows "Enable upgrades to configure filters and view run
 *   history." and Dry Run and Reset Cache are disabled
 */
test('turning upgrades off removes the scheduled job and keeps the filters', async ({
	page,
	fakeRadarr
}) => {
	const id = await setUp(page, fakeRadarr);
	await setUpgradeCore(page, { enabled: true, schedule: { every: 30 } });
	await addDefaultFilter(page);
	await clearOfScheduleMark(30);
	await saveUpgrades(page);
	const before = (await upgradesData(page, id)).config?.filters;
	expect(
		(await scheduledJobs(page)).map((job) => job.description),
		'Saving on should schedule the job'
	).toContain(`arr.upgrade:${id}`);

	await setUpgradeCore(page, { enabled: false });
	await saveUpgrades(page);

	const { config } = await upgradesData(page, id);
	expect(config?.enabled, 'The config should be off').toBe(false);
	expect(config?.filters, 'The filters should be unchanged').toEqual(before);
	expect(
		(await scheduledJobs(page)).map((job) => job.description),
		'Settings › Jobs should no longer list the upgrade job'
	).not.toContain(`arr.upgrade:${id}`);
	await expect(
		page.getByRole('main').getByText(DISABLED_HINT, { exact: true }),
		'The page should say upgrades are off'
	).toBeVisible();
	await expect(button(page, 'Dry Run'), 'Dry Run should be disabled').toBeDisabled();
	await expect(button(page, 'Reset Cache'), 'Reset Cache should be disabled').toBeDisabled();
	expect(fakeRadarr.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. The user sets every 30 minutes, adds a filter with Count 5 and saves.
 * 2. The user changes the schedule to every 10 minutes and saves.
 *
 * Expects:
 * - after step 1 the Count hint reads "max 5 at this schedule"
 * - after step 2 the stored count is 1 and the cron is `*\/10 * * * *`
 */
test("a faster schedule lowers each filter's count to the new maximum", async ({
	page,
	fakeRadarr
}) => {
	const id = await setUp(page, fakeRadarr);
	await setUpgradeCore(page, { enabled: true, schedule: { every: 30 } });
	await addDefaultFilter(page);
	await editFilter(page, 'Filter', { count: 5 });
	await clearOfScheduleMark(30);
	await saveUpgrades(page);
	await expect(
		(await filterPanel(page, 'Filter')).getByText('Items per run (max 5 at this schedule)'),
		'The Count hint should give the maximum'
	).toBeVisible();
	expect((await upgradesData(page, id)).config?.filters[0].count, 'Count 5 should save').toBe(5);

	await setUpgradeCore(page, { schedule: { every: 10 } });
	await clearOfScheduleMark(10);
	await saveUpgrades(page);

	const { config } = await upgradesData(page, id);
	expect(config?.cron, 'The faster schedule should save').toBe('*/10 * * * *');
	expect(config?.filters[0].count, 'The count should drop to the new maximum').toBe(1);
	expect(fakeRadarr.unhandled).toEqual([]);
});

for (const { targetId, cron, minimum } of [
	{ targetId: 'radarr-6', cron: '*/5 * * * *', minimum: 10 },
	{ targetId: 'sonarr-4', cron: '*/30 * * * *', minimum: 60 }
]) {
	/**
	 * Flow:
	 * 1. The user turns Status on and sets a Custom schedule faster than the
	 *    app allows: every 5 minutes on Radarr, every 30 on Sonarr.
	 * 2. The user saves.
	 *
	 * Expects:
	 * - the save fails with 400 and "Schedule too frequent. Minimum interval
	 *   is 10 minutes." (60 on Sonarr), shown as an error alert
	 * - no config is stored and no job is scheduled
	 */
	test(`the server refuses a schedule faster than the app's minimum (${targetId})`, async ({
		page,
		startArr
	}) => {
		const fake = await startArr(targetId);
		const id = await setUp(page, fake);
		await setUpgradeCore(page, { enabled: true, schedule: { custom: cron } });
		const message = `Schedule too frequent. Minimum interval is ${minimum} minutes.`;

		const saved = waitForAction(page, 'save');
		await button(page, 'Save').click();
		const result = await saved;
		expect(result.type, 'The save should fail').toBe('failure');
		expect(result.status, 'The save should answer 400').toBe(400);
		expect(result.data, `The save should say "${message}"`).toEqual({ error: message });
		await expect(alert(page, message), 'The error should show').toBeVisible();

		expect((await upgradesData(page, id)).config, 'No config should be stored').toBeNull();
		expect(
			(await scheduledJobs(page)).map((job) => job.description),
			'No upgrade job should be scheduled'
		).not.toContain(`arr.upgrade:${id}`);
		expect(fake.unhandled).toEqual([]);
	});
}

for (const target of TARGETS) {
	/**
	 * Flow:
	 * 1. The user turns Status on and picks Add filter › Import.
	 * 2. The user pastes a filter named "Imported": the app's default rules
	 *    plus `year gte 2000`, method A-Z, count 1, cutoff 60 and tag
	 *    "shared-tag", carrying the id of the filter it was copied from.
	 * 3. The user imports and saves.
	 *
	 * Expects:
	 * - the alert reads `Imported "Imported"`
	 * - the stored filter holds those exact values under a new id
	 */
	test(`an imported filter keeps its rules, method, count and tag (${target.id})`, async ({
		page,
		startArr
	}) => {
		const fake = await startArr(target.id);
		const id = await setUp(page, fake);
		const group: FilterGroup = {
			...defaultGroup(target.app),
			children: [...defaultGroup(target.app).children, rule('year', 'gte', 2000)]
		};
		const copied = {
			id: 'copied-filter-id',
			name: 'Imported',
			enabled: true,
			group,
			selector: 'alphabetical_asc',
			count: 1,
			cutoff: 60,
			tag: 'shared-tag'
		};

		await setUpgradeCore(page, { enabled: true });
		await importFilter(page, copied);
		await expect(
			alert(page, 'Imported "Imported"'),
			'The import should be confirmed'
		).toBeVisible();
		await saveUpgrades(page);

		const filters = (await upgradesData(page, id)).config?.filters ?? [];
		expect(filters, 'The imported filter should keep every value').toEqual([
			{ ...copied, id: expect.any(String) }
		]);
		expect(filters[0].id, 'The imported filter should get a new id').not.toBe(copied.id);
		expect(fake.unhandled).toEqual([]);
	});
}

/**
 * Flow:
 * 1. On Radarr, the user turns Status on and saves.
 * 2. The user imports a filter whose group holds a `network` rule.
 *
 * Expects:
 * - the alert reads `Cannot import filter: "network" is not available for
 *   Radarr.`
 * - the filter list stays empty and Save stays disabled
 */
test('a filter with a field the app lacks is refused on import', async ({ page, fakeRadarr }) => {
	const id = await setUp(page, fakeRadarr);
	await setUpgradeCore(page, { enabled: true });
	await saveUpgrades(page);
	const message = 'Cannot import filter: "network" is not available for Radarr.';

	await importFilter(page, {
		name: 'Networks',
		group: { type: 'group', match: 'all', children: [rule('network', 'eq', 'HBO')] }
	});

	await expect(alert(page, message), 'The import should be refused').toBeVisible();
	await expect(
		page.getByRole('main').getByText('No filters configured. Add a filter to start.'),
		'The filter list should stay empty'
	).toBeVisible();
	await expect(button(page, 'Save'), 'Save should stay disabled').toBeDisabled();
	expect((await upgradesData(page, id)).config?.filters, 'No filter should be stored').toEqual([]);
	expect(fakeRadarr.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. The user turns Status on, adds a filter, disables it and saves.
 * 2. The user enables the filter without saving.
 * 3. The user saves.
 *
 * Expects:
 * - after step 1, Dry Run is disabled and says "Add and enable at least
 *   one filter before running"
 * - after step 2, Dry Run is still disabled while the change is unsaved
 * - after step 3, Dry Run is enabled
 */
test('Dry Run stays off until a saved filter is enabled', async ({ page, fakeRadarr }) => {
	await setUp(page, fakeRadarr);
	await setUpgradeCore(page, { enabled: true });
	await addDefaultFilter(page);
	await editFilter(page, 'Filter', { enabled: false });
	await saveUpgrades(page);
	const dry = button(page, 'Dry Run');
	await expect(dry, 'Dry Run should be disabled without an enabled filter').toBeDisabled();
	await expect(dry, `Dry Run should say "${NO_FILTER_ENABLED}"`).toHaveAccessibleDescription(
		NO_FILTER_ENABLED
	);

	await editFilter(page, 'Filter', { enabled: true });
	await expect(dry, 'Dry Run should stay disabled while unsaved').toBeDisabled();

	await saveUpgrades(page);
	await expect(dry, 'Dry Run should be enabled once saved').toBeEnabled();
	expect(fakeRadarr.unhandled).toEqual([]);
});

/** P1's library: A, C and D match the default rules, B is unmonitored, C carries the tag */
function previewLibrary(fake: FakeArr): Library {
	const item = fake.type === 'radarr' ? radarrMovie : sonarrSeriesOf;
	return {
		items: [
			item({ id: 1, title: 'Arrival Point', added: '2021-01-01T00:00:00Z' }),
			item({ id: 2, title: 'Blue Harbor', added: '2020-01-01T00:00:00Z', monitored: false }),
			item({ id: 3, title: 'Cold Front', added: '2023-01-01T00:00:00Z', tags: [FILTER_TAG] }),
			item({ id: 4, title: 'Dust Road', added: '2022-01-01T00:00:00Z' })
		]
	};
}

/** A series with one monitored season of files, built like a movie */
function sonarrSeriesOf(options: {
	id: number;
	title: string;
	added: string;
	monitored?: boolean;
	tags?: string[];
}): LibraryEntry {
	return sonarrSeries({ ...options, seasons: [{ seasonNumber: 1, episodeFileCount: 2 }] });
}

for (const targetId of ['radarr-6', 'sonarr-4']) {
	/**
	 * Flow:
	 * 1. The library holds A, C and D, which match the default rules and were
	 *    added in the order A, D, C. B is unmonitored. C carries the tag of a
	 *    filter named "Filter".
	 * 2. The user turns Status on and adds a Default filter with Method Oldest
	 *    and Count 1, without saving.
	 * 3. The user clicks Preview.
	 *
	 * Expects:
	 * - 4 items, 3 matched, 1 in cooldown, 2 selectable, 1 selected of 1
	 * - A is selected, D eligible later, C in cooldown, and B filtered out
	 *   because "Monitored is False, not True"
	 * - the "Preview: Filter" dialog shows Library, Filter, Selection and
	 *   Cooldown
	 * - the fake got only GETs, no config is stored, and no run or job exists
	 */
	test(`preview sorts the library by what the next run would do, and changes nothing (${targetId})`, async ({
		page,
		startArr
	}) => {
		const fake = await startArr(targetId);
		const id = await setUp(page, fake, previewLibrary(fake));
		const from = fake.requests.length;
		await setUpgradeCore(page, { enabled: true });
		await addDefaultFilter(page);
		await editFilter(page, 'Filter', { method: 'Oldest', count: 1 });

		const preview = await previewFilter(page, 'Filter');

		expect(
			pick(preview as unknown as Record<string, unknown>, {
				totalItems: 0,
				matchedCount: 0,
				cooldownCount: 0,
				selectableCount: 0,
				selectedCount: 0,
				requestedCount: 0
			}),
			'The preview should count each step'
		).toEqual({
			totalItems: 4,
			matchedCount: 3,
			cooldownCount: 1,
			selectableCount: 2,
			selectedCount: 1,
			requestedCount: 1
		});
		expect(
			preview.items.map((item) => [item.id, item.status]),
			'Each item should get its status, in order'
		).toEqual([
			[1, 'selected'],
			[4, 'selectable'],
			[3, 'cooldown'],
			[2, 'filtered_out']
		]);
		expect(preview.items[3].reason, 'B should say why it does not match').toBe(
			'Monitored is False, not True'
		);
		const dialog = previewDialog(page, 'Filter');
		for (const section of ['Library', 'Filter', 'Selection', 'Cooldown']) {
			await expect(
				dialog.getByText(section, { exact: true }),
				`The dialog should show ${section}`
			).toBeVisible();
		}

		expect(writes(fake, from), 'The fake should get only GETs').toEqual([]);
		const data = await upgradesData(page, id);
		expect(data.config, 'No config should be stored').toBeNull();
		expect(data.upgradeRuns, 'No run should be recorded').toEqual([]);
		expect(await latestJobRunId(page, 'arr.upgrade'), 'No upgrade job should run').toBe(0);
		expect(fake.unhandled).toEqual([]);
	});
}

/** P2's library: A's file scores below half the cutoff, B's above, C has none */
function cutoffLibrary(fake: FakeArr): Library {
	if (fake.type === 'radarr') {
		return {
			items: [
				radarrMovie({ id: 1, title: 'Low Score' }),
				radarrMovie({ id: 2, title: 'High Score' }),
				radarrMovie({ id: 3, title: 'No File' })
			],
			files: [movieFile(1, 40), movieFile(2, 60)]
		};
	}
	const series = (id: number, title: string, files: number) =>
		sonarrSeries({ id, title, seasons: [{ seasonNumber: 1, episodeFileCount: files }] });
	return {
		items: [series(1, 'Mixed Scores', 2), series(2, 'Low Scores', 2), series(3, 'No Files', 0)],
		files: [
			episodeFile(1, 1, 40),
			episodeFile(1, 1, 80),
			episodeFile(2, 1, 20),
			episodeFile(2, 1, 30)
		]
	};
}

for (const targetId of ['radarr-6', 'sonarr-4']) {
	/**
	 * Flow:
	 * 1. The Arr's profile has a cutoff score of 100. Radarr: A's file scores
	 *    40, B's 60, C has no file. Sonarr: A's files score 40 and 80, B's 20
	 *    and 30, C has none.
	 * 2. The user turns Status on, adds a filter whose only rule is "Cutoff
	 *    Met is False", sets Cutoff % 50 and clicks Preview.
	 *
	 * Expects:
	 * - Radarr matches A and C, Sonarr B and C; the other one is filtered out
	 *   because "Cutoff Met is True, not False"
	 * - Radarr: the preview sends one GET moviefile with both file-holding
	 *   movie ids
	 * - Sonarr: the preview sends GET episodefile for A and B, never for C
	 */
	test(`"cutoff met" reads each Arr's scores (${targetId})`, async ({ page, startArr }) => {
		const fake = await startArr(targetId);
		fake.edit('qualityprofile', (profile) => profile.id === 1, { cutoffFormatScore: 100 });
		await setUp(page, fake, cutoffLibrary(fake));
		await setUpgradeCore(page, { enabled: true });
		await addDefaultFilter(page);
		await buildRules(page, 'Filter', {
			match: 'all',
			children: [{ field: 'Cutoff Met', operator: 'is', value: { pick: 'False' } }]
		});
		await editFilter(page, 'Filter', { cutoff: 50 });

		const from = fake.requests.length;
		const preview = await previewFilter(page, 'Filter');
		const sent = fake.requests.slice(from);

		const [matched, cutoffMet] = fake.type === 'radarr' ? [[1, 3], 2] : [[2, 3], 1];
		expect(matchedIds(preview), 'Only titles below the cutoff should match').toEqual(matched);
		expect(
			preview.items
				.filter((item) => item.status === 'filtered_out')
				.map((item) => [item.id, item.reason]),
			'The title over the cutoff should say why'
		).toEqual([[cutoffMet, 'Cutoff Met is True, not False']]);

		if (fake.type === 'radarr') {
			const files = sent.filter((r) => r.method === 'GET' && r.path === '/api/v3/moviefile');
			expect(
				files.map((r) => r.query.getAll('movieId')),
				'One GET moviefile should carry both file-holding movies'
			).toEqual([['1', '2']]);
		} else {
			const files = sent.filter((r) => r.method === 'GET' && r.path === '/api/v3/episodefile');
			expect(
				files.map((r) => r.query.get('seriesId')).sort(),
				'GET episodefile should go to the series with files only'
			).toEqual(['1', '2']);
		}
		expect(fake.unhandled).toEqual([]);
	});
}

/** F1's cooldown tag, and the filter's new name */
const F1_TAG = 'flow-picks';
const F1_NAME = 'Action Picks';

/**
 * F1's library. Matching: 1 by genre, 2 by tag, 3 by studio, 9 by genre with
 * no file. The rest each fail one rule: 4 the year, 5 monitoring, 6 the
 * group, 7 its Bad format, 8 the title, 10 the group.
 */
const F1_LIBRARY: Library = {
	items: [
		radarrMovie({
			id: 1,
			title: 'Alpha Strike',
			year: 2015,
			genres: ['Action'],
			added: '2021-03-01T00:00:00Z',
			rating: 7,
			sizeGb: 8
		}),
		radarrMovie({
			id: 2,
			title: 'Bravo Hold',
			year: 2012,
			genres: ['Drama'],
			tags: ['keep'],
			added: '2020-02-01T00:00:00Z',
			qualityProfileId: 4
		}),
		radarrMovie({
			id: 3,
			title: 'Charlie Lot',
			year: 2018,
			genres: ['Comedy'],
			studio: 'Keep Studios',
			added: '2021-06-01T00:00:00Z'
		}),
		radarrMovie({
			id: 4,
			title: 'Delta Old',
			year: 2005,
			genres: ['Action'],
			added: '2019-01-01T00:00:00Z'
		}),
		radarrMovie({
			id: 5,
			title: 'Echo Unwatched',
			year: 2019,
			genres: ['Action'],
			monitored: false,
			added: '2019-02-01T00:00:00Z'
		}),
		radarrMovie({
			id: 6,
			title: 'Foxtrot Plain',
			year: 2016,
			genres: ['Drama'],
			studio: 'Other Pictures',
			added: '2019-03-01T00:00:00Z',
			rating: 9
		}),
		radarrMovie({
			id: 7,
			title: 'Golf Bad',
			year: 2017,
			genres: ['Action'],
			added: '2019-04-01T00:00:00Z'
		}),
		radarrMovie({
			id: 8,
			title: 'Hotel Sample Cut',
			year: 2020,
			genres: ['Action'],
			added: '2019-05-01T00:00:00Z'
		}),
		radarrMovie({
			id: 9,
			title: 'India Soon',
			year: 2021,
			genres: ['Action'],
			status: 'announced',
			added: '2018-01-01T00:00:00Z'
		}),
		radarrMovie({
			id: 10,
			title: 'Juliet Other',
			year: 2014,
			genres: ['Drama'],
			tags: ['other'],
			added: '2019-06-01T00:00:00Z',
			sizeGb: 2
		})
	],
	files: [
		movieFile(1, 20, ['Good']),
		movieFile(2, 10),
		movieFile(3, 30),
		movieFile(4, 10),
		movieFile(6, 15),
		movieFile(7, 25, ['Bad']),
		movieFile(8, 5),
		movieFile(10, 40, ['Good'])
	]
};

/** F1's rules: two groups, each with a typed Value at the same place */
const F1_RULES: GroupInput = {
	match: 'all',
	children: [
		{ field: 'Title', operator: 'does not contain', value: { text: 'Sample' } },
		{ field: 'Monitored', operator: 'is', value: { pick: 'True' } },
		{ field: 'Year', operator: '≥', value: { number: 2010 } },
		{
			match: 'any',
			children: [
				{ field: 'Studio', operator: 'contains', value: { text: 'Keep' } },
				{ field: 'Genres', operator: 'includes', value: { pick: 'Action' } },
				{ field: 'Tags', operator: 'includes', value: { pick: 'keep' } }
			]
		},
		{ field: 'Custom Format', operator: 'does not include', value: { pick: 'Bad' } }
	]
};

/** F1's rules as the app stores them */
const F1_GROUP: FilterGroup = {
	type: 'group',
	match: 'all',
	children: [
		rule('title', 'not_contains', 'Sample'),
		rule('monitored', 'is', true),
		rule('year', 'gte', 2010),
		{
			type: 'group',
			match: 'any',
			children: [
				rule('studio', 'contains', 'Keep'),
				rule('genres', 'includes', 'Action'),
				rule('tags', 'includes', 'keep')
			]
		},
		rule('custom_format', 'does_not_include', 'Bad')
	]
};

/**
 * Flow:
 * 1. The library holds 10 movies that differ in monitoring, year, genres,
 *    tags, studio, quality profile, rating, size, date added, status and the
 *    custom formats on their file.
 * 2. The user turns Status on, adds a Default filter and builds: title does
 *    not contain "Sample", monitored is True, year ≥ 2010, (studio contains
 *    "Keep" OR genres include Action OR tags include keep), custom format
 *    does not include Bad. Each group has a typed Value first, filled by its
 *    label.
 * 3. The user renames the filter with the pencil, sets Method Oldest, Count
 *    2 and the Cooldown Tag by its name, and adds a stray rule and a stray
 *    group, then removes them with their X buttons.
 * 4. The user saves, previews, then starts a live run.
 *
 * Expects:
 * - the stored filter holds exactly the built rules
 * - the preview matches exactly movies 1, 2, 3 and 9
 * - the live run's one POST command is `{ name: 'MoviesSearch', movieIds }`
 *   with the two oldest matches, 9 then 2
 * - one POST tag with the cooldown tag; tag PUTs go to 9 and 2 only, and the
 *   fake holds the tag on them and on nothing else
 */
test('a Radarr filter built in the form picks exactly the movies its rules match', async ({
	page,
	fakeRadarr: fake
}) => {
	const id = await setUp(page, fake, F1_LIBRARY);
	await setUpgradeCore(page, { enabled: true });
	await addDefaultFilter(page);
	await buildRules(page, 'Filter', F1_RULES);
	await editFilter(page, 'Filter', { rename: F1_NAME, method: 'Oldest', count: 2, tag: F1_TAG });
	const panel = await filterPanel(page, F1_NAME);
	const fields = panel.getByRole('button', { name: /^Field: / });
	await panel.getByRole('button', { name: 'Add Rule', exact: true }).last().click();
	await panel.getByRole('button', { name: 'Add Group', exact: true }).last().click();
	await expect(fields, 'The stray rule and group should be added').toHaveCount(9);
	await panel.getByRole('button', { name: 'Remove group', exact: true }).last().click();
	await panel.getByRole('button', { name: 'Remove rule', exact: true }).last().click();
	await expect(fields, 'The stray rule and group should be removed').toHaveCount(7);
	await saveUpgrades(page);

	const filter = (await upgradesData(page, id)).config?.filters[0];
	expect(filter, 'The filter should hold the built rules and settings').toEqual({
		id: expect.any(String),
		name: F1_NAME,
		enabled: true,
		group: F1_GROUP,
		selector: 'oldest',
		count: 2,
		cutoff: 100,
		tag: F1_TAG
	});

	const preview = await previewFilter(page, F1_NAME);
	expect(
		matchedIds(preview),
		'The preview should match exactly the movies the rules allow'
	).toEqual([1, 2, 3, 9]);

	const before = fake.requests.length;
	const run = await liveRun(page, id);
	expect(run.status, `The live run should succeed: ${run.error}`).toBe('success');
	expect(fake.commands(), 'One search should go out for the two oldest matches').toEqual([
		{ name: 'MoviesSearch', movieIds: [9, 2] }
	]);
	const sent = fake.requests.slice(before);
	expect(
		sent.filter((r) => r.method === 'POST' && r.path === '/api/v3/tag').map((r) => r.body),
		'One tag should be created with the cooldown tag'
	).toEqual([{ label: F1_TAG }]);
	expect(
		sent.filter((r) => r.method === 'PUT').map((r) => r.path),
		'Tag PUTs should go to the searched movies only'
	).toEqual(['/api/v3/movie/9', '/api/v3/movie/2']);
	expect(taggedIds(fake, F1_TAG), 'Only the searched movies should carry the tag').toEqual([2, 9]);
	expect(fake.unhandled).toEqual([]);
});

/** F2's library: 1 and 2 match; each other series fails one rule */
const F2_LIBRARY: Library = {
	items: [
		sonarrSeries({
			id: 1,
			title: 'Atlas',
			network: 'HBO',
			firstAired: '2015-03-01T00:00:00Z',
			added: '2021-01-01T00:00:00Z',
			seasons: [{ seasonNumber: 1, episodeFileCount: 5 }]
		}),
		sonarrSeries({
			id: 2,
			title: 'Beacon',
			network: 'HBO',
			firstAired: '2018-01-01T00:00:00Z',
			added: '2020-01-01T00:00:00Z',
			seasons: [
				{ seasonNumber: 1, episodeFileCount: 1 },
				{ seasonNumber: 2, episodeFileCount: 2 }
			]
		}),
		sonarrSeries({
			id: 3,
			title: 'Cinder',
			network: 'HBO',
			seriesType: 'anime',
			firstAired: '2016-01-01T00:00:00Z',
			added: '2019-01-01T00:00:00Z',
			seasons: [{ seasonNumber: 1, episodeFileCount: 4 }]
		}),
		sonarrSeries({
			id: 4,
			title: 'Dune Road',
			network: 'AMC',
			firstAired: '2014-01-01T00:00:00Z',
			added: '2019-02-01T00:00:00Z',
			seasons: [{ seasonNumber: 1, episodeFileCount: 2 }]
		}),
		sonarrSeries({
			id: 5,
			title: 'Ember',
			network: 'HBO',
			firstAired: '2017-01-01T00:00:00Z',
			added: '2019-03-01T00:00:00Z',
			seasons: [{ seasonNumber: 1, episodeFileCount: 0 }]
		}),
		sonarrSeries({
			id: 6,
			title: 'Fable',
			network: 'HBO',
			firstAired: '2022-01-01T00:00:00Z',
			added: '2019-04-01T00:00:00Z',
			seasons: [{ seasonNumber: 1, episodeFileCount: 6 }]
		}),
		sonarrSeries({
			id: 7,
			title: 'Grove',
			network: 'HBO',
			seriesType: 'daily',
			firstAired: '2012-01-01T00:00:00Z',
			added: '2019-05-01T00:00:00Z',
			seasons: [{ seasonNumber: 1, episodeFileCount: 1 }]
		}),
		sonarrSeries({
			id: 8,
			title: 'Harbor',
			network: 'Netflix',
			firstAired: '2019-01-01T00:00:00Z',
			added: '2019-06-01T00:00:00Z',
			seasons: [{ seasonNumber: 1, episodeFileCount: 2 }]
		})
	],
	files: [episodeFile(2, 1, 10), episodeFile(2, 2, 20), episodeFile(2, 2, 30)]
};

/** F2's rules; Network is one of the Arr's networks, so it offers is and is not */
const F2_RULES: GroupInput = {
	match: 'all',
	children: [
		{ field: 'Network', operator: 'is', value: { pick: 'HBO' } },
		{ field: 'Series Type', operator: 'is', value: { pick: 'Standard' } },
		{ field: 'Episode File Count', operator: '>', value: { number: 0 } },
		{ field: 'First Aired', operator: 'is before', value: { date: '2020-06-15' } }
	]
};

/**
 * Flow:
 * 1. The library holds 8 series that differ in network, series type,
 *    episode files and first air date.
 * 2. The user builds: network is HBO, series type is Standard, episode file
 *    count > 0, first aired before 2020-06-15. Method Oldest, Count 1.
 * 3. The user saves, previews, starts a dry run, then a live run.
 *
 * Expects:
 * - the stored rules are exactly the built ones, and the preview matches
 *   series 1 and 2
 * - the dry run looks up releases for series 2, its newest season with
 *   files, 2
 * - the live run sends one SeriesSearch, for series 2, and no other command
 * - one PUT series/editor tags exactly series 2 with `applyTags: 'add'`
 */
test('a Sonarr filter built in the form picks exactly the series its rules match', async ({
	page,
	fakeSonarr: fake
}) => {
	const id = await setUp(page, fake, F2_LIBRARY);
	await setUpgradeCore(page, { enabled: true });
	await addDefaultFilter(page);
	await buildRules(page, 'Filter', F2_RULES);
	await editFilter(page, 'Filter', { method: 'Oldest', count: 1 });
	await saveUpgrades(page);

	expect((await upgradesData(page, id)).config?.filters[0].group, 'The rules should save').toEqual({
		type: 'group',
		match: 'all',
		children: [
			rule('network', 'eq', 'HBO'),
			rule('series_type', 'eq', 'standard'),
			rule('episode_file_count', 'gt', 0),
			rule('first_aired', 'before', '2020-06-15')
		]
	});
	const preview = await previewFilter(page, 'Filter');
	expect(matchedIds(preview), 'The preview should match exactly series 1 and 2').toEqual([1, 2]);

	await closePreview(page, 'Filter');
	await dryRun(page);
	expect(
		fake.requests
			.filter((r) => r.method === 'GET' && r.path === '/api/v3/release')
			.map((r) => [r.query.get('seriesId'), r.query.get('seasonNumber')]),
		'The dry run should look up the newest season with files'
	).toEqual([['2', '2']]);

	const before = fake.requests.length;
	const run = await liveRun(page, id);
	expect(run.status, `The live run should succeed: ${run.error}`).toBe('success');
	expect(fake.commands(), 'One search should go out, for series 2').toEqual([
		{ name: 'SeriesSearch', seriesId: 2 }
	]);
	const tagId = fake.collection('tag').find((tag) => tag.label === FILTER_TAG)?.id;
	expect(
		fake.requests
			.slice(before)
			.filter((r) => r.method === 'PUT')
			.map((r) => [r.path, r.body]),
		'One editor PUT should tag series 2'
	).toEqual([['/api/v3/series/editor', { seriesIds: [2], tags: [tagId], applyTags: 'add' }]]);
	expect(taggedIds(fake, FILTER_TAG), 'Only series 2 should carry the tag').toEqual([2]);
	expect(fake.unhandled).toEqual([]);
});

/**
 * F3's pool: every movie matches, and each selector orders them differently.
 * Movie 4 has no size, which Size (Smallest First) puts last.
 */
const F3_LIBRARY: Library = {
	items: [
		radarrMovie({
			id: 1,
			title: 'The Zebra',
			added: '2020-03-01T00:00:00Z',
			sizeGb: 3,
			popularity: 20
		}),
		radarrMovie({
			id: 2,
			title: 'Apple',
			added: '2022-01-01T00:00:00Z',
			sizeGb: 8,
			popularity: 15
		}),
		radarrMovie({
			id: 3,
			title: 'Mango',
			added: '2019-06-01T00:00:00Z',
			sizeGb: 5,
			popularity: 90
		}),
		radarrMovie({
			id: 4,
			title: 'Banana',
			added: '2021-05-01T00:00:00Z',
			sizeGb: 0,
			popularity: 60
		}),
		radarrMovie({ id: 5, title: 'Yak', added: '2023-02-01T00:00:00Z', sizeGb: 2, popularity: 40 })
	],
	files: [movieFile(1, 50), movieFile(2, 30), movieFile(3, 70), movieFile(4, 20), movieFile(5, 10)]
};

/** The two ids each selector picks from F3's pool, in order */
const F3_PICKS: [selector: string, ids: number[]][] = [
	['oldest', [3, 1]],
	['newest', [5, 2]],
	['lowest_score', [5, 4]],
	['size_asc', [5, 1]],
	['size_desc', [2, 3]],
	['most_popular', [3, 4]],
	['least_popular', [2, 1]],
	['alphabetical_asc', [2, 4]],
	['alphabetical_desc', [1, 5]]
];

/**
 * Flow:
 * 1. The library holds 5 movies that all match, with different dates, scores,
 *    sizes, popularity and titles.
 * 2. Each selector previews the pool with Count 2 through the preview
 *    endpoint.
 * 3. The user saves a filter with Method "Size (Largest First)" and Count 2
 *    and starts a live run.
 *
 * Expects:
 * - each selector picks exactly its expected pair, in order
 * - the live run's `movieIds` follow the same order
 */
test('each selector picks the right titles in the right order', async ({ page, fakeRadarr }) => {
	const id = await setUp(page, fakeRadarr, F3_LIBRARY);
	for (const [selector, ids] of F3_PICKS) {
		const preview = await postPreview(page, id, {
			group: defaultGroup('radarr'),
			selector,
			count: 2
		});
		expect(previewIds(preview, 'selected'), `${selector} should pick ${ids}`).toEqual(ids);
	}

	await setUpgradeCore(page, { enabled: true });
	await addDefaultFilter(page);
	await editFilter(page, 'Filter', { method: 'Size (Largest First)', count: 2 });
	await saveUpgrades(page);
	const run = await liveRun(page, id);
	expect(run.status, `The live run should succeed: ${run.error}`).toBe('success');
	expect(fakeRadarr.commands(), 'The search should follow the selector order').toEqual([
		{ name: 'MoviesSearch', movieIds: [2, 3] }
	]);
	expect(fakeRadarr.unhandled).toEqual([]);
});

const DAY = 24 * 60 * 60_000;
/** A date some days before the test runs, as an ISO timestamp */
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();

/** F4's library: four movies that differ in every field a rule kind reads */
const F4_LIBRARY: Library = {
	items: [
		radarrMovie({
			id: 1,
			title: 'Night Patrol',
			year: 2012,
			rating: 7.5,
			added: daysAgo(400),
			genres: ['Action', 'Thriller'],
			tags: ['keep']
		}),
		radarrMovie({
			id: 2,
			title: 'Morning Light',
			year: 2019,
			rating: 5,
			added: daysAgo(10),
			genres: ['Drama'],
			monitored: false,
			status: 'announced'
		}),
		radarrMovie({
			id: 3,
			title: 'Night Shift',
			year: 2008,
			rating: 8.2,
			added: daysAgo(3),
			tags: ['keep', 'other'],
			status: 'inCinemas'
		}),
		radarrMovie({
			id: 4,
			title: 'Evening Tide',
			year: 2021,
			rating: 6,
			added: daysAgo(100),
			genres: ['Action'],
			tags: ['other']
		})
	],
	files: [movieFile(1, 10, ['HDR']), movieFile(2, 10, ['HDR', 'Bad']), movieFile(4, 10)]
};

/** One case per kind of rule, with the movies it should match */
const F4_CASES: [kind: string, rule: FilterRule, ids: number[]][] = [
	['boolean', rule('monitored', 'is', false), [2]],
	['select', rule('status', 'eq', 'released'), [1, 4]],
	['text contains', rule('title', 'contains', 'night'), [1, 3]],
	['text starts with', rule('title', 'starts_with', 'Night S'), [3]],
	['number ≥', rule('year', 'gte', 2012), [1, 2, 4]],
	['number <', rule('rating', 'lt', 6), [2]],
	['date before', rule('date_added', 'before', daysAgo(50).slice(0, 10)), [1, 4]],
	['date in the last', rule('date_added', 'in_last', 30), [2, 3]],
	['multi-value includes', rule('genres', 'includes', 'Action'), [1, 4]],
	['multi-value is only', rule('tags', 'is_only', 'keep'), [1]],
	['multi-value has none', rule('genres', 'has_none', null), [3]],
	['custom format', rule('custom_format', 'includes', 'HDR'), [1, 2]]
];

/**
 * Flow:
 * 1. The library holds 4 movies that differ in every field a rule reads.
 * 2. Each kind of rule previews the library through the preview endpoint:
 *    boolean, select, text, number, date, multi-value and custom format.
 *
 * Expects:
 * - each case matches exactly its expected movies
 */
test('each kind of rule matches what it says', async ({ page, fakeRadarr }) => {
	const id = await setUp(page, fakeRadarr, F4_LIBRARY);
	for (const [kind, check, ids] of F4_CASES) {
		const preview = await postPreview(page, id, {
			group: { type: 'group', match: 'all', children: [check] },
			selector: 'oldest',
			count: 1
		});
		expect(matchedIds(preview), `The ${kind} rule should match ${ids}`).toEqual(ids);
	}
	expect(fakeRadarr.unhandled).toEqual([]);
});
