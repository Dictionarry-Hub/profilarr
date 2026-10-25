/**
 * Settings › Logs: run the cleanup the way a user does, and read the log
 * files the page lists. For the entries themselves, see `logEntries` in
 * helpers/core/logs.ts.
 */

import { expect, test, type Page } from '@playwright/test';
import { waitForAction } from '$flows/helpers/core/forms.ts';
import { waitForJobRun, type JobRun } from '$flows/helpers/core/jobs.ts';
import { openSidebarPage, waitForHydration } from '$flows/helpers/core/nav.ts';
import { pageData } from '$flows/helpers/core/pageData.ts';

/** One file in the Logs page's Log Files list */
export interface LogFile {
	filename: string;
	path: string;
	size: number;
	modified: Date;
}

/** The log files Settings › Logs lists, newest first */
export async function logFiles(page: Page): Promise<LogFile[]> {
	return await test.step(
		'Read the log files',
		async () => {
			const data = await pageData<{ logFiles: LogFile[] }>(page, '/settings/logs');
			return data.logFiles;
		},
		{ box: true }
	);
}

/**
 * Click Cleanup on Settings › Logs, wait for the `logs.cleanup` run, then
 * reload the page. Returns the run, whose output counts the deletions. The
 * status is left to the caller: the job cancels itself when file logging is
 * off.
 */
export async function runLogCleanup(page: Page): Promise<JobRun> {
	return await test.step(
		'Run log cleanup',
		async () => {
			if (page.url() !== 'about:blank' && new URL(page.url()).pathname === '/settings/logs') {
				await waitForHydration(page);
			} else {
				await openSidebarPage(page, 'Logs');
			}
			const started = Date.now();
			const queued = waitForAction(page, 'cleanupLogs');
			await page.getByRole('main').getByRole('button', { name: 'Cleanup', exact: true }).click();
			const result = await queued;
			expect(result.type, 'Queueing the log cleanup should succeed').toBe('success');
			const run = await waitForJobRun(page, 'logs.cleanup', { after: started });

			await page.reload();
			await waitForHydration(page);
			return run;
		},
		{ box: true }
	);
}
