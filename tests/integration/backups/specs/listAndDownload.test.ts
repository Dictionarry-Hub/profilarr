/**
 * Integration tests for GET /api/v1/backups and GET /api/v1/backups/{filename}
 *
 * Verifies listing, downloading, auth enforcement, and input validation.
 */

import { assertEquals, assertExists } from '@std/assert';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { TestClient } from '$test-harness/client.ts';
import { createUser, login, setApiKey } from '$test-harness/setup.ts';

const PORT = 7031;
const ORIGIN = `http://localhost:${PORT}`;
const API_KEY = 'test-api-key-backups-list-123';
const BACKUPS_DIR = `./dist/integration-${PORT}/backups`;

let client: TestClient;
let unauthClient: TestClient;
let apiKeyClient: TestClient;

/** Create a dummy backup file for testing. */
async function createDummyBackup(filename: string, content: string = 'dummy'): Promise<void> {
	// Create a real (tiny) tar.gz so download tests get valid gzip content
	const tmpDir = await Deno.makeTempDir();
	await Deno.writeTextFile(`${tmpDir}/data.txt`, content);

	const cmd = new Deno.Command('tar', {
		args: ['-czf', `${BACKUPS_DIR}/${filename}`, '-C', tmpDir, 'data.txt'],
		stdout: 'null',
		stderr: 'null'
	});
	await cmd.output();
	await Deno.remove(tmpDir, { recursive: true });
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

// ─── List: Auth ──────────────────────────────────────────────────────────────

test('GET /api/v1/backups with session returns 200 with array', async () => {
	const res = await client.get('/api/v1/backups');
	assertEquals(res.status, 200);

	const body = await res.json();
	assertEquals(Array.isArray(body), true);
});

test('GET /api/v1/backups with API key returns 200', async () => {
	const res = await apiKeyClient.get('/api/v1/backups', {
		headers: { 'X-Api-Key': API_KEY }
	});
	assertEquals(res.status, 200);
});

test('GET /api/v1/backups without auth returns 401', async () => {
	const res = await unauthClient.get('/api/v1/backups');
	assertEquals(res.status, 401);
});

// ─── List: Behavior ──────────────────────────────────────────────────────────

test('GET /api/v1/backups returns empty array when no backups exist', async () => {
	// Clean out any existing backups
	for await (const entry of Deno.readDir(BACKUPS_DIR)) {
		if (entry.name.endsWith('.tar.gz')) {
			await Deno.remove(`${BACKUPS_DIR}/${entry.name}`);
		}
	}

	const res = await client.get('/api/v1/backups');
	assertEquals(res.status, 200);

	const body = await res.json();
	assertEquals(body.length, 0);
});

test('GET /api/v1/backups returns sorted list with expected fields', async () => {
	// Create two backups with different timestamps
	await createDummyBackup('backup-2025-01-01-000000.tar.gz', 'older');
	// Small delay so mtime differs
	await new Promise((r) => setTimeout(r, 100));
	await createDummyBackup('backup-2025-06-15-120000.tar.gz', 'newer');

	const res = await client.get('/api/v1/backups');
	assertEquals(res.status, 200);

	const body = await res.json();
	assertEquals(body.length >= 2, true);

	// Check fields exist on first item
	const first = body[0];
	assertExists(first.filename);
	assertExists(first.created);
	assertExists(first.size);
	assertExists(first.sizeFormatted);

	// Sorted newest first (by mtime, so the second file we created should be first)
	const idx1 = body.findIndex(
		(b: { filename: string }) => b.filename === 'backup-2025-06-15-120000.tar.gz'
	);
	const idx2 = body.findIndex(
		(b: { filename: string }) => b.filename === 'backup-2025-01-01-000000.tar.gz'
	);
	assertEquals(idx1 < idx2, true, 'newer backup should appear first');
});

// ─── Download: Success ───────────────────────────────────────────────────────

test('GET /api/v1/backups/{filename} returns 200 with binary content', async () => {
	await createDummyBackup('backup-download-test.tar.gz', 'download content');

	const res = await client.get('/api/v1/backups/backup-download-test.tar.gz');
	assertEquals(res.status, 200);

	const contentType = res.headers.get('content-type');
	assertEquals(contentType, 'application/gzip');
});

test('GET /api/v1/backups/{filename} returns Content-Disposition header', async () => {
	await createDummyBackup('backup-disposition-test.tar.gz');

	const res = await client.get('/api/v1/backups/backup-disposition-test.tar.gz');
	assertEquals(res.status, 200);

	const disposition = res.headers.get('content-disposition');
	assertEquals(disposition, 'attachment; filename="backup-disposition-test.tar.gz"');
});

// ─── Download: Errors ────────────────────────────────────────────────────────

test('GET /api/v1/backups/{filename} returns 404 for non-existent file', async () => {
	const res = await client.get('/api/v1/backups/backup-does-not-exist.tar.gz');
	assertEquals(res.status, 404);
});

test('GET /api/v1/backups/{filename} returns 400 for invalid filename', async () => {
	const res = await client.get('/api/v1/backups/notabackup.tar.gz');
	assertEquals(res.status, 400);
});

test('GET /api/v1/backups/{filename} returns 400 for path traversal', async () => {
	// The filename itself contains traversal — should be caught by validation
	const res = await client.get('/api/v1/backups/backup-..%2F..%2Fetc%2Fpasswd.tar.gz');
	assertEquals(res.status, 400);
});

await run();
