/**
 * Integration test: Backup restore
 *
 * Verifies that a backup produced by one server can be restored onto a
 * fresh server and that the restored instance is fully functional.
 *
 * Flow:
 *   1. Start server A, seed known data, create backup via API, download it
 *   2. Stop server A
 *   3. Extract the backup into server B's data directory
 *   4. Start server B (AUTH=off so stripped users/sessions don't block access)
 *   5. Verify non-secret data survived the round trip
 *   6. Verify the server can perform writes (not just reads)
 *
 * Tests:
 *   1. Restored server is healthy
 *   2. Arr instances survive restore (name, type, url present; api_key stripped)
 *   3. Backup settings survive restore
 *   4. Restored server can create new backups (writes work)
 */

import { assertEquals, assertExists } from '@std/assert';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { TestClient } from '$test-harness/client.ts';
import { createUser, login, setApiKey } from '$test-harness/setup.ts';
import { Database } from '@db/sqlite';

const PORT_A = 7035;
const PORT_B = 7036;
const ORIGIN_A = `http://localhost:${PORT_A}`;
const ORIGIN_B = `http://localhost:${PORT_B}`;
const API_KEY = 'test-api-key-restore-123';
const BASE_B = `./dist/integration-${PORT_B}`;

let clientB: TestClient;

/**
 * Seed known data into server A's database so we can verify it after restore.
 */
function seedData(dbPath: string) {
	const db = new Database(dbPath);
	try {
		db.exec(
			`INSERT INTO arr_instances (name, type, url, api_key, enabled)
			 VALUES ('Restore Test Sonarr', 'sonarr', 'http://sonarr:8989', 'secret-key-123', 1)`
		);

		db.exec(`UPDATE backup_settings SET schedule = 'weekly', retention_days = 14 WHERE id = 1`);
	} finally {
		db.close();
	}
}

/**
 * Create a backup on server A via the v1 API, poll until complete,
 * download it, and return the raw tar.gz bytes.
 */
async function createAndDownloadBackup(client: TestClient): Promise<Uint8Array> {
	// Trigger
	const createRes = await client.post('/api/v1/backups', {});
	assertEquals(createRes.status, 202, 'Backup creation should return 202');
	const { jobId } = await createRes.json();

	// Poll job until complete
	for (let i = 0; i < 30; i++) {
		await new Promise((r) => setTimeout(r, 1000));
		const jobRes = await client.get(`/api/v1/jobs/${jobId}`);
		const job = await jobRes.json();
		if (job.status === 'success') break;
		if (job.status === 'failure') throw new Error(`Backup job failed: ${job.result?.error}`);
	}

	// Get filename and download
	const listRes = await client.get('/api/v1/backups');
	const backups = await listRes.json();
	if (backups.length === 0) throw new Error('No backup files after job completed');

	const res = await client.get(`/api/v1/backups/${backups[0].filename}`);
	assertEquals(res.status, 200, 'Backup download should return 200');

	return new Uint8Array(await res.arrayBuffer());
}

/**
 * Extract a tar.gz backup into server B's base path.
 */
async function extractBackup(archiveBytes: Uint8Array): Promise<void> {
	// Write archive to a temp file
	const tarPath = `${BASE_B}/restore.tar.gz`;
	await Deno.writeFile(tarPath, archiveBytes);

	// Extract into B's base path (backup contains a data/ directory)
	const cmd = new Deno.Command('tar', {
		args: ['-xzf', tarPath, '-C', BASE_B],
		stdout: 'piped',
		stderr: 'piped'
	});
	const { code, stderr } = await cmd.output();
	if (code !== 0) {
		throw new Error(`tar extract failed: ${new TextDecoder().decode(stderr)}`);
	}

	// Clean up the archive
	await Deno.remove(tarPath);
}

setup(async () => {
	// ── Server A: create backup with known data ──────────────────────────
	await startServer(PORT_A, { AUTH: 'on', ORIGIN: ORIGIN_A }, 'preview');

	const clientA = new TestClient(ORIGIN_A);
	await createUser(clientA, 'admin', 'password123', ORIGIN_A);
	await login(clientA, 'admin', 'password123', ORIGIN_A);
	await setApiKey(getDbPath(PORT_A), API_KEY);

	seedData(getDbPath(PORT_A));

	const archiveBytes = await createAndDownloadBackup(clientA);
	await stopServer(PORT_A);

	// ── Server B: restore from backup ────────────────────────────────────
	// Create B's directory structure (startServer does this, but we need it
	// before starting so we can extract the backup first)
	await Deno.mkdir(`${BASE_B}/data`, { recursive: true });
	await Deno.mkdir(`${BASE_B}/logs`, { recursive: true });
	await Deno.mkdir(`${BASE_B}/backups`, { recursive: true });
	await Deno.mkdir(`${BASE_B}/data/databases`, { recursive: true });

	await extractBackup(archiveBytes);

	// Start B with AUTH=off since the backup has no users/sessions
	await startServer(PORT_B, { AUTH: 'off', ORIGIN: ORIGIN_B }, 'preview');
	clientB = new TestClient(ORIGIN_B);
});

teardown(async () => {
	await stopServer(PORT_A);
	await stopServer(PORT_B);
});

// ─── Tests ──────────────────────────────────────────────────────────────────

test('restored server is healthy', async () => {
	const res = await clientB.get('/api/v1/health');
	assertEquals(res.status, 200);

	const body = await res.json();
	assertEquals(body.status, 'healthy');
});

test('arr instances survive restore (secrets stripped)', async () => {
	const res = await clientB.get('/api/v1/arr');
	assertEquals(res.status, 200);

	const instances = await res.json();
	const sonarr = instances.find((i: { name: string }) => i.name === 'Restore Test Sonarr');
	assertExists(sonarr, 'Seeded Sonarr instance should exist after restore');
	assertEquals(sonarr.type, 'sonarr');
	assertEquals(sonarr.url, 'http://sonarr:8989');
	// api_key is destructured out of the API response entirely
	assertEquals(sonarr.api_key, undefined, 'API key should not be in response');
});

test('backup settings survive restore', async () => {
	const res = await clientB.get('/api/v1/backups/settings');
	assertEquals(res.status, 200);

	const settings = await res.json();
	assertEquals(settings.schedule, 'weekly');
	assertEquals(settings.retentionDays, 14);
});

test('restored server can create new backups', async () => {
	const res = await clientB.post('/api/v1/backups', {});
	assertEquals(res.status, 202);

	const body = await res.json();
	assertExists(body.jobId);
	assertEquals(typeof body.jobId, 'number');
});

await run();
