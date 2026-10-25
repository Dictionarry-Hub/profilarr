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

/** One scheduled job on Settings › Jobs */
export interface ScheduledJob {
	id: number;
	/** The job type, e.g. "arr.cleanup" */
	name: string;
	displayName: string;
	/** The dedupe key, e.g. "arr.cleanup:3", one per instance and job type */
	description: string;
	enabled: boolean;
	status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled';
	/** ISO timestamp */
	next_run_at: string;
	last_run_at: string | null;
}

/** The scheduled jobs Settings › Jobs lists */
export async function scheduledJobs(page: Page): Promise<ScheduledJob[]> {
	return await test.step(
		'Read the scheduled jobs',
		async () => {
			const { jobs } = await pageData<{ jobs: ScheduledJob[] }>(page, '/settings/jobs');
			return jobs;
		},
		{ box: true }
	);
}

/**
 * Wait until no job is running, as `/api/v1/status` reports it. Deleting an
 * Arr instance while one of its jobs runs crashes the server, so a scenario
 * waits for this before a delete.
 */
export async function waitForIdleJobs(page: Page, timeout = 30_000): Promise<void> {
	await test.step(
		'Wait until no job is running',
		async () => {
			await expect
				.poll(
					async () => {
						const response = await page.request.get('/api/v1/status');
						const status = (await response.json()) as { jobs: { active: number } };
						return status.jobs.active;
					},
					{ message: '/api/v1/status should report no active jobs', timeout }
				)
				.toBe(0);
		},
		{ box: true }
	);
}
