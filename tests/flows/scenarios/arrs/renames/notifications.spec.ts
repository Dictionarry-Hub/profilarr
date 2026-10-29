/**
 * - Protects: the notifications a rename run sends, from the run through a
 *   Webhook service set up in Settings › Notifications to what the webhook
 *   receives.
 * - A live run sends one notification: a summary, or with Summary off a
 *   section per title. A run that renames nothing still says so. A failed
 *   run gives its error, even when it fails before renaming anything.
 * - A dry run sends nothing.
 * - Radarr, except the detailed message, which groups Sonarr's files by
 *   season.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '#flows/helpers/core/test.ts';
import { createNotificationService } from '#flows/helpers/settings/notifications.ts';
import type { FakeWebhook } from '#flows/helpers/settings/fakeWebhook.ts';
import { addArr } from '#flows/helpers/sync/arrs.ts';
import type { FakeArr } from '#flows/helpers/sync/fakeArr.ts';
import { seedLibrary } from '#flows/helpers/sync/library.ts';
import {
	dryRun,
	folderOf,
	openRenames,
	renameLibrary,
	runNow,
	saveRenames,
	setRenameSettings,
	titleA,
	titleB,
	type RenameChanges,
	type RenameTitle
} from '#flows/helpers/sync/renames.ts';

const HOOK = '/hooks/renames';
const RENAME_TYPES = ['Rename Completed (Success)', 'Rename Completed (Partial)', 'Rename Failed'];
const DISK_FULL = 'Disk full';
/** The folder a move gives title A */
const A_FOLDER = 'Alpha (2020)';

/** The instance name each test gives its fake */
const nameOf = (fake: FakeArr) => `Flow ${fake.target.label}`;

/** A notification as the Webhook service posts it */
interface Notified {
	type: string;
	severity: string;
	title: string;
	message: string;
	blocks: { kind: string; title?: string; content?: string; label?: string; value?: string }[];
}

/** What the webhook received on the test's hook, oldest first */
const notified = (webhook: FakeWebhook) =>
	webhook.requests.filter((request) => request.path === HOOK).map((r) => r.body as Notified);

/** Wait until the webhook got exactly one notification, and return it */
async function onlyNotification(webhook: FakeWebhook, type: string): Promise<Notified> {
	await expect
		.poll(() => notified(webhook).map((n) => n.type), {
			message: `The webhook should get one ${type}`
		})
		.toEqual([type]);
	return notified(webhook)[0];
}

/** A file's name without its season folder, as a notification shows it */
const fileName = (path: string) => path.split('/').pop() ?? path;

/**
 * Add a Webhook service for every rename type, seed the library, add the
 * fake, open its Renames tab, change the settings and save
 */
async function setUp(
	page: Page,
	fake: FakeArr,
	webhook: FakeWebhook,
	titles: RenameTitle[],
	settings: RenameChanges = {}
): Promise<void> {
	await createNotificationService(page, {
		name: 'Renames Webhook',
		url: webhook.url(HOOK),
		types: RENAME_TYPES
	});
	await seedLibrary(fake, renameLibrary(fake.type, titles));
	await addArr(page, { name: nameOf(fake), fake });
	await openRenames(page, nameOf(fake));
	await setRenameSettings(page, settings);
	await saveRenames(page);
}

/** A and B, both with a file to rename */
function twoToRename(fake: FakeArr): RenameTitle[] {
	const b = titleB(fake.type);
	return [titleA(fake.type), { ...b, files: [{ from: 'bravo.mkv', to: b.files[0].to }] }];
}

/**
 * Flow:
 * 1. A Webhook service gets every rename type. A and B each have a file to
 *    rename. Summary is on.
 * 2. The user runs Run Now.
 *
 * Expects:
 * - one `rename.success` titled "Manual Rename Complete - <Arr>", saying
 *   "Renamed 2 files for <Arr>"
 * - a Stats block "Files:    2/2"
 * - one sample section "<A> + 1 other" with A's file before and after
 */
test('a live run sends a summary', async ({ page, fakeRadarr: fake, fakeWebhook }) => {
	const titles = twoToRename(fake);
	await setUp(page, fake, fakeWebhook, titles);

	await runNow(page);

	const notification = await onlyNotification(fakeWebhook, 'rename.success');
	const [a] = titles;
	expect(
		[notification.title, notification.message],
		'The notification should name the Arr and count the files'
	).toEqual([`Manual Rename Complete - ${nameOf(fake)}`, `Renamed 2 files for ${nameOf(fake)}`]);
	expect(notification.blocks, 'The notification should hold the stats and one sample').toEqual([
		{ kind: 'section', title: 'Stats', content: 'Files:    2/2' },
		{
			kind: 'section',
			title: `${a.title} + 1 other`,
			content: `Before\n${a.files[0].from}\n\nAfter\n${a.files[0].to}`
		}
	]);
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. A Webhook service gets every rename type. Sonarr's A has a season 1
 *    and a season 2 file to rename, and its folder is due to change.
 * 2. The user saves with Summary off and Folders on, and runs Run Now.
 *
 * Expects:
 * - Stats "Files:    2/2" and "Folders:  1"
 * - A's section shows the folder before and after, then season 1, then
 *   season 2
 */
test('a detailed Sonarr message groups files by season', async ({
	page,
	fakeSonarr: fake,
	fakeWebhook
}) => {
	const a: RenameTitle = {
		...titleA(fake.type),
		files: [
			{
				from: 'Season 01/Alpha - S01E01 - TBA.mkv',
				to: 'Season 01/Alpha - S01E01 - Pilot.mkv',
				season: 1
			},
			{
				from: 'Season 02/Alpha - S02E01 - TBA.mkv',
				to: 'Season 02/Alpha - S02E01 - Return.mkv',
				season: 2
			}
		],
		folderTo: A_FOLDER
	};
	await setUp(page, fake, fakeWebhook, [a, titleB(fake.type)], { summary: false, folders: true });

	await runNow(page);

	const notification = await onlyNotification(fakeWebhook, 'rename.success');
	const folder = folderOf(fake.type, a);
	const [s1, s2] = a.files;
	expect(notification.blocks, "The notification should hold the stats and A's section").toEqual([
		{ kind: 'section', title: 'Stats', content: 'Files:    2/2\nFolders:  1' },
		{
			kind: 'section',
			title: a.title,
			content: [
				`Folder (Before)\n${folder.existingPath}`,
				`Folder (After)\n${folder.newPath}`,
				`Season 1 (Before)\n${fileName(s1.from)}`,
				`Season 1 (After)\n${fileName(s1.to)}`,
				`Season 2 (Before)\n${fileName(s2.from)}`,
				`Season 2 (After)\n${fileName(s2.to)}`
			].join('\n\n')
		}
	]);
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. A Webhook service gets every rename type. The library holds only B,
 *    which is named right.
 * 2. The user runs Run Now.
 *
 * Expects:
 * - one `rename.success` saying "No files needed renaming for <Arr>"
 */
test('nothing to rename still notifies', async ({ page, fakeRadarr: fake, fakeWebhook }) => {
	await setUp(page, fake, fakeWebhook, [titleB(fake.type)]);

	await runNow(page);

	const notification = await onlyNotification(fakeWebhook, 'rename.success');
	expect(notification.message, 'The notification should say nothing needed renaming').toBe(
		`No files needed renaming for ${nameOf(fake)}`
	);
	expect(fake.unhandled).toEqual([]);
});

/**
 * Flow:
 * 1. A Webhook service gets every rename type. A and B each have a file to
 *    rename.
 * 2. The user clicks Dry Run.
 *
 * Expects:
 * - the webhook gets nothing once the job run has finished
 */
test('a dry run sends nothing', async ({ page, fakeRadarr: fake, fakeWebhook }) => {
	await setUp(page, fake, fakeWebhook, twoToRename(fake));

	const job = await dryRun(page);

	expect(job.status, `The dry run should succeed: ${job.error}`).toBe('success');
	expect(notified(fakeWebhook), 'A dry run should send no notification').toEqual([]);
	expect(fake.unhandled).toEqual([]);
});

for (const { name, error, fail } of [
	{
		name: 'a rename command fails',
		error: `File rename failed (batch 1): Command 1 failed: ${DISK_FULL}`,
		fail: (fake: FakeArr) =>
			fake.commandOutcome('RenameMovie', { status: 'failed', message: DISK_FULL })
	},
	{
		name: "the Arr can't list its library",
		error: 'HTTP 404: Not Found',
		// 404, not 500: the client retries a 500
		fail: (fake: FakeArr) => fake.fail('GET', '/api/v3/movie', 404)
	}
]) {
	/**
	 * Flow:
	 * 1. A Webhook service gets every rename type. A needs renaming.
	 * 2. The Arr fails the run: a rename command fails with "Disk full", or
	 *    the movie list answers 404.
	 * 3. The user runs Run Now.
	 *
	 * Expects:
	 * - one `rename.failed` titled "Manual Rename Failed - <Arr>", whose
	 *   message gives the error
	 */
	test(`a failed run sends Rename Failed when ${name}`, async ({
		page,
		fakeRadarr: fake,
		fakeWebhook
	}) => {
		await setUp(page, fake, fakeWebhook, [titleA(fake.type)]);
		fail(fake);

		const job = await runNow(page);

		expect(job.status, 'The job should fail').toBe('failure');
		const notification = await onlyNotification(fakeWebhook, 'rename.failed');
		expect(
			[notification.title, notification.message],
			'The notification should give the error'
		).toEqual([
			`Manual Rename Failed - ${nameOf(fake)}`,
			`Rename failed for ${nameOf(fake)}: ${error}`
		]);
		expect(fake.unhandled).toEqual([]);
	});
}
