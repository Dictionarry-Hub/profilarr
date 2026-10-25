/**
 * - Protects: log cleanup through the app, from the retention saved on
 *   General to the Cleanup button on Logs and the files left in the logs
 *   folder.
 * - The unit test cleanupLogs.test.ts covers the cleanup logic itself.
 */
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect } from '$flows/helpers/core/test.ts';
import { saveForm } from '$flows/helpers/core/forms.ts';
import { openSidebarPage } from '$flows/helpers/core/nav.ts';
import { generalSettings, retentionField } from '$flows/helpers/settings/general.ts';
import { logFiles, plantLogFile, runLogCleanup } from '$flows/helpers/settings/logs.ts';

const RETENTION_DAYS = 1;
const OLD_LOG = '2020-01-01.log';
const DELETED_ONE = 'Cleanup completed: deleted 1 file(s), 0 error(s)';

const exists = (path: string) =>
	fs.stat(path).then(
		() => true,
		() => false
	);

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Flow:
 * 1. On General, the user sets the log retention to 1 day and saves.
 * 2. A log file from 2020 is planted in the logs folder.
 * 3. On Logs, the user clicks Cleanup.
 *
 * Expects:
 * - the planted file is deleted, and today's log stays
 * - the Logs page no longer lists the planted file, in its data or in the
 *   Log Files menu
 * - the run reports one file deleted
 * - file logging stays on, since the job cancels itself when it is off
 */
test('cleanup deletes log files past the saved retention', async ({ app, page }) => {
	await openSidebarPage(page, 'General');
	const retention = retentionField(page, 'log');
	await retention.fill(String(RETENTION_DAYS));
	await retention.press('Tab');
	await saveForm(page, { action: 'save' });
	const { logSettings } = await generalSettings(page);
	expect(
		{ retention: logSettings.retention_days, fileLogging: logSettings.file_logging },
		'The saved retention should be 1 day, with file logging on'
	).toEqual({ retention: RETENTION_DAYS, fileLogging: true });

	const planted = await plantLogFile(app, OLD_LOG);
	const before = (await logFiles(page)).map((file) => file.filename);
	expect(before, 'control: the Logs page should list the planted file').toContain(OLD_LOG);
	const kept = before.filter((filename) => filename !== OLD_LOG);
	expect(kept.length, "control: the Logs page should list today's log too").toBeGreaterThan(0);

	await openSidebarPage(page, 'Logs');
	const run = await runLogCleanup(page);
	expect(
		{ status: run.status, output: run.output },
		'The cleanup run should report one file deleted'
	).toEqual({ status: 'success', output: DELETED_ONE });

	expect(await exists(planted), `${OLD_LOG} should be deleted`).toBe(false);
	for (const filename of kept) {
		expect(await exists(join(app.dir, 'logs', filename)), `${filename} should stay`).toBe(true);
	}
	expect(
		(await logFiles(page)).map((file) => file.filename),
		'The Logs page should list only the files left'
	).toEqual(kept);

	// The Log Files button opens its menu on hover
	const logFilesButton = page.getByRole('button', { name: 'Log Files', exact: true });
	await page.getByRole('main').locator(logFilesButton).hover();
	// `has` searches inside each group, so it takes the button on its own, not under main
	const menu = page.getByRole('main').getByRole('group').filter({ has: logFilesButton });
	await expect(
		menu.getByRole('button', { name: new RegExp(`^${escapeRegExp(kept[0])}`) }),
		`The Log Files menu should list ${kept[0]}`
	).toBeVisible();
	await expect(
		menu.getByRole('button', { name: new RegExp(`^${escapeRegExp(OLD_LOG)}`) }),
		`The Log Files menu should no longer list ${OLD_LOG}`
	).toHaveCount(0);
});
