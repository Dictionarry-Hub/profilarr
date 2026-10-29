/**
 * Integration tests for GET /api/v1/jobs/{id}
 *
 * Verifies job status retrieval, auth enforcement, and result enrichment
 * from job_run_history.
 */

import { afterAll, beforeAll, expect, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';
import { startServer, stopServer, getDbPath } from '#integration/harness/server.ts';
import { TestClient } from '#integration/harness/client.ts';
import { createUser, login, setApiKey, queryDb } from '#integration/harness/setup.ts';
import { openDb } from '#integration/harness/db.ts';

const PORT = PORTS.backups.jobStatus;
const ORIGIN = `http://localhost:${PORT}`;
const API_KEY = 'test-api-key-jobs-123';

let client: TestClient;
let unauthClient: TestClient;
let apiKeyClient: TestClient;

/** Insert a job_queue row directly and return its id. */
function insertJob(
	dbPath: string,
	opts: {
		jobType: string;
		status: string;
		source?: string;
		startedAt?: string | null;
		finishedAt?: string | null;
	}
): number {
	const db = openDb(dbPath);
	try {
		db.exec(
			`INSERT INTO job_queue (job_type, status, run_at, payload, source, started_at, finished_at)
			 VALUES (?, ?, datetime('now'), '{}', ?, ?, ?)`,
			[
				opts.jobType,
				opts.status,
				opts.source ?? 'manual',
				opts.startedAt ?? null,
				opts.finishedAt ?? null
			]
		);
		const row = db.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
		return row.id;
	} finally {
		db.close();
	}
}

/** Insert a job_run_history row directly. */
function insertRunHistory(
	dbPath: string,
	opts: {
		queueId: number;
		jobType: string;
		status: string;
		durationMs: number;
		output?: string | null;
		error?: string | null;
	}
): void {
	const db = openDb(dbPath);
	try {
		db.exec(
			`INSERT INTO job_run_history (queue_id, job_type, status, started_at, finished_at, duration_ms, output, error)
			 VALUES (?, ?, ?, datetime('now', '-5 seconds'), datetime('now'), ?, ?, ?)`,
			[
				opts.queueId,
				opts.jobType,
				opts.status,
				opts.durationMs,
				opts.output ?? null,
				opts.error ?? null
			]
		);
	} finally {
		db.close();
	}
}

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');

	client = new TestClient(ORIGIN);
	unauthClient = new TestClient(ORIGIN);
	apiKeyClient = new TestClient(ORIGIN);

	await createUser(client, 'admin', 'password123', ORIGIN);
	await login(client, 'admin', 'password123', ORIGIN);
	await setApiKey(getDbPath(PORT), API_KEY);
});

afterAll(async () => {
	await stopServer(PORT);
});

// ─── Auth ────────────────────────────────────────────────────────────────────

test('GET /api/v1/jobs/{id} with session returns 200', async () => {
	const jobId = insertJob(getDbPath(PORT), {
		jobType: 'backup.create',
		status: 'queued'
	});

	const res = await client.get(`/api/v1/jobs/${jobId}`);
	expect(res.status).toStrictEqual(200);

	const body = await res.json();
	expect(body.id).toStrictEqual(jobId);
	expect(body.jobType).toStrictEqual('backup.create');
	expect(body.status).toStrictEqual('queued');
});

test('GET /api/v1/jobs/{id} with API key returns 200', async () => {
	const jobId = insertJob(getDbPath(PORT), {
		jobType: 'backup.create',
		status: 'queued'
	});

	const res = await apiKeyClient.get(`/api/v1/jobs/${jobId}`, {
		headers: { 'X-Api-Key': API_KEY }
	});
	expect(res.status).toStrictEqual(200);

	const body = await res.json();
	expect(body.id).toStrictEqual(jobId);
});

test('GET /api/v1/jobs/{id} without auth returns 401', async () => {
	const jobId = insertJob(getDbPath(PORT), {
		jobType: 'backup.create',
		status: 'queued'
	});

	const res = await unauthClient.get(`/api/v1/jobs/${jobId}`);
	expect(res.status).toStrictEqual(401);
});

// ─── Not found / bad input ───────────────────────────────────────────────────

test('GET /api/v1/jobs/{id} with non-existent ID returns 404', async () => {
	const res = await client.get('/api/v1/jobs/999999');
	expect(res.status).toStrictEqual(404);

	const body = await res.json();
	expect(body.error).toStrictEqual('Job not found');
});

test('GET /api/v1/jobs/{id} with non-numeric ID returns 400', async () => {
	const res = await client.get('/api/v1/jobs/abc');
	expect(res.status).toStrictEqual(400);

	const body = await res.json();
	expect(body.error).toStrictEqual('Invalid job ID');
});

// ─── Result enrichment ───────────────────────────────────────────────────────

test('completed job includes result from run history', async () => {
	const jobId = insertJob(getDbPath(PORT), {
		jobType: 'backup.create',
		status: 'success',
		source: 'manual',
		startedAt: new Date().toISOString(),
		finishedAt: new Date().toISOString()
	});

	insertRunHistory(getDbPath(PORT), {
		queueId: jobId,
		jobType: 'backup.create',
		status: 'success',
		durationMs: 4500,
		output: 'Backup created: backup-2026-03-15-100005.tar.gz (12.34 MB)'
	});

	const res = await client.get(`/api/v1/jobs/${jobId}`);
	expect(res.status).toStrictEqual(200);

	const body = await res.json();
	expect(body.status).toStrictEqual('success');
	expect(body.result.status).toStrictEqual('success');
	expect(body.result.durationMs).toStrictEqual(4500);
	expect(body.result.output).toStrictEqual(
		'Backup created: backup-2026-03-15-100005.tar.gz (12.34 MB)'
	);
	expect(body.result.error).toStrictEqual(null);
});

test('queued job has result: null', async () => {
	const jobId = insertJob(getDbPath(PORT), {
		jobType: 'backup.cleanup',
		status: 'queued'
	});

	const res = await client.get(`/api/v1/jobs/${jobId}`);
	expect(res.status).toStrictEqual(200);

	const body = await res.json();
	expect(body.status).toStrictEqual('queued');
	expect(body.result).toStrictEqual(null);
});
