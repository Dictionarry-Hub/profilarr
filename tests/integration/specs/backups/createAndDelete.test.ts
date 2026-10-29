/**
 * Integration tests for POST /api/v1/backups and DELETE /api/v1/backups/{filename}
 *
 * Verifies backup creation (async via job), deletion, auth, and validation.
 */

import { execFile } from 'node:child_process';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';
import { startServer, stopServer, getDbPath } from '#integration/harness/server.ts';
import { TestClient } from '#integration/harness/client.ts';
import { createUser, login, setApiKey } from '#integration/harness/setup.ts';

const execFileAsync = promisify(execFile);

const PORT = PORTS.backups.createAndDelete;
const ORIGIN = `http://localhost:${PORT}`;
const API_KEY = 'test-api-key-backups-crud-123';
const BACKUPS_DIR = `./dist/integration-${PORT}/backups`;

let client: TestClient;
let unauthClient: TestClient;
let apiKeyClient: TestClient;

/** Create a dummy backup file for delete tests. */
async function createDummyBackup(filename: string): Promise<void> {
	const tmpDir = await mkdtemp(join(tmpdir(), 'profilarr-'));
	await writeFile(`${tmpDir}/data.txt`, 'dummy');

	await execFileAsync('tar', ['-czf', `${BACKUPS_DIR}/${filename}`, '-C', tmpDir, 'data.txt']);
	await rm(tmpDir, { recursive: true, force: true });
}

/** Check if a file exists. */
async function fileExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
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

// ─── Create: Auth ────────────────────────────────────────────────────────────

test('POST /api/v1/backups with session returns 202 with jobId', async () => {
	const res = await client.post('/api/v1/backups', {});
	expect(res.status).toStrictEqual(202);

	const body = await res.json();
	expect(body.jobId).not.toBeOneOf([null, undefined]);
	expect(typeof body.jobId).toStrictEqual('number');
});

test('POST /api/v1/backups with API key returns 202', async () => {
	const res = await apiKeyClient.post(
		'/api/v1/backups',
		{},
		{
			headers: { 'X-Api-Key': API_KEY }
		}
	);
	expect(res.status).toStrictEqual(202);

	const body = await res.json();
	expect(body.jobId).not.toBeOneOf([null, undefined]);
});

test('POST /api/v1/backups without auth returns 401', async () => {
	const res = await unauthClient.post('/api/v1/backups', {});
	expect(res.status).toStrictEqual(401);
});

// ─── Create: Job integration ─────────────────────────────────────────────────

test('returned jobId is fetchable via GET /api/v1/jobs/{jobId}', async () => {
	const createRes = await client.post('/api/v1/backups', {});
	const { jobId } = await createRes.json();

	const jobRes = await client.get(`/api/v1/jobs/${jobId}`);
	expect(jobRes.status).toStrictEqual(200);

	const job = await jobRes.json();
	expect(job.id).toStrictEqual(jobId);
	expect(job.jobType).toStrictEqual('backup.create');
});

// ─── Delete: Auth ────────────────────────────────────────────────────────────

test('DELETE /api/v1/backups/{filename} with session returns 200 for existing file', async () => {
	await createDummyBackup('backup-delete-session-test.tar.gz');

	const res = await client.delete('/api/v1/backups/backup-delete-session-test.tar.gz');
	expect(res.status).toStrictEqual(200);

	const body = await res.json();
	expect(body.success).toStrictEqual(true);
});

test('DELETE /api/v1/backups/{filename} with API key returns 200', async () => {
	await createDummyBackup('backup-delete-apikey-test.tar.gz');

	const res = await apiKeyClient.delete('/api/v1/backups/backup-delete-apikey-test.tar.gz', {
		headers: { 'X-Api-Key': API_KEY }
	});
	expect(res.status).toStrictEqual(200);
});

test('DELETE /api/v1/backups/{filename} without auth returns 401', async () => {
	const res = await unauthClient.delete('/api/v1/backups/backup-delete-unauth-test.tar.gz');
	expect(res.status).toStrictEqual(401);
});

// ─── Delete: Errors ──────────────────────────────────────────────────────────

test('DELETE /api/v1/backups/{filename} returns 404 for non-existent file', async () => {
	const res = await client.delete('/api/v1/backups/backup-does-not-exist.tar.gz');
	expect(res.status).toStrictEqual(404);
});

test('DELETE /api/v1/backups/{filename} returns 400 for invalid filename', async () => {
	const res = await client.delete('/api/v1/backups/notabackup.tar.gz');
	expect(res.status).toStrictEqual(400);
});

test('DELETE /api/v1/backups/{filename} returns 400 for path traversal', async () => {
	const res = await client.delete('/api/v1/backups/backup-..%2F..%2Fetc%2Fpasswd.tar.gz');
	expect(res.status).toStrictEqual(400);
});

// ─── Delete: Behavior ────────────────────────────────────────────────────────

test('file is actually deleted after successful DELETE', async () => {
	await createDummyBackup('backup-verify-deleted.tar.gz');
	expect(await fileExists(`${BACKUPS_DIR}/backup-verify-deleted.tar.gz`)).toStrictEqual(true);

	const res = await client.delete('/api/v1/backups/backup-verify-deleted.tar.gz');
	expect(res.status).toStrictEqual(200);

	expect(await fileExists(`${BACKUPS_DIR}/backup-verify-deleted.tar.gz`)).toStrictEqual(false);
});
