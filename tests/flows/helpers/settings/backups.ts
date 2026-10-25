/**
 * Backup helpers for Settings › Backups: create, download, upload, restore,
 * delete and clean up, the way a user does them. Each one waits for what the
 * app does behind the button (a job run, a form action, a download) and then
 * checks the list, so a scenario continues once the app has finished.
 *
 * A restore only stages the archive. It applies on the next start, so a
 * scenario calls `app.restart()` after `restoreBackup`.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import type { App } from '$flows/harness/app.ts';
import { saveForm, waitForAction, type ActionResult } from '$flows/helpers/core/forms.ts';
import { waitForJobRun, type JobRun } from '$flows/helpers/core/jobs.ts';
import { openSidebarPage, waitForHydration } from '$flows/helpers/core/nav.ts';
import { retentionField } from '$flows/helpers/settings/general.ts';

/** A row of GET /api/v1/backups */
export interface BackupFile {
	filename: string;
	created: string;
	size: number;
	sizeFormatted: string;
}

/** Open Settings › Backups unless the page is already on it */
async function onBackups(page: Page): Promise<void> {
	if (page.url() !== 'about:blank' && new URL(page.url()).pathname === '/settings/backups') {
		await waitForHydration(page);
	} else {
		await openSidebarPage(page, 'Backups');
	}
}

/** The backups table's row for a file */
export function backupRow(page: Page, filename: string): Locator {
	return page
		.getByRole('main')
		.getByRole('row')
		.filter({ has: page.getByText(filename, { exact: true }) });
}

/** The restore banner the root layout shows while a restore is staged */
export function restoreBanner(page: Page): Locator {
	return page.getByRole('status').filter({ hasText: 'Restore pending:' });
}

/** Fail with the app's message unless an action's result reports success */
function expectSuccess(result: ActionResult, what: string): void {
	const data = (result.data ?? {}) as { success?: boolean; error?: string };
	if (result.type !== 'success' || data.success === false) {
		const message = data.error ?? JSON.stringify(result.error ?? result.data);
		throw new Error(`${what} answered ${result.type} (${result.status}): ${message}`);
	}
}

/** What GET /api/v1/backups lists, newest first */
export async function listBackups(page: Page): Promise<BackupFile[]> {
	const response = await page.request.get('/api/v1/backups');
	expect(response.ok(), 'GET /api/v1/backups should answer').toBe(true);
	return (await response.json()) as BackupFile[];
}

/** The name the app gives a backup made at `date`: second precision, UTC */
function backupName(date: Date): string {
	const iso = date.toISOString();
	return `backup-${iso.slice(0, 10)}-${iso.slice(11, 19).replace(/:/g, '')}.tar.gz`;
}

/**
 * Create a backup: click Create Backup, wait for the `backup.create` job to
 * finish, reload the list, and return the new file's name. The list refresh
 * the page does on its own depends on a job status event, so the reload is
 * what this waits on, not that refresh.
 */
export async function createBackup(page: Page): Promise<string> {
	return await test.step(
		'Create a backup',
		async () => {
			await onBackups(page);
			const before = new Set((await listBackups(page)).map((backup) => backup.filename));
			// Names have second precision, so a backup made in the same second as
			// the last one would replace it. Let the second pass first.
			if (before.has(backupName(new Date()))) await page.waitForTimeout(1000 - (Date.now() % 1000));

			const started = Date.now();
			await page.getByRole('main').getByRole('button', { name: 'Create Backup' }).click();
			const run = await waitForJobRun(page, 'backup.create', { after: started });
			expect(run.error, 'The backup job should not fail').toBeNull();
			expect(run.status, 'The backup job should succeed').toBe('success');

			await page.reload();
			await waitForHydration(page);
			const added = (await listBackups(page))
				.map((backup) => backup.filename)
				.filter((filename) => !before.has(filename));
			expect(added, 'The backups list should gain one file').toHaveLength(1);
			const [filename] = added;
			await expect(
				backupRow(page, filename),
				`The backups table should list ${filename}`
			).toBeVisible();
			return filename;
		},
		{ box: true }
	);
}

/**
 * Download a backup from its row and save it as `to`. The download is the
 * sanitized copy, not the file on disk. Returns `to`.
 */
export async function downloadBackup(page: Page, filename: string, to: string): Promise<string> {
	return await test.step(
		`Download ${filename}`,
		async () => {
			await onBackups(page);
			await backupRow(page, filename).getByRole('button', { name: 'Download' }).click();
			const dialog = page.getByRole('dialog', { name: 'Download Backup' });
			await expect(dialog, 'The Download Backup dialog should open').toBeVisible();

			const downloading = page.waitForEvent('download');
			await dialog.getByRole('button', { name: 'Download', exact: true }).click();
			const download = await downloading;
			expect(download.suggestedFilename(), 'The download should be named after the backup').toBe(
				filename
			);
			await download.saveAs(to);
			expect(await download.failure(), 'The download should finish without an error').toBeNull();
			return to;
		},
		{ box: true }
	);
}

/**
 * Extract a backup archive into `into` and return the path of its `data`
 * folder, the one the app restores from.
 */
export async function openArchive(archive: string, into: string): Promise<string> {
	return await test.step(
		`Open archive ${archive}`,
		async () => {
			await fs.mkdir(into, { recursive: true });
			execFileSync('tar', ['-xzf', archive, '-C', into]);
			const data = join(into, 'data');
			const entries = await fs.readdir(data).catch(() => [] as string[]);
			expect(entries, 'The archive should hold a data folder with the app database').toContain(
				'profilarr.db'
			);
			return data;
		},
		{ box: true }
	);
}

/**
 * Upload an archive through Upload Backup and wait until the list shows it.
 * Returns the name the app stored it under: the file's own name when it
 * starts with "backup-", otherwise "backup-uploaded-<time>.tar.gz".
 */
export async function uploadBackup(page: Page, path: string): Promise<string> {
	return await test.step(
		`Upload ${path}`,
		async () => {
			await onBackups(page);
			const uploaded = page.waitForResponse(
				(response) =>
					response.request().method() === 'POST' &&
					new URL(response.url()).pathname === '/api/v1/backups/upload'
			);
			// Upload Backup opens the browser's file picker through a hidden file input
			await page.getByRole('main').locator('input[type="file"]').setInputFiles(path);
			const response = await uploaded;
			const body = (await response.json()) as { filename?: string; error?: string };
			if (!response.ok() || !body.filename) {
				throw new Error(`Uploading answered ${response.status()}: ${body.error ?? 'no filename'}`);
			}
			await expect(
				backupRow(page, body.filename),
				`The backups table should list the upload as ${body.filename}`
			).toBeVisible();
			return body.filename;
		},
		{ box: true }
	);
}

/**
 * Stage a restore from a backup's row and confirm it. The restore banner
 * then shows until the app restarts, which is when the restore applies.
 */
export async function restoreBackup(page: Page, filename: string): Promise<void> {
	await test.step(
		`Restore ${filename}`,
		async () => {
			await onBackups(page);
			await backupRow(page, filename).getByRole('button', { name: 'Restore' }).click();
			const dialog = page.getByRole('dialog', { name: 'Restore Backup' });
			await expect(dialog, 'The Restore Backup dialog should open').toBeVisible();

			const staged = waitForAction(page, 'restoreBackup');
			await dialog.getByRole('button', { name: 'Restore Backup', exact: true }).click();
			expectSuccess(await staged, 'Staging the restore');
			await expect(restoreBanner(page), `The restore banner should name ${filename}`).toContainText(
				filename
			);
		},
		{ box: true }
	);
}

/** Cancel a staged restore from the banner, and wait until the banner is gone */
export async function cancelRestore(page: Page): Promise<void> {
	await test.step(
		'Cancel the staged restore',
		async () => {
			await waitForHydration(page);
			const banner = restoreBanner(page);
			await expect(banner, 'A restore should be staged').toBeVisible();
			// The banner posts to the backups page's action from any page
			const cancelled = page.waitForResponse(
				(response) =>
					response.request().method() === 'POST' &&
					response.url().endsWith('/settings/backups?/cancelRestore')
			);
			await banner.getByRole('button', { name: 'Cancel restore' }).click();
			const result = (await (await cancelled).json()) as { type: string };
			expect(result.type, 'Cancelling the restore should succeed').toBe('success');
			await expect(banner, 'The restore banner should go away').toBeHidden();
		},
		{ box: true }
	);
}

/** Delete a backup from its row, confirm, and wait until the list drops it */
export async function deleteBackup(page: Page, filename: string): Promise<void> {
	await test.step(
		`Delete ${filename}`,
		async () => {
			await onBackups(page);
			const row = backupRow(page, filename);
			await row.getByRole('button', { name: 'Delete' }).click();
			const dialog = page.getByRole('dialog', { name: 'Delete Backup' });
			await expect(dialog, 'The Delete Backup dialog should open').toBeVisible();

			const deleted = page.waitForResponse(
				(response) =>
					response.request().method() === 'DELETE' &&
					new URL(response.url()).pathname === `/api/v1/backups/${filename}`
			);
			await dialog.getByRole('button', { name: 'Delete Backup', exact: true }).click();
			const response = await deleted;
			expect(response.status(), `Deleting ${filename} should answer 200`).toBe(200);
			await expect(row, `The backups table should drop ${filename}`).toHaveCount(0);
		},
		{ box: true }
	);
}

/**
 * Run the cleanup job from the Cleanup button and wait for it to finish,
 * then reload the list. Returns the run, whose output counts the deletions.
 */
export async function runCleanup(page: Page): Promise<JobRun> {
	return await test.step(
		'Run backup cleanup',
		async () => {
			await onBackups(page);
			const started = Date.now();
			const queued = waitForAction(page, 'cleanupBackups');
			await page.getByRole('main').getByRole('button', { name: 'Cleanup' }).click();
			expectSuccess(await queued, 'Queueing the cleanup');
			const run = await waitForJobRun(page, 'backup.cleanup', { after: started });
			expect(run.error, 'The cleanup job should not fail').toBeNull();

			await page.reload();
			await waitForHydration(page);
			return run;
		},
		{ box: true }
	);
}

/**
 * Make a backup file look `days` old by moving its modification time back.
 * Cleanup goes by that time, so this is how a scenario gets a backup past
 * the retention period without waiting.
 */
export async function ageBackup(app: App, filename: string, days: number): Promise<void> {
	await test.step(
		`Age ${filename} by ${days} days`,
		async () => {
			const path = join(app.dir, 'backups', filename);
			const then = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
			await fs.utimes(path, then, then);
			const { mtime } = await fs.stat(path);
			expect(mtime.getTime(), `${filename} should now be ${days} days old`).toBeLessThanOrEqual(
				then.getTime() + 1000
			);
		},
		{ box: true }
	);
}

/**
 * Set the backup retention period on Settings › General and save. Checks
 * the stored value through the backup settings API.
 */
export async function setBackupRetention(page: Page, days: number): Promise<void> {
	await test.step(
		`Set the backup retention period to ${days} days`,
		async () => {
			await openSidebarPage(page, 'General');
			// Logging has a field with the same label
			const retention = retentionField(page, 'backup');
			await expect(retention, 'General should show the backup retention field').toBeVisible();
			await retention.fill(String(days));
			await saveForm(page, { action: 'save' });

			const response = await page.request.get('/api/v1/backups/settings');
			const settings = (await response.json()) as { retentionDays: number };
			expect(settings.retentionDays, `The stored retention period should be ${days}`).toBe(days);
		},
		{ box: true }
	);
}
