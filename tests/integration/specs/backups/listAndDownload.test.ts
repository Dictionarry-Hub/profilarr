/**
 * Integration tests for GET /api/v1/backups and GET /api/v1/backups/{filename}
 *
 * Verifies listing, downloading, auth enforcement, and input validation.
 */

import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';
import { startServer, stopServer, getDbPath } from '#integration/harness/server.ts';
import { TestClient } from '#integration/harness/client.ts';
import { createUser, login, setApiKey } from '#integration/harness/setup.ts';

const execFileAsync = promisify(execFile);

const PORT = PORTS.backups.listAndDownload;
const ORIGIN = `http://localhost:${PORT}`;
const API_KEY = 'test-api-key-backups-list-123';
const BACKUPS_DIR = `./dist/integration-${PORT}/backups`;

let client: TestClient;
let unauthClient: TestClient;
let apiKeyClient: TestClient;

/**
 * Create a dummy backup file for testing.
 *
 * The download endpoint extracts the archive and re-tars `${tmp}/data` after
 * sanitizing, so dummies must contain a `data/` directory at the archive root
 * for the download path to succeed. The tests below only check status and
 * headers, so we don't need a real DB inside.
 */
async function createDummyBackup(filename: string, content: string = 'dummy'): Promise<void> {
	const tmpDir = await mkdtemp(join(tmpdir(), 'profilarr-'));
	await mkdir(`${tmpDir}/data`);
	await writeFile(`${tmpDir}/data/data.txt`, content);

	await execFileAsync('tar', ['-czf', `${BACKUPS_DIR}/${filename}`, '-C', tmpDir, 'data']);
	await rm(tmpDir, { recursive: true, force: true });
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

// ─── List: Auth ──────────────────────────────────────────────────────────────

test('GET /api/v1/backups with session returns 200 with array', async () => {
	const res = await client.get('/api/v1/backups');
	expect(res.status).toStrictEqual(200);

	const body = await res.json();
	expect(Array.isArray(body)).toStrictEqual(true);
});

test('GET /api/v1/backups with API key returns 200', async () => {
	const res = await apiKeyClient.get('/api/v1/backups', {
		headers: { 'X-Api-Key': API_KEY }
	});
	expect(res.status).toStrictEqual(200);
});

test('GET /api/v1/backups without auth returns 401', async () => {
	const res = await unauthClient.get('/api/v1/backups');
	expect(res.status).toStrictEqual(401);
});

// ─── List: Behavior ──────────────────────────────────────────────────────────

test('GET /api/v1/backups returns empty array when no backups exist', async () => {
	// Clean out any existing backups
	for (const entry of await readdir(BACKUPS_DIR, { withFileTypes: true })) {
		if (entry.name.endsWith('.tar.gz')) {
			await rm(`${BACKUPS_DIR}/${entry.name}`);
		}
	}

	const res = await client.get('/api/v1/backups');
	expect(res.status).toStrictEqual(200);

	const body = await res.json();
	expect(body.length).toStrictEqual(0);
});

test('GET /api/v1/backups returns sorted list with expected fields', async () => {
	// Create two backups with different timestamps
	await createDummyBackup('backup-2025-01-01-000000.tar.gz', 'older');
	// Small delay so mtime differs
	await new Promise((r) => setTimeout(r, 100));
	await createDummyBackup('backup-2025-06-15-120000.tar.gz', 'newer');

	const res = await client.get('/api/v1/backups');
	expect(res.status).toStrictEqual(200);

	const body = await res.json();
	expect(body.length >= 2).toStrictEqual(true);

	// Check fields exist on first item
	const first = body[0];
	expect(first.filename).not.toBeOneOf([null, undefined]);
	expect(first.created).not.toBeOneOf([null, undefined]);
	expect(first.size).not.toBeOneOf([null, undefined]);
	expect(first.sizeFormatted).not.toBeOneOf([null, undefined]);

	// Sorted newest first (by mtime, so the second file we created should be first)
	const idx1 = body.findIndex(
		(b: { filename: string }) => b.filename === 'backup-2025-06-15-120000.tar.gz'
	);
	const idx2 = body.findIndex(
		(b: { filename: string }) => b.filename === 'backup-2025-01-01-000000.tar.gz'
	);
	expect(idx1 < idx2, 'newer backup should appear first').toStrictEqual(true);
});

// ─── Download: Success ───────────────────────────────────────────────────────

test('GET /api/v1/backups/{filename} returns 200 with binary content', async () => {
	await createDummyBackup('backup-download-test.tar.gz', 'download content');

	const res = await client.get('/api/v1/backups/backup-download-test.tar.gz');
	expect(res.status).toStrictEqual(200);

	const contentType = res.headers.get('content-type');
	expect(contentType).toStrictEqual('application/gzip');
});

test('GET /api/v1/backups/{filename} returns Content-Disposition header', async () => {
	await createDummyBackup('backup-disposition-test.tar.gz');

	const res = await client.get('/api/v1/backups/backup-disposition-test.tar.gz');
	expect(res.status).toStrictEqual(200);

	const disposition = res.headers.get('content-disposition');
	expect(disposition).toStrictEqual('attachment; filename="backup-disposition-test.tar.gz"');
});

// ─── Download: Errors ────────────────────────────────────────────────────────

test('GET /api/v1/backups/{filename} returns 404 for non-existent file', async () => {
	const res = await client.get('/api/v1/backups/backup-does-not-exist.tar.gz');
	expect(res.status).toStrictEqual(404);
});

test('GET /api/v1/backups/{filename} returns 400 for invalid filename', async () => {
	const res = await client.get('/api/v1/backups/notabackup.tar.gz');
	expect(res.status).toStrictEqual(400);
});

test('GET /api/v1/backups/{filename} returns 400 for path traversal', async () => {
	// The filename itself contains traversal — should be caught by validation
	const res = await client.get('/api/v1/backups/backup-..%2F..%2Fetc%2Fpasswd.tar.gz');
	expect(res.status).toStrictEqual(400);
});
