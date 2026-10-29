/**
 * Integration tests for the restore + cancelRestore form actions on
 * `/settings/backups`. Coverage:
 *
 * - restoreBackup writes `${base}/.restore-pending` containing the resolved
 *   archive path.
 * - cancelRestore removes the sentinel.
 * - cancelRestore is idempotent when the sentinel is already absent.
 *
 * The actions don't require a real backup archive to be a valid SQLite DB;
 * they only stat the file before staging. A small dummy tar.gz next to the
 * other backups is enough.
 */

import { assert, assertEquals } from '@std/assert';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, test } from 'vitest';
import { TestClient } from '#integration/harness/client.ts';
import { startServer, stopServer } from '#integration/harness/server.ts';
import { createUser, login } from '#integration/harness/setup.ts';
import { PORTS } from '#integration/harness/ports.ts';

const execFileAsync = promisify(execFile);

const PORT = PORTS.backups.restoreFormActions;
const ORIGIN = `http://localhost:${PORT}`;
const BASE = `./dist/integration-${PORT}`;
const BACKUPS_DIR = `${BASE}/backups`;
const SENTINEL_PATH = `${BASE}/.restore-pending`;
const BACKUP_FILENAME = 'backup-2099-01-01-000000.tar.gz';

let client: TestClient;

async function exists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw err;
	}
}

async function createDummyBackup(filename: string): Promise<void> {
	const tmpDir = await mkdtemp(join(tmpdir(), 'profilarr-'));
	await mkdir(`${tmpDir}/data`);
	await writeFile(`${tmpDir}/data/data.txt`, 'dummy');
	await execFileAsync('tar', ['-czf', `${BACKUPS_DIR}/${filename}`, '-C', tmpDir, 'data']);
	await rm(tmpDir, { recursive: true, force: true });
}

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');
	client = new TestClient(ORIGIN);
	await createUser(client, 'admin', 'password123', ORIGIN);
	await login(client, 'admin', 'password123', ORIGIN);
	await createDummyBackup(BACKUP_FILENAME);
});

afterAll(async () => {
	await stopServer(PORT);
});

test('restoreBackup writes a sentinel pointing at the resolved archive path', async () => {
	// Make sure we start clean.
	if (await exists(SENTINEL_PATH)) await rm(SENTINEL_PATH);

	const res = await client.postForm(
		'/settings/backups?/restoreBackup',
		{ filename: BACKUP_FILENAME },
		{ headers: { Origin: ORIGIN } }
	);
	// SvelteKit form actions reply with 200/303 depending on Accept negotiation.
	// We don't depend on a specific status; we depend on the side effect.
	assert(res.status < 400, `Expected non-error status, got ${res.status}`);
	await res.body?.cancel();

	assertEquals(await exists(SENTINEL_PATH), true, 'sentinel should be written');

	const contents = (await readFile(SENTINEL_PATH, 'utf8')).trim();
	assert(
		contents.endsWith(`/backups/${BACKUP_FILENAME}`),
		`sentinel should point at the archive (got ${contents})`
	);
});

test('cancelRestore removes the sentinel', async () => {
	// Pre-condition: a sentinel exists from the previous test.
	if (!(await exists(SENTINEL_PATH))) {
		await writeFile(SENTINEL_PATH, `${BACKUPS_DIR}/${BACKUP_FILENAME}`);
	}

	const res = await client.postForm(
		'/settings/backups?/cancelRestore',
		{},
		{ headers: { Origin: ORIGIN } }
	);
	assert(res.status < 400, `Expected non-error status, got ${res.status}`);
	await res.body?.cancel();

	assertEquals(await exists(SENTINEL_PATH), false, 'sentinel should be removed');
});

test('cancelRestore is idempotent when no sentinel exists', async () => {
	// Make sure no sentinel.
	if (await exists(SENTINEL_PATH)) await rm(SENTINEL_PATH);

	const res = await client.postForm(
		'/settings/backups?/cancelRestore',
		{},
		{ headers: { Origin: ORIGIN } }
	);
	assert(res.status < 400, `Expected non-error status, got ${res.status}`);
	await res.body?.cancel();

	assertEquals(await exists(SENTINEL_PATH), false);
});
