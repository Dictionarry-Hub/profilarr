import type { Actions } from '@sveltejs/kit';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { jobQueueQueries } from '$db/queries/jobQueue.ts';
import { jobRunHistoryQueries } from '$db/queries/jobRunHistory.ts';
import { buildJobDisplayName } from '$lib/server/jobs/display.ts';
import type { JobQueueRecord } from '$jobs/queueTypes.ts';

export const load = () => {
	const arrInstances = arrInstancesQueries.getAll();
	const databases = databaseInstancesQueries.getAll();
	const lookups = {
		arrNameById: new Map(arrInstances.map((instance) => [instance.id, instance.name])),
		databaseNameById: new Map(databases.map((db) => [db.id, db.name]))
	};

	const jobs = jobQueueQueries.listScheduled();

	const jobsWithRuns = jobs.map((job) => {
		const lastRun = jobRunHistoryQueries.getByQueueId(job.id, 1)[0] || null;
		const displayName = buildJobDisplayName(job.jobType, job.payload, lookups);

		return {
			id: job.id,
			name: job.jobType,
			displayName,
			description: job.dedupeKey || 'Scheduled job',
			enabled: job.status !== 'cancelled',
			status: job.status,
			last_run_at: lastRun?.startedAt ?? null,
			next_run_at: job.runAt,
			last_run_status: lastRun?.status ?? null,
			last_run_duration: lastRun?.durationMs ?? null,
			last_run_error: lastRun?.error ?? null
		};
	});

	const recentRuns = jobRunHistoryQueries.getRecent(50);
	const queueIds = Array.from(
		new Set(
			recentRuns.map((run) => run.queueId).filter((id): id is number => typeof id === 'number')
		)
	);
	const queueById = new Map<number, JobQueueRecord>();
	for (const queueId of queueIds) {
		const queue = jobQueueQueries.getById(queueId);
		if (queue) queueById.set(queueId, queue);
	}

	const jobRunsWithNames = recentRuns.map((run) => ({
		...run,
		jobName: run.jobType,
		displayName: buildJobDisplayName(
			run.jobType,
			queueById.get(run.queueId ?? -1)?.payload ?? {},
			lookups
		)
	}));

	return {
		jobs: jobsWithRuns,
		jobRuns: jobRunsWithNames
	};
};

export const actions: Actions = {};
