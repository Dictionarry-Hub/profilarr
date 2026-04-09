/**
 * Integration tests for POST /api/v1/backups and DELETE /api/v1/backups/{filename}
 *
 * Verifies backup creation (async via job), deletion, auth, and validation.
 */

import { assertEquals, assertExists } from '@std/assert';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { TestClient } from '$test-harness/client.ts';
import { createUser, login, setApiKey } from '$test-harness/setup.ts';

const PORT = 7032;
const ORIGIN = `http://localhost:${PORT}`;
const API_KEY = 'test-api-key-backups-crud-123';
const BACKUPS_DIR = `./dist/integration-${PORT}/backups`;

let client: TestClient;
let unauthClient: TestClient;
let apiKeyClient: TestClient;

/** Create a dummy backup file for delete tests. */
async function createDummyBackup(filename: string): Promise<void> {
	const tmpDir = await Deno.makeTempDir();
	await Deno.writeTextFile(`${tmpDir}/data.txt`, 'dummy');

	const cmd = new Deno.Command('tar', {
		args: ['-czf', `${BACKUPS_DIR}/${filename}`, '-C', tmpDir, 'data.txt'],
		stdout: 'null',
		stderr: 'null'
	});
	await cmd.output();
	await Deno.remove(tmpDir, { recursive: true });
}

/** Check if a file exists. */
async function fileExists(path: string): Promise<boolean> {
	try {
		await Deno.stat(path);
		return true;
	} catch {
		return false;
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

// ─── Create: Auth ────────────────────────────────────────────────────────────

test('POST /api/v1/backups with session returns 202 with jobId', async () => {
	const res = await client.post('/api/v1/backups', {});
	assertEquals(res.status, 202);

	const body = await res.json();
	assertExists(body.jobId);
	assertEquals(typeof body.jobId, 'number');
});

test('POST /api/v1/backups with API key returns 202', async () => {
	const res = await apiKeyClient.post(
		'/api/v1/backups',
		{},
		{
			headers: { 'X-Api-Key': API_KEY }
		}
	);
	assertEquals(res.status, 202);

	const body = await res.json();
	assertExists(body.jobId);
});

test('POST /api/v1/backups without auth returns 401', async () => {
	const res = await unauthClient.post('/api/v1/backups', {});
	assertEquals(res.status, 401);
});

// ─── Create: Job integration ─────────────────────────────────────────────────

test('returned jobId is fetchable via GET /api/v1/jobs/{jobId}', async () => {
	const createRes = await client.post('/api/v1/backups', {});
	const { jobId } = await createRes.json();

	const jobRes = await client.get(`/api/v1/jobs/${jobId}`);
	assertEquals(jobRes.status, 200);

	const job = await jobRes.json();
	assertEquals(job.id, jobId);
	assertEquals(job.jobType, 'backup.create');
});

// ─── Delete: Auth ────────────────────────────────────────────────────────────

test('DELETE /api/v1/backups/{filename} with session returns 200 for existing file', async () => {
	await createDummyBackup('backup-delete-session-test.tar.gz');

	const res = await client.delete('/api/v1/backups/backup-delete-session-test.tar.gz');
	assertEquals(res.status, 200);

	const body = await res.json();
	assertEquals(body.success, true);
});

test('DELETE /api/v1/backups/{filename} with API key returns 200', async () => {
	await createDummyBackup('backup-delete-apikey-test.tar.gz');

	const res = await apiKeyClient.delete('/api/v1/backups/backup-delete-apikey-test.tar.gz', {
		headers: { 'X-Api-Key': API_KEY }
	});
	assertEquals(res.status, 200);
});

test('DELETE /api/v1/backups/{filename} without auth returns 401', async () => {
	const res = await unauthClient.delete('/api/v1/backups/backup-delete-unauth-test.tar.gz');
	assertEquals(res.status, 401);
});

// ─── Delete: Errors ──────────────────────────────────────────────────────────

test('DELETE /api/v1/backups/{filename} returns 404 for non-existent file', async () => {
	const res = await client.delete('/api/v1/backups/backup-does-not-exist.tar.gz');
	assertEquals(res.status, 404);
});

test('DELETE /api/v1/backups/{filename} returns 400 for invalid filename', async () => {
	const res = await client.delete('/api/v1/backups/notabackup.tar.gz');
	assertEquals(res.status, 400);
});

test('DELETE /api/v1/backups/{filename} returns 400 for path traversal', async () => {
	const res = await client.delete('/api/v1/backups/backup-..%2F..%2Fetc%2Fpasswd.tar.gz');
	assertEquals(res.status, 400);
});

// ─── Delete: Behavior ────────────────────────────────────────────────────────

test('file is actually deleted after successful DELETE', async () => {
	await createDummyBackup('backup-verify-deleted.tar.gz');
	assertEquals(await fileExists(`${BACKUPS_DIR}/backup-verify-deleted.tar.gz`), true);

	const res = await client.delete('/api/v1/backups/backup-verify-deleted.tar.gz');
	assertEquals(res.status, 200);

	assertEquals(await fileExists(`${BACKUPS_DIR}/backup-verify-deleted.tar.gz`), false);
});

await run();
