/**
 * Integration tests for GET /api/v1/jobs/{id}
 *
 * Verifies job status retrieval, auth enforcement, and result enrichment
 * from job_run_history.
 */

import { assertEquals } from '@std/assert';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { TestClient } from '$test-harness/client.ts';
import { createUser, login, setApiKey, queryDb } from '$test-harness/setup.ts';
import { Database } from 'jsr:@db/sqlite@0.12';

const PORT = 7030;
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
	const db = new Database(dbPath);
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
	const db = new Database(dbPath);
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

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');

	client = new TestClient(ORIGIN);
	unauthClient = new TestClient(ORIGIN);
	apiKeyClient = new TestClient(ORIGIN);

	await createUser(client, 'admin', 'password123', ORIGIN);
	await login(client, 'admin', 'password123', ORIGIN);
	await setApiKey(getDbPath(PORT), API_KEY);
});

teardown(async () => {
	await stopServer(PORT);
});

// ─── Auth ────────────────────────────────────────────────────────────────────

test('GET /api/v1/jobs/{id} with session returns 200', async () => {
	const jobId = insertJob(getDbPath(PORT), {
		jobType: 'backup.create',
		status: 'queued'
	});

	const res = await client.get(`/api/v1/jobs/${jobId}`);
	assertEquals(res.status, 200);

	const body = await res.json();
	assertEquals(body.id, jobId);
	assertEquals(body.jobType, 'backup.create');
	assertEquals(body.status, 'queued');
});

test('GET /api/v1/jobs/{id} with API key returns 200', async () => {
	const jobId = insertJob(getDbPath(PORT), {
		jobType: 'backup.create',
		status: 'queued'
	});

	const res = await apiKeyClient.get(`/api/v1/jobs/${jobId}`, {
		headers: { 'X-Api-Key': API_KEY }
	});
	assertEquals(res.status, 200);

	const body = await res.json();
	assertEquals(body.id, jobId);
});

test('GET /api/v1/jobs/{id} without auth returns 401', async () => {
	const jobId = insertJob(getDbPath(PORT), {
		jobType: 'backup.create',
		status: 'queued'
	});

	const res = await unauthClient.get(`/api/v1/jobs/${jobId}`);
	assertEquals(res.status, 401);
});

// ─── Not found / bad input ───────────────────────────────────────────────────

test('GET /api/v1/jobs/{id} with non-existent ID returns 404', async () => {
	const res = await client.get('/api/v1/jobs/999999');
	assertEquals(res.status, 404);

	const body = await res.json();
	assertEquals(body.error, 'Job not found');
});

test('GET /api/v1/jobs/{id} with non-numeric ID returns 400', async () => {
	const res = await client.get('/api/v1/jobs/abc');
	assertEquals(res.status, 400);

	const body = await res.json();
	assertEquals(body.error, 'Invalid job ID');
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
	assertEquals(res.status, 200);

	const body = await res.json();
	assertEquals(body.status, 'success');
	assertEquals(body.result.status, 'success');
	assertEquals(body.result.durationMs, 4500);
	assertEquals(body.result.output, 'Backup created: backup-2026-03-15-100005.tar.gz (12.34 MB)');
	assertEquals(body.result.error, null);
});

test('queued job has result: null', async () => {
	const jobId = insertJob(getDbPath(PORT), {
		jobType: 'backup.cleanup',
		status: 'queued'
	});

	const res = await client.get(`/api/v1/jobs/${jobId}`);
	assertEquals(res.status, 200);

	const body = await res.json();
	assertEquals(body.status, 'queued');
	assertEquals(body.result, null);
});

await run();
