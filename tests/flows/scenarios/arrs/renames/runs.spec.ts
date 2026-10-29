/**
 * - Protects: manual rename runs, from Dry Run and Run Now through the
 *   `arr.rename` job, the requests it sends the Arr, what the Arr ends up
 *   with, and the run history the app database stores.
 * - A dry run only previews. A live run renames only after the user
 *   confirms, moves folders only with Folders on, skips media with the
 *   ignore tag, and sends its rename commands in batches.
 * - Each test runs on Radarr 6 and Sonarr 4, which rename through different
 *   endpoints. The schedule stays off, so no scheduled run lands.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '#flows/helpers/core/test.ts';
import { latestJobRunId } from '#flows/helpers/core/jobs.ts';
import { logEntries } from '#flows/helpers/core/logs.ts';
import { addArr, arrInstance } from '#flows/helpers/sync/arrs.ts';
import type { FakeArr } from '#flows/helpers/sync/fakeArr.ts';
import { seedLibrary } from '#flows/helpers/sync/library.ts';
import {
	cancelRenameNow,
	confirmRenameNow,
	dryRun,
	expandRun,
	folderOf,
	numberedTitles,
	openRenameNow,
	openRenames,
	renameLibrary,
	renamesData,
	renamesOf,
	runNow,
	ROOT_FOLDER,
	runRow,
	saveRenames,
	SECOND_ROOT,
	setRenameSettings,
	titleA,
	titleB,
	type RenameChanges,
	type RenameRun,
	type RenameTitle
} from '#flows/helpers/sync/renames.ts';

const IGNORE_TAG = 'no-rename';
/** The folder a move gives title A */
const A_FOLDER = 'Alpha (2020)';
/** How many items one rename command takes */
const BATCH_SIZE = { radarr: 50, sonarr: 10 } as const;

/** The instance name each test gives its fake */
const nameOf = (fake: FakeArr) => `Flow ${fake.target.label}`;

/** Requests the fake got with this method and path, from request `from` on */
const requests = (fake: FakeArr, method: string, path: string, from = 0) =>
	fake.requests.slice(from).filter((r) => r.method === method && r.path === path);

/** The query parameter naming an item, and the editor that moves folders */
const api = (fake: FakeArr) =>
	fake.type === 'radarr'
		? { id: 'movieId', ids: 'movieIds', command: 'RenameMovie', editor: '/api/v3/movie/editor' }
		: {
				id: 'seriesId',
				ids: 'seriesIds',
				command: 'RenameSeries',
				editor: '/api/v3/series/editor'
			};

/** The item ids previews were asked for, from request `from` on */
const previewedIds = (fake: FakeArr, from = 0) =>
	requests(fake, 'GET', '/api/v3/rename', from).map((r) => Number(r.query.get(api(fake).id)));

/** The rename command a live run sends for these ids */
const renameCommand = (fake: FakeArr, ids: number[]) => ({
	name: api(fake).command,
	[api(fake).ids]: ids
});

/** Each file's name in the fake right now, by item id */
function fileNames(fake: FakeArr): Record<number, string[]> {
	const files = fake.collection(fake.type === 'radarr' ? 'moviefile' : 'episodefile');
	const key = fake.type === 'radarr' ? 'movieId' : 'seriesId';
	const names: Record<number, string[]> = {};
	for (const file of files) {
		const id = Number(file[key]);
		names[id] = [...(names[id] ?? []), String(file.relativePath)];
	}
	return names;
}

/** An item's folder in the fake right now */
const pathOf = (fake: FakeArr, id: number) =>
	fake.collection(fake.type === 'radarr' ? 'movie' : 'series').find((item) => item.id === id)?.path;

/** "1 file" or "2 files" */
const files = (count: number) => `${count} file${count === 1 ? '' : 's'}`;

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

for (const targetId of ['radarr-6', 'sonarr-4']) {
	/**
	 * Flow:
	 * 1. A needs renaming and B is named right.
	 * 2. The user saves with Folders on and Schedule off, and clicks Dry Run.
	 *
	 * Expects:
	 * - one preview request for each of A and B
	 * - no rename command, no editor request, and no file changed in the Arr
	 * - the job run succeeds with "N files would be renamed", N being A's
	 * - the stored run is a successful manual dry run of 2 items, none
	 *   skipped by tag, listing A's old and new names
	 * - the history row shows "Dry Run" and "Success"
	 * - the log summary reads "N files would be renamed across 1 entities"
	 */
	test(`dry run previews and changes nothing (${targetId})`, async ({ page, startArr }) => {
		const fake = await startArr(targetId);
		const a = titleA(fake.type);
		const id = await setUp(page, fake, [a, titleB(fake.type)], { folders: true });
		const before = fileNames(fake);
		const from = fake.requests.length;

		const job = await dryRun(page);

		expect(previewedIds(fake, from), 'A and B should each be previewed once').toEqual([1, 2]);
		expect(fake.commands(), 'No rename command should be sent').toEqual([]);
		expect(requests(fake, 'PUT', api(fake).editor, from), 'No folder should move').toEqual([]);
		expect(fileNames(fake), 'No file should change').toEqual(before);
		const count = renamesOf(a).length;
		expect([job.status, job.output], 'The job should report the files it would rename').toEqual([
			'success',
			`${count} files would be renamed`
		]);
		const run = await newestRun(page, id);
		expect(
			{
				status: run.status,
				dryRun: run.config.dryRun,
				manual: run.config.manual,
				totalItems: run.library.totalItems,
				skippedByTag: run.filtering.skippedByTag,
				filesNeedingRename: run.results.filesNeedingRename
			},
			'The run should be a successful manual dry run of 2 items'
		).toEqual({
			status: 'success',
			dryRun: true,
			manual: true,
			totalItems: 2,
			skippedByTag: 0,
			filesNeedingRename: count
		});
		expect(run.renamedItems, "The run should list A's old and new names").toEqual([
			{ id: a.id, title: a.title, files: renamesOf(a) }
		]);
		for (const text of ['Dry Run', 'Success']) {
			await expect(runRow(page, 1), `The history row should read "${text}"`).toContainText(text);
		}
		const summary = `Completed Job: manual dry run rename for "${nameOf(fake)}": ${count} files would be renamed across 1 entities (`;
		const logged = await logEntries(page, { source: 'RenameJob' });
		expect(
			logged.map((entry) => entry.message).filter((message) => message.startsWith(summary)),
			`The log should read "${summary}...ms)"`
		).toHaveLength(1);
		expect(fake.unhandled).toEqual([]);
	});

	/**
	 * Flow:
	 * 1. A needs renaming and B is named right. Folders is off.
	 * 2. The user clicks Run Now, then Cancel.
	 * 3. The user clicks Run Now, then Rename.
	 *
	 * Expects:
	 * - after Cancel, no run is queued and nothing reaches the Arr
	 * - after Rename, one rename command for A only
	 * - A's files hold their new names in the Arr, B's are unchanged
	 * - the job output reads "N/N files renamed"
	 * - the stored run lists A's old and new names, and no folder
	 */
	test(`Run Now renames only after you confirm (${targetId})`, async ({ page, startArr }) => {
		const fake = await startArr(targetId);
		const [a, b] = [titleA(fake.type), titleB(fake.type)];
		const id = await setUp(page, fake, [a, b]);
		const runPosts: string[] = [];
		page.on('request', (request) => {
			if (request.method() === 'POST' && request.url().endsWith('?/run')) {
				runPosts.push(request.url());
			}
		});
		const from = fake.requests.length;

		await openRenameNow(page);
		await cancelRenameNow(page);

		expect(runPosts, 'Cancel should send no run request').toEqual([]);
		expect(await latestJobRunId(page, 'arr.rename'), 'Cancel should queue no run').toBe(0);
		expect(previewedIds(fake, from), 'Cancel should preview nothing').toEqual([]);
		expect(fake.commands(), 'Cancel should send no command').toEqual([]);

		const job = await runNow(page);

		expect(fake.commands(), 'One rename command should go out for A only').toEqual([
			renameCommand(fake, [a.id])
		]);
		expect(fileNames(fake), "A's files should hold their new names, B's should not change").toEqual(
			{
				[a.id]: a.files.map((file) => file.to),
				[b.id]: b.files.map((file) => file.from)
			}
		);
		const count = renamesOf(a).length;
		expect([job.status, job.output], 'The job should report the files it renamed').toEqual([
			'success',
			`${count}/${count} files renamed`
		]);
		const run = await newestRun(page, id);
		expect(run.renamedItems, "The run should list A's renames and no folder").toEqual([
			{ id: a.id, title: a.title, files: renamesOf(a) }
		]);
		expect(fake.unhandled).toEqual([]);
	});

	/**
	 * Flow:
	 * 1. A needs renaming and its folder is due to change. B sits under a
	 *    second root folder.
	 * 2. The user saves with Folders on, clicks Run Now and confirms.
	 *
	 * Expects:
	 * - the dialog adds "Folders will be renamed too."
	 * - one editor request per root folder, after the rename command
	 * - A's folder is the new one in the Arr
	 * - the stored run counts 1 folder, the history row says "N files,
	 *   1 folder renamed", and its details "N files renamed, 1 folder
	 *   renamed"
	 */
	test(`renames folders when Folders is on (${targetId})`, async ({ page, startArr }) => {
		const fake = await startArr(targetId);
		const a = { ...titleA(fake.type), folderTo: A_FOLDER };
		const b = { ...titleB(fake.type), rootFolderPath: SECOND_ROOT[fake.type] };
		const id = await setUp(page, fake, [a, b], { folders: true });
		const from = fake.requests.length;

		const dialog = await openRenameNow(page);
		await expect(dialog, 'The dialog should say folders move too').toContainText(
			'Folders will be renamed too.'
		);
		const job = await confirmRenameNow(page);

		expect(job.status, `The job should succeed: ${job.error}`).toBe('success');
		const moves = requests(fake, 'PUT', api(fake).editor, from);
		expect(
			moves.map((r) => r.body),
			'One editor request should go out per root folder'
		).toEqual([
			{ [api(fake).ids]: [a.id], rootFolderPath: ROOT_FOLDER[fake.type], moveFiles: true },
			{ [api(fake).ids]: [b.id], rootFolderPath: b.rootFolderPath, moveFiles: true }
		]);
		const renamed = fake.requests.indexOf(requests(fake, 'POST', '/api/v3/command', from)[0]);
		expect(
			fake.requests.indexOf(moves[0]),
			'The folders should move after the rename command'
		).toBeGreaterThan(renamed);
		expect(pathOf(fake, a.id), "A's folder should be the new one").toBe(
			folderOf(fake.type, a).newPath
		);
		const run = await newestRun(page, id);
		expect(
			[run.results.foldersRenamed, run.renamedItems[0]?.folder],
			"The run should count A's folder"
		).toEqual([1, folderOf(fake.type, a)]);
		await expect(runRow(page, 1), 'The history row should count the file and folder').toContainText(
			`${files(renamesOf(a).length)}, 1 folder renamed`
		);
		await expect(
			await expandRun(page, 1),
			'The details should count the file and folder'
		).toContainText(`${files(renamesOf(a).length)} renamed, 1 folder renamed`);
		expect(fake.unhandled).toEqual([]);
	});

	/**
	 * Flow:
	 * 1. A's files are named right, but its folder isn't. B is named right.
	 * 2. The user saves with Folders on and runs Run Now.
	 *
	 * Expects:
	 * - the job run succeeds with output naming 0 files and 1 folder, not
	 *   skipped
	 * - A's folder is the new one in the Arr
	 */
	test(`a folder-only run counts as done (${targetId})`, async ({ page, startArr }) => {
		const fake = await startArr(targetId);
		const named = titleA(fake.type);
		const a = {
			...named,
			files: named.files.map((file) => ({ ...file, from: file.to })),
			folderTo: A_FOLDER
		};
		await setUp(page, fake, [a, titleB(fake.type)], { folders: true });

		const job = await runNow(page);

		expect([job.status, job.output], 'The job should count the folder as done').toEqual([
			'success',
			'0/0 files, 1 folder renamed'
		]);
		expect(pathOf(fake, a.id), "A's folder should be the new one").toBe(
			folderOf(fake.type, a).newPath
		);
		expect(fake.unhandled).toEqual([]);
	});

	/**
	 * Flow:
	 * 1. A needs renaming and carries the tag "no-rename". B is named right.
	 * 2. The user types "No-Rename" as the ignore tag, saves and runs Run
	 *    Now.
	 *
	 * Expects:
	 * - the field holds "no-rename" with the warning "Tags must be lowercase"
	 * - no preview request for A, and A's files are unchanged
	 * - the run shows "1 skipped by tag"
	 */
	test(`skips media with the ignore tag (${targetId})`, async ({ page, startArr }) => {
		const fake = await startArr(targetId);
		const a = { ...titleA(fake.type), tags: [IGNORE_TAG] };
		const b = titleB(fake.type);
		await seedLibrary(fake, renameLibrary(fake.type, [a, b]));
		await addArr(page, { name: nameOf(fake), fake });
		const { id } = await arrInstance(page, nameOf(fake));
		await openRenames(page, nameOf(fake));

		await setRenameSettings(page, { ignoreTag: 'No-Rename' });
		await expect(
			page.getByText('Tags must be lowercase', { exact: true }).last(),
			'The lowercase warning should show'
		).toBeVisible();
		await saveRenames(page);
		const from = fake.requests.length;
		await runNow(page);

		expect(previewedIds(fake, from), 'Only B should be previewed').toEqual([b.id]);
		expect(fileNames(fake)[a.id], "A's files should be unchanged").toEqual(
			a.files.map((file) => file.from)
		);
		const run = await newestRun(page, id);
		expect([run.config.ignoreTag, run.filtering], 'The run should skip A by its tag').toEqual([
			IGNORE_TAG,
			{ afterIgnoreTag: 1, skippedByTag: 1 }
		]);
		const details = await expandRun(page, 1);
		await expect(details, 'The run should show "1 skipped by tag"').toContainText(
			'1 skipped by tag'
		);
		expect(fake.unhandled).toEqual([]);
	});

	/**
	 * Flow:
	 * 1. A needs renaming. A and B both carry the tag "no-rename".
	 * 2. The user saves "no-rename" as the ignore tag and runs Run Now.
	 *
	 * Expects:
	 * - the stored run is skipped, with both skipped by tag
	 * - no preview or command is sent
	 * - the job run is skipped
	 */
	test(`skips the run when every item has the ignore tag (${targetId})`, async ({
		page,
		startArr
	}) => {
		const fake = await startArr(targetId);
		const tagged = [titleA(fake.type), titleB(fake.type)].map((title) => ({
			...title,
			tags: [IGNORE_TAG]
		}));
		const id = await setUp(page, fake, tagged, { ignoreTag: IGNORE_TAG });
		const from = fake.requests.length;

		const job = await runNow(page);

		const run = await newestRun(page, id);
		expect([run.status, run.filtering], 'The run should be skipped by the tag').toEqual([
			'skipped',
			{ afterIgnoreTag: 0, skippedByTag: 2 }
		]);
		expect(previewedIds(fake, from), 'No preview should be asked for').toEqual([]);
		expect(fake.commands(), 'No command should be sent').toEqual([]);
		expect(job.status, 'The job should be skipped').toBe('skipped');
		expect(fake.unhandled).toEqual([]);
	});

	/**
	 * Flow:
	 * 1. 51 movies, or 11 series, each have one file to rename.
	 * 2. The user runs Run Now.
	 *
	 * Expects:
	 * - two rename commands: ids 1 to 50 then 51 (Sonarr 1 to 10, then 11)
	 * - the second is sent after the first completed
	 * - the run counts two commands triggered and completed
	 */
	test(`renames in batches (${targetId})`, async ({ page, startArr }) => {
		const fake = await startArr(targetId);
		const size = BATCH_SIZE[fake.type];
		const titles = numberedTitles(fake.type, size + 1);
		const id = await setUp(page, fake, titles);

		const job = await runNow(page);

		expect(job.status, `The job should succeed: ${job.error}`).toBe('success');
		const ids = titles.map((title) => title.id);
		expect(fake.commands(), 'The renames should go out in two batches').toEqual([
			renameCommand(fake, ids.slice(0, size)),
			renameCommand(fake, ids.slice(size))
		]);
		const [, second] = requests(fake, 'POST', '/api/v3/command');
		const firstDone = requests(fake, 'GET', '/api/v3/command/1')[0];
		expect(firstDone, 'The first command should be checked').toBeDefined();
		expect(
			fake.requests.indexOf(second),
			'The second batch should go out after the first completed'
		).toBeGreaterThan(fake.requests.indexOf(firstDone));
		const { results } = await newestRun(page, id);
		expect(
			[results.commandsTriggered, results.commandsCompleted, results.filesRenamed],
			'The run should count both commands and every file'
		).toEqual([2, 2, titles.length]);
		expect(fake.unhandled).toEqual([]);
	});
}
