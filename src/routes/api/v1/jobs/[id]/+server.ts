import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { components } from '$api/v1.d.ts';
import { jobQueueQueries } from '$db/queries/jobQueue.ts';
import { jobRunHistoryQueries } from '$db/queries/jobRunHistory.ts';

type JobResponse = components['schemas']['JobResponse'];
type ErrorResponse = components['schemas']['ErrorResponse'];

/**
 * GET /api/v1/jobs/{id}
 *
 * Returns the status and result of a job queue entry.
 * If the job has completed, includes the latest run history record.
 */
export const GET: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id!, 10);
	if (isNaN(id) || id < 1) {
		const error: ErrorResponse = { error: 'Invalid job ID' };
		return json(error, { status: 400 });
	}

	const job = jobQueueQueries.getById(id);
	if (!job) {
		const error: ErrorResponse = { error: 'Job not found' };
		return json(error, { status: 404 });
	}

	const runs = jobRunHistoryQueries.getByQueueId(id, 1);
	const latestRun = runs.length > 0 ? runs[0] : null;

	const response: JobResponse = {
		id: job.id,
		jobType: job.jobType,
		status: job.status as JobResponse['status'],
		source: job.source as JobResponse['source'],
		createdAt: job.createdAt,
		startedAt: job.startedAt ?? null,
		finishedAt: job.finishedAt ?? null,
		result: latestRun
			? {
					status: latestRun.status as NonNullable<JobResponse['result']>['status'],
					output: latestRun.output ?? null,
					error: latestRun.error ?? null,
					durationMs: latestRun.durationMs
				}
			: null
	};

	return json(response);
};
