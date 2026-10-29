/**
 * Integration test: backup restore local path normalization.
 *
 * Cross-host restores must not preserve absolute database repo paths from
 * the source host. The boot restore step should repoint every restored PCD
 * row at the current host's data/databases/{uuid} directory.
 */

import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, test } from 'vitest';
import { assertEquals } from '@std/assert';
import { Database } from '#db/sqlite.ts';
import { config } from '#utils/config/config.ts';

const execFileAsync = promisify(execFile);

const SENTINEL_NAME = '.restore-pending';

let baseDir: string;
let applyPendingRestore: () => Promise<void>;

async function createRestoreArchive(archivePath: string, uuid: string): Promise<void> {
	const stage = await mkdtemp(join(tmpdir(), 'profilarr-restore-local-paths-'));
	try {
		const dataDir = `${stage}/data`;
		await mkdir(`${dataDir}/databases/${uuid}`, { recursive: true });
		await writeFile(`${dataDir}/databases/${uuid}/pcd.json`, '{}');

		const database = new Database(`${dataDir}/profilarr.db`);
		try {
			database.exec(
				`CREATE TABLE database_instances (
					uuid TEXT NOT NULL,
					name TEXT NOT NULL,
					local_path TEXT NOT NULL
				)`
			);
			database.exec(
				`INSERT INTO database_instances (uuid, name, local_path)
				 VALUES (?, 'Restored DB', ?)`,
				[uuid, `/config/data/databases/${uuid}`]
			);
		} finally {
			database.close();
		}

		try {
			await execFileAsync('tar', ['-czf', archivePath, '-C', stage, 'data']);
		} catch (err) {
			throw new Error(`tar create failed: ${(err as { stderr?: string }).stderr ?? err}`);
		}
	} finally {
		await rm(stage, { recursive: true, force: true });
	}
}

function readRestoredLocalPath(dbPath: string): string {
	const database = new Database(dbPath);
	try {
		const row = database.prepare('SELECT local_path FROM database_instances').get() as
			{ local_path: string } | undefined;
		if (!row) throw new Error('database_instances row missing');
		return row.local_path;
	} finally {
		database.close();
	}
}

beforeAll(async () => {
	baseDir = await mkdtemp(join(tmpdir(), 'profilarr-restore-local-paths-'));
	config.setBasePath(baseDir);
	await mkdir(config.paths.data, { recursive: true });
	({ applyPendingRestore } = await import('#utils/backup/applyPending.ts'));
});

afterAll(async () => {
	if (baseDir) {
		await rm(baseDir, { recursive: true, force: true });
	}
});

test('restore rewrites database_instances.local_path for the current host', async () => {
	const uuid = crypto.randomUUID();
	const archivePath = `${baseDir}/backup-restore-local-paths.tar.gz`;
	await createRestoreArchive(archivePath, uuid);
	await writeFile(`${baseDir}/${SENTINEL_NAME}`, archivePath);

	await applyPendingRestore();

	assertEquals(readRestoredLocalPath(config.paths.database), `${config.paths.databases}/${uuid}`);
	assertEquals(await readFile(`${config.paths.databases}/${uuid}/pcd.json`, 'utf8'), '{}');
});
