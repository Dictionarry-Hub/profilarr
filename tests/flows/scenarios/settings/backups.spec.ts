/**
 * - Protects: the backup round trip, the part of the app that leans hardest
 *   on the SQLite layer. Creating a backup snapshots the live database with
 *   the online backup API, a restore swaps the data folder in on the next
 *   start, and a download rewrites a copy with secure_delete and VACUUM.
 * - Every check reads what the app stored, or the files under its data
 *   folder, not only what the Backups page shows.
 */
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect, FIXTURES_NAME, type App } from '#flows/helpers/core/test.ts';
import { fixtures } from '#flows/helpers/core/fixtureData.ts';
import { openPage } from '#flows/helpers/core/nav.ts';
import { addArr } from '#flows/helpers/sync/arrs.ts';
import {
	ageBackup,
	backupRow,
	cancelRestore,
	createBackup,
	deleteBackup,
	downloadBackup,
	listBackups,
	openArchive,
	restoreBackup,
	restoreBanner,
	runCleanup,
	setBackupRetention,
	uploadBackup
} from '#flows/helpers/settings/backups.ts';
import type { Page } from '@playwright/test';

const backupPath = (app: App, filename: string) => join(app.dir, 'backups', filename);
const sentinelPath = (app: App) => join(app.dir, '.restore-pending');

const exists = (path: string) =>
	fs.stat(path).then(
		() => true,
		() => false
	);

/** The Arr instances the app has, by name */
async function arrNames(page: Page): Promise<string[]> {
	const response = await page.request.get('/api/v1/arr');
	expect(response.ok(), 'GET /api/v1/arr should answer').toBe(true);
	const instances = (await response.json()) as { name: string }[];
	return instances.map((instance) => instance.name).sort();
}

/** The fixtures database's entity counts from /api/v1/status */
async function fixturesCounts(page: Page): Promise<Record<string, number> | undefined> {
	const response = await page.request.get('/api/v1/status');
	expect(response.ok(), 'GET /api/v1/status should answer').toBe(true);
	const body = (await response.json()) as {
		databases: { name: string; counts: Record<string, number> }[];
	};
	return body.databases.find((database) => database.name === FIXTURES_NAME)?.counts;
}

const SNAPSHOT_COUNTS = {
	customFormats: fixtures.customFormats.length,
	qualityProfiles: fixtures.qualityProfiles.length,
	regularExpressions: fixtures.regularExpressions.length,
	delayProfiles: fixtures.delayProfiles.length
};

/**
 * Flow:
 * 1. The user adds an Arr instance, then creates a backup.
 * 2. The user adds a second Arr instance.
 * 3. The user restores the backup and restarts Profilarr.
 * 4. The user deletes the backup.
 *
 * Expects:
 * - after the restart, only the first Arr instance is left
 * - the archive sits under backups/ and holds one database file, with no
 *   -wal or -shm sidecars, plus INFO.json and the cloned databases
 * - the restore sentinel names the archive while staged and is gone after
 * - the banner is gone after the restart
 * - deleting removes the row and the file
 */
test('restores the state a backup was taken in', async ({
	app,
	page,
	fakeRadarr,
	startArr
}, testInfo) => {
	await addArr(page, { name: 'Before', fake: fakeRadarr });
	const filename = await createBackup(page);
	const archive = backupPath(app, filename);
	expect(await exists(archive), `${filename} should be written under backups/`).toBe(true);

	const data = await openArchive(archive, testInfo.outputPath('local'));
	const entries = await fs.readdir(data);
	expect(
		entries.filter((entry) => entry.startsWith('profilarr.db')),
		'The archive should hold the database as one file, with no -wal or -shm sidecars'
	).toEqual(['profilarr.db']);
	expect(entries, 'The archive should hold INFO.json and the cloned databases').toEqual(
		expect.arrayContaining(['INFO.json', 'databases'])
	);

	await addArr(page, { name: 'After', fake: await startArr('radarr-6') });
	expect(await arrNames(page), 'Both Arr instances should exist before the restore').toEqual([
		'After',
		'Before'
	]);

	await restoreBackup(page, filename);
	expect(
		await fs.readFile(sentinelPath(app), 'utf8'),
		'Restoring should stage the archive path in .restore-pending'
	).toBe(archive);

	await app.restart();
	expect(
		await arrNames(page),
		'After the restart, only the Arr instance from before the backup should be left'
	).toEqual(['Before']);
	expect(
		await exists(sentinelPath(app)),
		'Applying the restore should remove .restore-pending'
	).toBe(false);
	await openPage(page, '/settings/backups');
	await expect(backupRow(page, filename), 'The backup should still be listed').toBeVisible();
	await expect(restoreBanner(page), 'The restore banner should be gone').toHaveCount(0);

	await deleteBackup(page, filename);
	expect(await exists(archive), `Deleting should remove ${filename} from disk`).toBe(false);
});

/**
 * Flow:
 * 1. The user adds an Arr instance, then creates a backup.
 * 2. The user downloads the backup, which is the sanitized copy.
 * 3. The user uploads that file back.
 * 4. The user restores the upload and restarts Profilarr.
 *
 * Expects:
 * - after the restart, there are no Arr instances
 * - the fixtures database is still linked, with the snapshot's counts
 * - the downloaded copy is marked sanitized in INFO.json
 * - the upload is stored under a backup-uploaded name and listed
 */
test('restores a downloaded copy that was uploaded back', async ({
	app,
	page,
	fakeRadarr
}, testInfo) => {
	await addArr(page, { name: 'Shared', fake: fakeRadarr });
	const filename = await createBackup(page);

	// A name that doesn't start with "backup-", so the upload gets its own name
	const copy = await downloadBackup(page, filename, testInfo.outputPath('sanitized-copy.tar.gz'));
	const data = await openArchive(copy, testInfo.outputPath('sanitized'));
	const info = JSON.parse(await fs.readFile(join(data, 'INFO.json'), 'utf8')) as {
		sanitized?: boolean;
	};
	expect(info.sanitized, 'The downloaded copy should be marked sanitized').toBe(true);

	const uploaded = await uploadBackup(page, copy);
	expect(uploaded, 'The upload should be stored under a backup-uploaded name').toMatch(
		/^backup-uploaded-\d+\.tar\.gz$/
	);
	expect(await exists(backupPath(app, uploaded)), `${uploaded} should be on disk`).toBe(true);

	await restoreBackup(page, uploaded);
	await app.restart();
	expect(await arrNames(page), 'The sanitized copy should restore with no Arr instances').toEqual(
		[]
	);
	expect(
		await fixturesCounts(page),
		`${FIXTURES_NAME} should still be linked with the snapshot's entities`
	).toEqual(SNAPSHOT_COUNTS);
});

/**
 * Flow:
 * 1. The user sets the retention period to 1 day on Settings › General.
 * 2. The user creates two backups. The first one then ages past the period.
 * 3. The user clicks Cleanup.
 *
 * Expects:
 * - the aged backup is deleted from disk and the fresh one stays
 * - the list shows only the fresh one
 * - the cleanup run reports one deletion
 */
test('cleanup deletes backups past the retention period', async ({ app, page }) => {
	await setBackupRetention(page, 1);
	const aged = await createBackup(page);
	const fresh = await createBackup(page);
	await ageBackup(app, aged, 2);

	const run = await runCleanup(page);
	expect(
		await exists(backupPath(app, aged)),
		`${aged}, older than the retention period, should be deleted`
	).toBe(false);
	expect(
		await exists(backupPath(app, fresh)),
		`${fresh}, within the retention period, should stay`
	).toBe(true);
	expect(
		(await listBackups(page)).map((backup) => backup.filename),
		'The list should show only the fresh backup'
	).toEqual([fresh]);
	await expect(backupRow(page, fresh), 'The table should list the fresh backup').toBeVisible();
	await expect(backupRow(page, aged), 'The table should drop the aged backup').toHaveCount(0);
	expect(run.output, 'The cleanup run should report one deletion').toContain('deleted 1 backup');
});

/**
 * Flow:
 * 1. The user adds an Arr instance, then creates a backup.
 * 2. The user adds a second Arr instance.
 * 3. The user restores the backup, then cancels it from the banner.
 * 4. Profilarr restarts.
 *
 * Expects:
 * - after the restart, both Arr instances are still there
 * - cancelling removes the restore sentinel
 * - the banner is gone, before and after the restart
 */
test('cancelling a staged restore leaves the data alone', async ({
	app,
	page,
	fakeRadarr,
	startArr
}) => {
	await addArr(page, { name: 'Before', fake: fakeRadarr });
	const filename = await createBackup(page);
	await addArr(page, { name: 'After', fake: await startArr('radarr-6') });

	await restoreBackup(page, filename);
	await cancelRestore(page);
	expect(await exists(sentinelPath(app)), 'Cancelling should remove .restore-pending').toBe(false);

	await app.restart();
	expect(await arrNames(page), 'Both Arr instances should survive the restart').toEqual([
		'After',
		'Before'
	]);
	await openPage(page, '/settings/backups');
	await expect(backupRow(page, filename), 'The backup should still be listed').toBeVisible();
	await expect(restoreBanner(page), 'No restore banner should show').toHaveCount(0);
});
