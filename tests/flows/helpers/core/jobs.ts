/**
 * Job run helpers. Pages that start a job, such as Create Backup, only show
 * an alert that it was queued. The job itself runs in the background, and the
 * Jobs page lists each run once it has finished, with its status and output.
 * A scenario waits for that run instead of guessing how long the job takes.
 */

import { expect, test, type Page } from '@playwright/test';
import { pageData } from '$flows/helpers/core/pageData.ts';

/** One finished run on Settings › Jobs */
export interface JobRun {
	id: number;
	queueId: number | null;
	/** The job type, e.g. "backup.create" */
	jobType: string;
	status: 'success' | 'failure' | 'skipped' | 'cancelled';
	/** ISO timestamps */
	startedAt: string;
	finishedAt: string;
	durationMs: number;
	output: string | null;
	error: string | null;
	displayName: string;
}

interface JobsPageData {
	jobRuns: JobRun[];
}

export interface WaitForJobRunOptions {
	/**
	 * Only count a run that started at or after this time, as `Date.now()`
	 * taken before the click that queues the job. Without it, an earlier run
	 * of the same type, such as a scheduled one, would do.
	 */
	after?: number;
	/** How long to wait, in ms. Default 30s. */
	timeout?: number;
}

/**
 * Wait until Settings › Jobs lists a finished run of `jobType`, and return
 * it. The run's status is left to the caller: a job can finish as a failure,
 * and some scenarios expect that.
 */
export async function waitForJobRun(
	page: Page,
	jobType: string,
	options: WaitForJobRunOptions = {}
): Promise<JobRun> {
	const { after = 0, timeout = 30_000 } = options;
	// The app stores start times to the second, so a run queued in the same
	// second as `after` reads as slightly earlier. Compare from that second.
	const since = Math.floor(after / 1000) * 1000;
	return await test.step(
		`Wait for a ${jobType} run`,
		async () => {
			let found: JobRun | undefined;
			await expect
				.poll(
					async () => {
						const { jobRuns } = await pageData<JobsPageData>(page, '/settings/jobs');
						found = jobRuns.find(
							(run) => run.jobType === jobType && new Date(run.startedAt).getTime() >= since
						);
						return found?.id ?? null;
					},
					{
						message: `Settings › Jobs should list a finished ${jobType} run`,
						timeout,
						intervals: [250, 500, 1000]
					}
				)
				.not.toBeNull();
			if (!found) throw new Error(`No ${jobType} run was found`);
			return found;
		},
		{ box: true }
	);
}
