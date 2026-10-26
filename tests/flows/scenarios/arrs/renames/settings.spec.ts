/**
 * - Protects: an Arr's rename settings, from the Renames tab through what
 *   the app database stores: Folders, Summary, the schedule and its job, and
 *   the ignore tag.
 * - A new config can be saved as it is. Manual runs wait until the config is
 *   saved and has no unsaved changes.
 * - The server refuses a schedule more often than every 10 minutes.
 * - Settings and run history survive a restart.
 * - Radarr only: these settings are the same for every Arr.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '$flows/helpers/core/test.ts';
import { waitForAction } from '$flows/helpers/core/forms.ts';
import { scheduledJobs } from '$flows/helpers/core/jobs.ts';
import { openTab } from '$flows/helpers/core/nav.ts';
import { pageData, pick } from '$flows/helpers/core/pageData.ts';
import { addArr, arrInstance } from '$flows/helpers/sync/arrs.ts';
import type { FakeArr } from '$flows/helpers/sync/fakeArr.ts';
import { seedLibrary } from '$flows/helpers/sync/library.ts';
import {
	dryRun,
	openRenames,
	renameLibrary,
	renameNowDialog,
	renamesData,
	runNow,
	saveRenames,
	setRenameSettings,
	titleA,
	titleB,
	type RenameChanges
} from '$flows/helpers/sync/renames.ts';
import { clearOfScheduleMark } from '$flows/helpers/sync/upgrades.ts';

const SAVE_FIRST = 'Save the config first';
const UNSAVED = 'Save or discard your changes first';
const TOO_FREQUENT = 'Schedule too frequent. Minimum interval is 10 minutes.';
const IGNORE_TAG = 'no-rename';
/** What a saved config holds when the user changes nothing */
const DEFAULTS = {
	enabled: false,
	renameFolders: false,
	ignoreTag: null,
	cron: '0 0 * * *',
	summaryNotifications: true
};

/** The instance name each test gives its fake */
const nameOf = (fake: FakeArr) => `Flow ${fake.target.label}`;

/** The Renames tab's buttons */
const button = (page: Page, name: string) =>
	page.getByRole('main').getByRole('button', { name, exact: true });

/** The stored settings' fields a user sets, plus the last run */
const userFields = (settings: object) =>
	pick(settings as Record<string, unknown>, { ...DEFAULTS, lastRunAt: null });

/** The scheduled rename job of an instance, if Settings › Jobs lists one */
async function renameJob(page: Page, id: number) {
	return (await scheduledJobs(page)).find((job) => job.description === `arr.rename:${id}`);
}

/** Whether the Arr list shows renames on for an instance */
async function listShowsRenames(page: Page, id: number): Promise<boolean | undefined> {
	const { instances } = await pageData<{ instances: { id: number; renameEnabled: boolean }[] }>(
		page,
		'/arr'
	);
	return instances.find((instance) => instance.id === id)?.renameEnabled;
}

/** Check Dry Run and Run Now are blocked, with `reason` as their description */
async function expectRunsBlocked(page: Page, reason: string): Promise<void> {
	for (const name of ['Dry Run', 'Run Now']) {
		await expect(button(page, name), `${name} should be blocked`).toBeDisabled();
		await expect(button(page, name), `${name} should say "${reason}"`).toHaveAccessibleDescription(
			reason
		);
	}
}

/** Add the fake and open its Renames tab. Returns the instance id. */
async function setUp(page: Page, fake: FakeArr): Promise<number> {
	await addArr(page, { name: nameOf(fake), fake });
	const { id } = await arrInstance(page, nameOf(fake));
	await openRenames(page, nameOf(fake));
	return id;
}

/** S1's settings: Folders and Schedule on, every 30 minutes, the ignore tag, Summary off */
const SCHEDULED: RenameChanges = {
	folders: true,
	schedule: true,
	frequency: { every: 30 },
	ignoreTag: IGNORE_TAG,
	summary: false
};

/**
 * Flow:
 * 1. The user adds the fake and opens Renames.
 * 2. The user turns on Folders and Schedule, picks every 30 minutes, types
 *    "no-rename" as the ignore tag, turns Summary off and saves.
 *
 * Expects:
 * - before saving, no settings are stored, Save is enabled, and Dry Run and
 *   Run Now are blocked with "Save the config first"
 * - the stored settings hold the choices, with no last run
 * - the next run is in the future, at most 30 minutes away, and Settings ›
 *   Jobs lists `arr.rename:{id}` at that time
 * - the Arr list shows renames on
 * - after saving, Save is disabled and Dry Run is unblocked
 */
test('saves a new config and schedules it', async ({ page, fakeRadarr: fake }) => {
	const id = await setUp(page, fake);
	expect((await renamesData(page, id)).settings, 'No settings should be stored yet').toBeNull();
	await expect(button(page, 'Save'), 'Save should be enabled on a new config').toBeEnabled();
	await expectRunsBlocked(page, SAVE_FIRST);

	await setRenameSettings(page, SCHEDULED);
	await clearOfScheduleMark(30);
	const saved = Date.now();
	await saveRenames(page);

	const { settings } = await renamesData(page, id);
	if (!settings) throw new Error('The settings should be stored');
	expect(userFields(settings), 'The stored settings should hold the choices').toEqual({
		enabled: true,
		renameFolders: true,
		ignoreTag: IGNORE_TAG,
		cron: '*/30 * * * *',
		summaryNotifications: false,
		lastRunAt: null
	});
	const nextRun = new Date(settings.nextRunAt ?? 0).getTime();
	expect(nextRun, 'The next run should be in the future').toBeGreaterThan(saved);
	expect(nextRun, 'The next run should be at most 30 minutes away').toBeLessThanOrEqual(
		saved + 30 * 60_000
	);
	const job = await renameJob(page, id);
	expect(job, `Settings › Jobs should list arr.rename:${id}`).toBeDefined();
	expect(new Date(job?.next_run_at ?? 0).getTime(), 'The job should run at the next run').toBe(
		nextRun
	);
	expect(await listShowsRenames(page, id), 'The Arr list should show renames on').toBe(true);
	await expect(button(page, 'Dry Run'), 'Dry Run should be unblocked').toBeEnabled();
	await expect(button(page, 'Run Now'), 'Run Now should be unblocked').toBeEnabled();
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. The user adds the fake, opens Renames, and leaves for the Upgrades tab.
 * 2. The user comes back and clicks Save without changing anything.
 *
 * Expects:
 * - leaving shows no unsaved-changes dialog
 * - the defaults are stored
 * - Dry Run is unblocked
 */
test('saves the defaults unchanged', async ({ page, fakeRadarr: fake }) => {
	const id = await setUp(page, fake);
	await expect(button(page, 'Save'), 'Save should be enabled on a new config').toBeEnabled();

	await openTab(page, 'Upgrades');
	await expect(
		page.getByRole('dialog', { name: 'Unsaved Changes' }),
		'Leaving an unchanged new config should not warn'
	).toHaveCount(0);
	await openTab(page, 'Renames');
	await saveRenames(page);

	const { settings } = await renamesData(page, id);
	expect(settings && userFields(settings), 'The defaults should be stored').toEqual({
		...DEFAULTS,
		lastRunAt: null
	});
	await expect(button(page, 'Dry Run'), 'Dry Run should be unblocked').toBeEnabled();
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. The user saves S1's settings.
 * 2. The user turns Schedule off, clears the ignore tag and saves.
 *
 * Expects:
 * - the schedule is off and there is no ignore tag; Folders, Summary and
 *   the cron are unchanged
 * - Settings › Jobs no longer lists `arr.rename:{id}`
 * - the Arr list shows renames off
 */
test('turning the schedule off removes the job', async ({ page, fakeRadarr: fake }) => {
	const id = await setUp(page, fake);
	await setRenameSettings(page, SCHEDULED);
	await clearOfScheduleMark(30);
	await saveRenames(page);
	expect(await renameJob(page, id), 'Saving on should schedule the job').toBeDefined();

	await setRenameSettings(page, { schedule: false, ignoreTag: '' });
	await saveRenames(page);

	const { settings } = await renamesData(page, id);
	expect(settings && userFields(settings), 'Only the schedule and tag should change').toEqual({
		enabled: false,
		renameFolders: true,
		ignoreTag: null,
		cron: '*/30 * * * *',
		summaryNotifications: false,
		lastRunAt: null
	});
	expect(await renameJob(page, id), 'Settings › Jobs should drop the rename job').toBeUndefined();
	expect(await listShowsRenames(page, id), 'The Arr list should show renames off').toBe(false);
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. The user turns Schedule on, sets the custom cron `*\/5 * * * *` and
 *    clicks Save.
 *
 * Expects:
 * - the save fails with "Schedule too frequent. Minimum interval is 10
 *   minutes.", shown as an error alert
 * - nothing is stored and no job is queued
 */
test('refuses a schedule under 10 minutes', async ({ page, fakeRadarr: fake }) => {
	const id = await setUp(page, fake);
	await setRenameSettings(page, { schedule: true, frequency: { custom: '*/5 * * * *' } });

	const saved = waitForAction(page, 'save');
	await button(page, 'Save').click();
	const result = await saved;

	expect(result.type, 'The save should fail').toBe('failure');
	expect(result.data, `The save should say "${TOO_FREQUENT}"`).toEqual({ error: TOO_FREQUENT });
	await expect(
		page.getByText(TOO_FREQUENT, { exact: true }).last(),
		'The error should show'
	).toBeVisible();
	expect((await renamesData(page, id)).settings, 'Nothing should be stored').toBeNull();
	expect(await renameJob(page, id), 'No rename job should be queued').toBeUndefined();
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. The user saves the defaults.
 * 2. The user turns Folders on without saving, then clicks Dry Run and Run
 *    Now.
 *
 * Expects:
 * - Dry Run and Run Now are blocked with "Save or discard your changes
 *   first"
 * - no dialog opens, no run request is sent and no run is stored
 */
test('blocks runs while changes are unsaved', async ({ page, fakeRadarr: fake }) => {
	const id = await setUp(page, fake);
	await saveRenames(page);
	const runPosts: string[] = [];
	page.on('request', (request) => {
		if (request.method() === 'POST' && request.url().endsWith('?/run')) {
			runPosts.push(request.url());
		}
	});

	await setRenameSettings(page, { folders: true });
	await expectRunsBlocked(page, UNSAVED);
	await button(page, 'Dry Run').click({ force: true });
	await button(page, 'Run Now').click({ force: true });

	await expect(renameNowDialog(page), 'No Rename Now dialog should open').toHaveCount(0);
	expect(runPosts, 'No run request should be sent').toEqual([]);
	expect((await renamesData(page, id)).renameRuns, 'No run should be stored').toEqual([]);
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. A needs renaming and B is named right. RenameMovie fails with "Disk
 *    full".
 * 2. The user saves a yearly schedule with the ignore tag, runs a dry run,
 *    then a live run that fails.
 * 3. Profilarr restarts.
 *
 * Expects:
 * - the settings and both runs, with their items and errors, are the same
 *   as before the restart
 * - the scheduled job keeps its next run time
 */
test('settings and run history survive a restart', async ({ app, page, fakeRadarr: fake }) => {
	fake.commandOutcome('RenameMovie', { status: 'failed', message: 'Disk full' });
	await seedLibrary(fake, renameLibrary(fake.type, [titleA(fake.type), titleB(fake.type)]));
	const id = await setUp(page, fake);
	await setRenameSettings(page, {
		schedule: true,
		frequency: { custom: '0 3 1 1 *' },
		ignoreTag: IGNORE_TAG
	});
	await saveRenames(page);
	await dryRun(page);
	expect((await runNow(page)).status, 'The live run should fail').toBe('failure');
	const before = await renamesData(page, id);
	expect(
		before.renameRuns.map((run) => [run.config.dryRun, run.status, run.results.errors.length]),
		'A failed live run and a dry run should be stored, newest first'
	).toEqual([
		[false, 'failed', 1],
		[true, 'success', 0]
	]);
	const nextRun = (await renameJob(page, id))?.next_run_at;
	expect(nextRun, 'The rename job should be scheduled').toBeDefined();

	await app.restart();

	expect(await renamesData(page, id), 'The settings and runs should survive').toEqual(before);
	expect((await renameJob(page, id))?.next_run_at, 'The job should keep its next run').toBe(
		nextRun
	);
	expect(fake.unhandled).toEqual([]);
});
