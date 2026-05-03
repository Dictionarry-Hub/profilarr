export type JobType =
	| 'arr.upgrade'
	| 'arr.rename'
	| 'arr.sync'
	| 'arr.sync.qualityProfiles'
	| 'arr.sync.delayProfiles'
	| 'arr.sync.mediaManagement'
	| 'pcd.link'
	| 'pcd.sync'
	| 'backup.create'
	| 'backup.cleanup'
	| 'arr.cleanup'
	| 'arr.drift'
	| 'arr.library.refresh'
	| 'logs.cleanup'
	| 'announcements.fetch';

export type JobStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled';

export type JobSource = 'schedule' | 'manual' | 'system';

export type JobRunStatus = 'success' | 'failure' | 'skipped' | 'cancelled';

export interface JobQueueRecord {
	id: number;
	jobType: JobType;
	status: JobStatus;
	runAt: string;
	payload: Record<string, unknown>;
	source: JobSource;
	dedupeKey: string | null;
	cooldownUntil: string | null;
	attempts: number;
	startedAt: string | null;
	finishedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface JobRunHistoryRecord {
	id: number;
	queueId: number | null;
	jobType: JobType;
	status: JobRunStatus;
	startedAt: string;
	finishedAt: string;
	durationMs: number;
	error: string | null;
	output: string | null;
	createdAt: string;
}

export interface JobHandlerResult {
	status: JobRunStatus;
	output?: string;
	error?: string;
	rescheduleAt?: string | null;
}

export interface JobHandlerContext {
	progress: (label: string) => void;
}

export type JobHandler = (
	job: JobQueueRecord,
	ctx?: JobHandlerContext
) => Promise<JobHandlerResult>;
