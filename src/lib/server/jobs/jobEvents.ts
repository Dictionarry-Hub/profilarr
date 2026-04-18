/**
 * Job event emitter singleton.
 *
 * The dispatcher emits events here; SSE streams subscribe to fan them
 * out to connected browser clients. Only job types with entries in
 * JOB_RUNNING_LABELS are emitted; other types are silently ignored.
 */

import type { JobType, JobRunStatus } from './queueTypes.ts';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface JobStartedEvent {
	type: 'job.started';
	jobId: number;
	jobType: JobType;
	displayLabel: string;
}

export interface JobFinishedEvent {
	type: 'job.finished';
	jobId: number;
	jobType: JobType;
	displayLabel: string;
	status: JobRunStatus;
	durationMs: number;
}

export type JobEvent = JobStartedEvent | JobFinishedEvent;

type JobEventCallback = (event: JobEvent) => void;

// ─── Display Labels ──────────────────────────────────────────────────────────

const JOB_RUNNING_LABELS: Partial<Record<JobType, string>> = {
	'arr.sync': 'Syncing...',
	'arr.sync.qualityProfiles': 'Syncing Quality Profiles...',
	'arr.sync.delayProfiles': 'Syncing Delay Profiles...',
	'arr.sync.mediaManagement': 'Syncing Media Management...',
	'backup.create': 'Creating backup...',
	'backup.cleanup': 'Cleaning up backups...'
};

const JOB_COMPLETED_LABELS: Partial<Record<JobType, string>> = {
	'arr.sync': 'Sync',
	'arr.sync.qualityProfiles': 'Quality Profiles sync',
	'arr.sync.delayProfiles': 'Delay Profiles sync',
	'arr.sync.mediaManagement': 'Media Management sync',
	'backup.create': 'Backup',
	'backup.cleanup': 'Backup cleanup'
};

const EMITTED_JOB_TYPES = new Set(Object.keys(JOB_RUNNING_LABELS));

export function getJobRunningLabel(jobType: JobType): string {
	return JOB_RUNNING_LABELS[jobType] ?? jobType;
}

export function getJobCompletedLabel(jobType: JobType): string {
	return JOB_COMPLETED_LABELS[jobType] ?? jobType;
}

// ─── Emitter ─────────────────────────────────────────────────────────────────

const subscribers = new Set<JobEventCallback>();

/**
 * Subscribe to job events. Returns an unsubscribe function.
 */
export function subscribe(callback: JobEventCallback): () => void {
	subscribers.add(callback);
	return () => subscribers.delete(callback);
}

/**
 * Emit a job event to all subscribers.
 * Silently ignores job types without a display label.
 */
export function emit(event: JobEvent): void {
	if (!EMITTED_JOB_TYPES.has(event.jobType)) return;

	for (const callback of subscribers) {
		try {
			callback(event);
		} catch {
			// Don't let a broken subscriber kill the dispatcher
		}
	}
}

export const jobEvents = { subscribe, emit };
