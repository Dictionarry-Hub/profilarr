import { jobQueueQueries, type CreateJobQueueInput } from '#db/queries/jobQueue.ts';
import type { JobQueueRecord } from './queueTypes.ts';
import { jobDispatcher } from './dispatcher.ts';

export function enqueueJob(input: CreateJobQueueInput): JobQueueRecord {
	const id = jobQueueQueries.create(input);
	const record = jobQueueQueries.getById(id);
	if (!record) {
		throw new Error('Failed to enqueue job');
	}
	jobDispatcher.notifyJobEnqueued(record.runAt);
	return record;
}

export function upsertScheduledJob(input: CreateJobQueueInput): JobQueueRecord {
	const record = jobQueueQueries.upsertScheduled(input);
	jobDispatcher.notifyJobEnqueued(record.runAt);
	return record;
}
