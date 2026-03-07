import { db } from '../db.ts';
import type { JobQueueRecord, JobSource, JobStatus, JobType } from '$jobs/queueTypes.ts';

interface JobQueueRow {
	id: number;
	job_type: JobType;
	status: JobStatus;
	run_at: string;
	payload: string;
	source: JobSource;
	dedupe_key: string | null;
	cooldown_until: string | null;
	attempts: number;
	started_at: string | null;
	finished_at: string | null;
	created_at: string;
	updated_at: string;
}

function parsePayload(raw: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
		return {};
	} catch {
		return {};
	}
}

function rowToRecord(row: JobQueueRow): JobQueueRecord {
	return {
		id: row.id,
		jobType: row.job_type,
		status: row.status,
		runAt: row.run_at,
		payload: parsePayload(row.payload),
		source: row.source,
		dedupeKey: row.dedupe_key,
		cooldownUntil: row.cooldown_until,
		attempts: row.attempts,
		startedAt: row.started_at,
		finishedAt: row.finished_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export interface CreateJobQueueInput {
	jobType: JobType;
	runAt: string;
	payload?: Record<string, unknown>;
	source?: JobSource;
	dedupeKey?: string | null;
	cooldownUntil?: string | null;
}

export const jobQueueQueries = {
	create(input: CreateJobQueueInput): number {
		const payload = JSON.stringify(input.payload ?? {});
		const source = input.source ?? 'system';
		const dedupeKey = input.dedupeKey ?? null;
		const cooldownUntil = input.cooldownUntil ?? null;

		db.execute(
			`INSERT INTO job_queue (job_type, status, run_at, payload, source, dedupe_key, cooldown_until)
			 VALUES (?, 'queued', ?, ?, ?, ?, ?)`,
			input.jobType,
			input.runAt,
			payload,
			source,
			dedupeKey,
			cooldownUntil
		);

		const result = db.queryFirst<{ id: number }>('SELECT last_insert_rowid() as id');
		return result?.id ?? 0;
	},

	upsertScheduled(input: CreateJobQueueInput): JobQueueRecord {
		if (!input.dedupeKey) {
			throw new Error('dedupeKey is required for scheduled jobs');
		}

		const existing = this.getByDedupeKey(input.dedupeKey);
		if (!existing) {
			const id = this.create({
				...input,
				source: input.source ?? 'schedule'
			});
			const created = this.getById(id);
			if (!created) {
				throw new Error('Failed to create scheduled job');
			}
			return created;
		}

		// Don't override a running job; leave it to finish
		if (existing.status === 'running') {
			return existing;
		}

		const payload = JSON.stringify(input.payload ?? {});
		const source = input.source ?? 'schedule';
		const cooldownUntil = input.cooldownUntil ?? null;

		db.execute(
			`UPDATE job_queue
			 SET run_at = ?, payload = ?, source = ?, cooldown_until = ?, status = 'queued', updated_at = CURRENT_TIMESTAMP
			 WHERE dedupe_key = ?`,
			input.runAt,
			payload,
			source,
			cooldownUntil,
			input.dedupeKey
		);

		return this.getByDedupeKey(input.dedupeKey)!;
	},

	getById(id: number): JobQueueRecord | undefined {
		const row = db.queryFirst<JobQueueRow>('SELECT * FROM job_queue WHERE id = ?', id);
		return row ? rowToRecord(row) : undefined;
	},

	getByDedupeKey(dedupeKey: string): JobQueueRecord | undefined {
		const row = db.queryFirst<JobQueueRow>(
			'SELECT * FROM job_queue WHERE dedupe_key = ?',
			dedupeKey
		);
		return row ? rowToRecord(row) : undefined;
	},

	listRecent(limit: number = 50): JobQueueRecord[] {
		const rows = db.query<JobQueueRow>(
			`SELECT * FROM job_queue ORDER BY run_at DESC LIMIT ?`,
			limit
		);
		return rows.map(rowToRecord);
	},

	listQueued(limit: number = 50): JobQueueRecord[] {
		const rows = db.query<JobQueueRow>(
			`SELECT * FROM job_queue WHERE status = 'queued' ORDER BY run_at ASC LIMIT ?`,
			limit
		);
		return rows.map(rowToRecord);
	},

	listScheduled(): JobQueueRecord[] {
		const rows = db.query<JobQueueRow>(
			`SELECT * FROM job_queue WHERE dedupe_key IS NOT NULL AND source = 'schedule' ORDER BY job_type`
		);
		return rows.map(rowToRecord);
	},

	listByJobTypes(jobTypes: JobType[]): JobQueueRecord[] {
		if (jobTypes.length === 0) return [];
		const placeholders = jobTypes.map(() => '?').join(', ');
		const rows = db.query<JobQueueRow>(
			`SELECT * FROM job_queue WHERE job_type IN (${placeholders})`,
			...jobTypes
		);
		return rows.map(rowToRecord);
	},

	getNextQueued(): JobQueueRecord | undefined {
		const row = db.queryFirst<JobQueueRow>(
			`SELECT * FROM job_queue WHERE status = 'queued' ORDER BY run_at ASC LIMIT 1`
		);
		return row ? rowToRecord(row) : undefined;
	},

	getOldestQueuedRunAt(): string | null {
		const row = db.queryFirst<{ run_at: string }>(
			`SELECT run_at FROM job_queue WHERE status = 'queued' ORDER BY run_at ASC LIMIT 1`
		);
		return row?.run_at ?? null;
	},

	getNextDueQueued(): JobQueueRecord | undefined {
		const row = db.queryFirst<JobQueueRow>(
			`SELECT * FROM job_queue
			 WHERE status = 'queued'
			 AND datetime(replace(replace(run_at, 'T', ' '), 'Z', '')) <= datetime('now')
			 ORDER BY run_at ASC
			 LIMIT 1`
		);
		return row ? rowToRecord(row) : undefined;
	},

	claimNextDue(): JobQueueRecord | undefined {
		const next = this.getNextDueQueued();
		if (!next) return undefined;

		const updated = db.execute(
			`UPDATE job_queue
			 SET status = 'running', started_at = CURRENT_TIMESTAMP, attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
			 WHERE id = ? AND status = 'queued'`,
			next.id
		);

		if (updated === 0) return undefined;
		return this.getById(next.id);
	},

	reschedule(id: number, runAt: string, cooldownUntil?: string | null): void {
		db.execute(
			`UPDATE job_queue
			 SET status = 'queued', run_at = ?, cooldown_until = ?, started_at = NULL, finished_at = NULL, updated_at = CURRENT_TIMESTAMP
			 WHERE id = ?`,
			runAt,
			cooldownUntil ?? null,
			id
		);
	},

	markFinished(id: number, status: JobStatus): void {
		db.execute(
			`UPDATE job_queue
			 SET status = ?, finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
			 WHERE id = ?`,
			status,
			id
		);
	},

	setRunNow(id: number): void {
		db.execute(
			`UPDATE job_queue
			 SET run_at = ?, status = 'queued', updated_at = CURRENT_TIMESTAMP
			 WHERE id = ?`,
			new Date().toISOString(),
			id
		);
	},

	setStatus(id: number, status: JobStatus): void {
		db.execute(
			`UPDATE job_queue SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
			status,
			id
		);
	},

	cancelByDedupeKey(dedupeKey: string): void {
		db.execute(
			`UPDATE job_queue SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE dedupe_key = ?`,
			dedupeKey
		);
	},

	deleteByIds(ids: number[]): number {
		if (ids.length === 0) return 0;
		const placeholders = ids.map(() => '?').join(', ');
		return db.execute(`DELETE FROM job_queue WHERE id IN (${placeholders})`, ...ids); // nosemgrep: profilarr.sql.template-literal-interpolation — placeholders is just '?,?,?'
	},

	unscheduleByDedupeKey(dedupeKey: string): void {
		db.execute(
			`UPDATE job_queue
			 SET status = CASE WHEN status = 'running' THEN status ELSE 'cancelled' END,
			     dedupe_key = NULL,
			     source = 'system',
			     updated_at = CURRENT_TIMESTAMP
			 WHERE dedupe_key = ?`,
			dedupeKey
		);
	},

	recoverRunning(): number {
		return db.execute(
			`UPDATE job_queue
			 SET status = 'queued', started_at = NULL, updated_at = CURRENT_TIMESTAMP
			 WHERE status = 'running'`
		);
	}
};
