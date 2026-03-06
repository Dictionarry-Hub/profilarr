import { jobQueueQueries } from '$db/queries/jobQueue.ts';
import type { JobQueueRecord, JobType } from './queueTypes.ts';

function readId(raw: unknown): number | null {
	if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
	if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) {
		return Number(raw);
	}
	return null;
}

function matchesPayloadId(
	job: JobQueueRecord,
	key: 'instanceId' | 'databaseId',
	id: number
): boolean {
	const value = job.payload?.[key];
	return readId(value) === id;
}

export function cleanupJobsForArrInstance(instanceId: number): number {
	const jobTypes: JobType[] = [
		'arr.upgrade',
		'arr.rename',
		'arr.sync',
		'arr.sync.qualityProfiles',
		'arr.sync.delayProfiles',
		'arr.sync.mediaManagement',
		'arr.cleanup',
		'arr.library.refresh'
	];

	const jobs = jobQueueQueries.listByJobTypes(jobTypes);
	const ids = jobs
		.filter((job) => matchesPayloadId(job, 'instanceId', instanceId))
		.map((job) => job.id);
	return jobQueueQueries.deleteByIds(ids);
}

export function cleanupJobsForDatabase(databaseId: number): number {
	const jobs = jobQueueQueries.listByJobTypes(['pcd.sync']);
	const ids = jobs
		.filter((job) => matchesPayloadId(job, 'databaseId', databaseId))
		.map((job) => job.id);
	return jobQueueQueries.deleteByIds(ids);
}
