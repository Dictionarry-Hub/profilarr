/**
 * - Protects: what a rename run records when the Arr fails it: a failed
 *   command, a later batch failing, a library the Arr can't list, and a run
 *   with nothing to rename.
 * - A failed command stops later batches. What earlier batches renamed
 *   stays, and the run is partial.
 * - Known bugs are pinned with `test.fixme()`: failed previews, a command
 *   that renames nothing, and the folder move's wait for its command.
 * - Radarr only, except the batch tests, which use Sonarr's smaller batches.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '$flows/helpers/core/test.ts';
import { addArr, arrInstance } from '$flows/helpers/sync/arrs.ts';
import type { FakeArr, Resource } from '$flows/helpers/sync/fakeArr.ts';
import { seedLibrary } from '$flows/helpers/sync/library.ts';
import {
	dryRun,
	expandRun,
	folderOf,
	numberedTitles,
	openRenames,
	renameLibrary,
	renamesData,
	renamesOf,
	runNow,
	runRow,
	saveRenames,
	setRenameSettings,
	titleA,
	titleB,
	type RenameChanges,
	type RenameRun,
	type RenameTitle
} from '$flows/helpers/sync/renames.ts';

const DISK_FULL = 'Disk full';
/** The error the client gives a 404 */
const NOT_FOUND = 'HTTP 404: Not Found';
/** The folder a move gives title A */
const A_FOLDER = 'Alpha (2020)';

/** The instance name each test gives its fake */
const nameOf = (fake: FakeArr) => `Flow ${fake.target.label}`;

/** Requests the fake got with this method and path, from request `from` on */
const requests = (fake: FakeArr, method: string, path: string, from = 0) =>
	fake.requests.slice(from).filter((r) => r.method === method && r.path === path);

/** Each file's name in the fake right now, oldest file first */
const fileNames = (fake: FakeArr) =>
	fake
		.collection(fake.type === 'radarr' ? 'moviefile' : 'episodefile')
		.map((file) => String(file.relativePath));

/** The error a failed rename batch records */
const batchError = (batch: number, commandId: number) =>
	`File rename failed (batch ${batch}): Command ${commandId} failed: ${DISK_FULL}`;

/** The error a failed preview records */
const previewError = (title: RenameTitle) => `Preview failed for "${title.title}": ${NOT_FOUND}`;

/** The newest stored run */
async function newestRun(page: Page, id: number): Promise<RenameRun> {
	const [run] = (await renamesData(page, id)).renameRuns;
	if (!run) throw new Error('No rename run is stored');
	return run;
}

/**
 * Seed the library, add the fake, open its Renames tab, change the settings
 * and save. Returns the instance id.
 */
async function setUp(
	page: Page,
	fake: FakeArr,
	titles: RenameTitle[],
	settings: RenameChanges = {}
): Promise<number> {
	await seedLibrary(fake, renameLibrary(fake.type, titles));
	await addArr(page, { name: nameOf(fake), fake });
	const { id } = await arrInstance(page, nameOf(fake));
	await openRenames(page, nameOf(fake));
	await setRenameSettings(page, settings);
	await saveRenames(page);
	return id;
}

/** Whether a rename command lists this series */
const lists = (command: Resource, seriesId: number) =>
	((command.seriesIds as number[] | undefined) ?? []).includes(seriesId);

/**
 * Flow:
 * 1. Sonarr has 11 series, each with a file to rename. The first rename
 *    command ends failed with "Disk full".
 * 2. The user runs Run Now.
 *
 * Expects:
 * - one rename command only
 * - the run failed with the batch 1 error, and no file changed in the Arr
 * - the job run is a failure
 * - the history row shows "Failed", and its details the error
 */
test('a failed command stops later batches', async ({ page, fakeSonarr: fake }) => {
	fake.commandOutcome('RenameSeries', { status: 'failed', message: DISK_FULL });
	const id = await setUp(page, fake, numberedTitles(fake.type, 11));
	const before = fileNames(fake);

	const job = await runNow(page);

	expect(fake.commands(), 'Only the first batch should be sent').toHaveLength(1);
	const run = await newestRun(page, id);
	expect(
		[run.status, run.results.filesRenamed, run.results.errors],
		'The run should fail with the batch 1 error'
	).toEqual(['failed', 0, [batchError(1, 1)]]);
	expect(fileNames(fake), 'No file should change').toEqual(before);
	expect(job.status, 'The job should fail').toBe('failure');
	await expect(runRow(page, 1), 'The history row should show the failure').toContainText('Failed');
	await expect(await expandRun(page, 1), 'The details should give the error').toContainText(
		batchError(1, 1)
	);
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. Sonarr has 11 series to rename. The second rename command, for series
 *    11, ends failed with "Disk full".
 * 2. The user runs a dry run, then Run Now.
 *
 * Expects:
 * - the live run is partial, with the first batch's 10 files renamed and
 *   the batch 2 error
 * - the Status filter "Partial" shows the live run and hides the dry run
 * - the job run succeeds
 */
test('a failure in a later batch is partial', async ({ page, fakeSonarr: fake }) => {
	fake.commandOutcome('RenameSeries', (command) =>
		lists(command, 11) ? { status: 'failed', message: DISK_FULL } : { status: 'completed' }
	);
	const titles = numberedTitles(fake.type, 11);
	const id = await setUp(page, fake, titles);
	await dryRun(page);

	const job = await runNow(page);

	const run = await newestRun(page, id);
	expect(
		[run.status, run.results.filesRenamed, run.results.errors],
		'The run should be partial with the batch 2 error'
	).toEqual(['partial', 10, [batchError(2, 2)]]);
	expect(job.status, 'The job should succeed').toBe('success');
	const statusFilter = page
		.getByRole('main')
		.getByRole('group')
		.filter({ has: page.getByRole('button', { name: 'Filter by status' }) });
	await statusFilter.getByRole('button', { name: 'Filter by status' }).hover();
	await statusFilter.getByRole('button', { name: 'Partial', exact: true }).click();
	await expect(runRow(page, 2), 'The Partial filter should show the live run').toContainText(
		'Partial'
	);
	await expect(runRow(page, 1), 'The Partial filter should hide the dry run').toHaveCount(0);
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. The Arr answers its movie list with 404. A 500 would be retried.
 * 2. The user clicks Dry Run.
 *
 * Expects:
 * - the run failed with "HTTP 404: Not Found"
 * - no preview or command is sent
 * - the job run is a failure
 */
test("an Arr that can't list its library fails the run", async ({ page, fakeRadarr: fake }) => {
	const id = await setUp(page, fake, [titleA(fake.type)]);
	fake.fail('GET', '/api/v3/movie', 404);

	const job = await dryRun(page);

	const run = await newestRun(page, id);
	expect([run.status, run.results.errors], 'The run should fail with the error').toEqual([
		'failed',
		[NOT_FOUND]
	]);
	expect(requests(fake, 'GET', '/api/v3/rename'), 'No preview should be asked for').toEqual([]);
	expect(fake.commands(), 'No command should be sent').toEqual([]);
	expect(job.status, 'The job should fail').toBe('failure');
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. The library holds only B, which is named right.
 * 2. The user runs Run Now.
 *
 * Expects:
 * - no rename command
 * - the stored run is a success
 * - the job run is skipped with "0/0 files renamed"
 * - the history row reads "no changes"
 */
test('nothing to rename', async ({ page, fakeRadarr: fake }) => {
	const id = await setUp(page, fake, [titleB(fake.type)]);

	const job = await runNow(page);

	expect(fake.commands(), 'No rename command should be sent').toEqual([]);
	expect((await newestRun(page, id)).status, 'The run should be stored as a success').toBe(
		'success'
	);
	expect([job.status, job.output], 'The job should be skipped').toEqual([
		'skipped',
		'0/0 files renamed'
	]);
	await expect(runRow(page, 1), 'The history row should read "no changes"').toContainText(
		'no changes'
	);
	expect(fake.unhandled).toEqual([]);
});

/** A, B and C need renaming; C's preview fails with 404 */
function failingPreviewTitles(fake: FakeArr): RenameTitle[] {
	const c: RenameTitle = {
		id: 3,
		title: 'Charlie',
		files: [{ from: 'charlie.mkv', to: 'Charlie (2020) Bluray-1080p.mkv' }]
	};
	const b = titleB(fake.type);
	fake.fail('GET', '/api/v3/rename', 404, { movieId: String(c.id) });
	return [titleA(fake.type), { ...b, files: [{ from: 'bravo.mkv', to: b.files[0].to }] }, c];
}

/**
 * Flow:
 * 1. A, B and C need renaming. C's preview fails with 404.
 * 2. The user runs Run Now.
 *
 * Expects:
 * - A and B are renamed
 * - the run records C's error and is partial
 */
// C4: a live run treats a failed preview as nothing to rename
test.fixme('a failed preview in a live run is recorded', async ({ page, fakeRadarr: fake }) => {
	const titles = failingPreviewTitles(fake);
	const [a, b, c] = titles;
	const id = await setUp(page, fake, titles);

	await runNow(page);

	const run = await newestRun(page, id);
	expect(
		run.renamedItems.map((item) => item.id),
		'A and B should be renamed'
	).toEqual([a.id, b.id]);
	expect([run.status, run.results.errors], "The run should record C's error").toEqual([
		'partial',
		[previewError(c)]
	]);
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. A, B and C need renaming. C's preview fails with 404.
 * 2. The user clicks Dry Run.
 *
 * Expects:
 * - the run is partial, lists A and B, and records C's error
 */
// C3: a dry run with any failed preview is stored as failed
test.fixme('a dry run with a failed preview is partial', async ({ page, fakeRadarr: fake }) => {
	const titles = failingPreviewTitles(fake);
	const [a, b, c] = titles;
	const id = await setUp(page, fake, titles);

	await dryRun(page);

	const run = await newestRun(page, id);
	expect(
		[run.status, run.renamedItems, run.results.errors],
		"The dry run should be partial with A, B and C's error"
	).toEqual([
		'partial',
		[a, b].map((title) => ({ id: title.id, title: title.title, files: renamesOf(title) })),
		[previewError(c)]
	]);
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. A needs renaming. The rename command completes without renaming it.
 * 2. The user runs Run Now.
 *
 * Expects:
 * - the run keeps 1 file needing rename and renamed 0
 * - it failed, with an error pointing at the Arr's logs
 */
// C8: a live run overwrites the preview's count with what changed
test.fixme('a completed command that renamed nothing fails the run', async ({
	page,
	fakeRadarr: fake
}) => {
	fake.commandOutcome('RenameMovie', { status: 'completed', noEffect: true });
	const a = titleA(fake.type);
	const id = await setUp(page, fake, [a]);

	await runNow(page);

	const run = await newestRun(page, id);
	expect(
		[run.results.filesNeedingRename, run.results.filesRenamed, run.status],
		'The run should keep the count and fail'
	).toEqual([renamesOf(a).length, 0, 'failed']);
	expect(run.results.errors[0], "The error should point at the Arr's logs").toContain('logs');
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. A needs renaming and its folder is due to change. With the folder
 *    move, a RefreshMonitoredDownloads starts in the same moment.
 * 2. The user saves with Folders on and runs Run Now.
 *
 * Expects:
 * - Profilarr waits on the move command, never polling the stray one
 * - the run counts A's folder
 */
// C11: the folder move waits for any new command, not its own
test.fixme('the folder move waits for its own command', async ({ page, fakeRadarr: fake }) => {
	fake.strayCommandWithMove();
	const a = { ...titleA(fake.type), folderTo: A_FOLDER };
	const id = await setUp(page, fake, [a], { folders: true });

	await runNow(page);

	const stray = fake.listedCommands().find((c) => c.name === 'RefreshMonitoredDownloads');
	expect(stray, 'The stray command should have started').toBeDefined();
	expect(
		requests(fake, 'GET', `/api/v3/command/${stray?.id}`),
		'The stray command should never be polled'
	).toEqual([]);
	const run = await newestRun(page, id);
	expect(
		[run.results.foldersRenamed, run.renamedItems[0]?.folder],
		"The run should count A's folder"
	).toEqual([1, folderOf(fake.type, a)]);
	expect(fake.unhandled).toEqual([]);
});
