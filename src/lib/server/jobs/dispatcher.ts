import { jobQueueQueries } from '$db/queries/jobQueue.ts';
import { jobRunHistoryQueries } from '$db/queries/jobRunHistory.ts';
import { buildJobDisplayName } from './display.ts';
import { jobQueueRegistry } from './queueRegistry.ts';
import type { JobHandlerResult, JobQueueRecord, JobStatus } from './queueTypes.ts';
import { logger } from '$logger/logger.ts';
import { jobEvents, getJobRunningLabel, getJobCompletedLabel } from './jobEvents.ts';
import './handlers/index.ts';

class JobDispatcher {
	private timerId: number | null = null;
	private nextWakeAt: number | null = null;
	private running = false;

	start(): void {
		this.scheduleNextWake();
	}

	stop(): void {
		if (this.timerId !== null) {
			clearTimeout(this.timerId);
			this.timerId = null;
		}
		this.nextWakeAt = null;
	}

	notifyJobEnqueued(runAt: string): void {
		const runAtMs = new Date(runAt).getTime();
		if (this.nextWakeAt === null || runAtMs < this.nextWakeAt) {
			this.scheduleNextWake();
		}
	}

	private scheduleNextWake(): void {
		const next = jobQueueQueries.getNextQueued();
		if (!next) {
			this.stop();
			return;
		}

		const runAtMs = new Date(next.runAt).getTime();
		const delay = Math.max(0, runAtMs - Date.now());
		this.nextWakeAt = runAtMs;

		if (this.timerId !== null) {
			clearTimeout(this.timerId);
		}

		this.timerId = setTimeout(() => {
			void this.runDueJobs();
		}, delay) as unknown as number;
	}

	private async runDueJobs(): Promise<void> {
		if (this.running) return;
		this.running = true;

		try {
			while (true) {
				const job = jobQueueQueries.claimNextDue();
				if (!job) break;
				await this.executeJob(job);
			}
		} finally {
			this.running = false;
			this.scheduleNextWake();
		}
	}

	private async executeJob(job: JobQueueRecord): Promise<void> {
		const displayName = buildJobDisplayName(job.jobType, job.payload);

		const handler = jobQueueRegistry.get(job.jobType);
		if (!handler) {
			await logger.error(`Job handler not found for ${job.jobType}`, {
				source: 'JobDispatcher',
				meta: { jobId: job.id, jobType: job.jobType, displayName }
			});
			jobQueueQueries.markFinished(job.id, 'failed');
			jobRunHistoryQueries.create(
				job.id,
				job.jobType,
				'failure',
				job.startedAt ?? new Date().toISOString(),
				new Date().toISOString(),
				0,
				'Handler not found'
			);
			return;
		}

		const startedAt = job.startedAt ?? new Date().toISOString();
		const startMs = Date.now();

		await logger.debug(`Job started: ${job.jobType}`, {
			source: 'JobDispatcher',
			meta: {
				jobId: job.id,
				jobType: job.jobType,
				displayName,
				sourceType: job.source,
				runAt: job.runAt
			}
		});

		jobEvents.emit({
			type: 'job.started',
			jobId: job.id,
			jobType: job.jobType,
			displayLabel: getJobRunningLabel(job.jobType)
		});

		let result: JobHandlerResult;
		try {
			result = await handler(job);
		} catch (error) {
			result = {
				status: 'failure',
				error: error instanceof Error ? error.message : String(error)
			};
		}

		const finishedAt = new Date().toISOString();
		const durationMs = Date.now() - startMs;

		jobRunHistoryQueries.create(
			job.id,
			job.jobType,
			result.status,
			startedAt,
			finishedAt,
			durationMs,
			result.error,
			result.output
		);

		jobEvents.emit({
			type: 'job.finished',
			jobId: job.id,
			jobType: job.jobType,
			displayLabel: getJobCompletedLabel(job.jobType),
			status: result.status,
			durationMs
		});

		await logger.debug(`Job finished: ${job.jobType} (${result.status})`, {
			source: 'JobDispatcher',
			meta: {
				jobId: job.id,
				jobType: job.jobType,
				displayName,
				status: result.status,
				durationMs,
				rescheduleAt: result.rescheduleAt ?? null,
				error: result.error ?? null
			}
		});

		if (result.rescheduleAt) {
			jobQueueQueries.reschedule(job.id, result.rescheduleAt, job.cooldownUntil);
			return;
		}

		const status: JobStatus =
			result.status === 'success'
				? 'success'
				: result.status === 'skipped'
					? 'success'
					: result.status === 'cancelled'
						? 'cancelled'
						: 'failed';

		jobQueueQueries.markFinished(job.id, status);
	}
}

export const jobDispatcher = new JobDispatcher();
