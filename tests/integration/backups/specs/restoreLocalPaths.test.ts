/**
 * Integration test: backup restore local path normalization.
 *
 * Cross-host restores must not preserve absolute database repo paths from
 * the source host. The boot restore step should repoint every restored PCD
 * row at the current host's data/databases/{uuid} directory.
 */

import { assertEquals } from '@std/assert';
import { Database } from '@db/sqlite';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { config } from '$config';

const SENTINEL_NAME = '.restore-pending';

let baseDir: string;
let applyPendingRestore: () => Promise<void>;

async function createRestoreArchive(archivePath: string, uuid: string): Promise<void> {
	const stage = await Deno.makeTempDir({ prefix: 'profilarr-restore-local-paths-' });
	try {
		const dataDir = `${stage}/data`;
		await Deno.mkdir(`${dataDir}/databases/${uuid}`, { recursive: true });
		await Deno.writeTextFile(`${dataDir}/databases/${uuid}/pcd.json`, '{}');

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

		const tar = new Deno.Command('tar', {
			args: ['-czf', archivePath, '-C', stage, 'data'],
			stdout: 'piped',
			stderr: 'piped'
		});
		const { code, stderr } = await tar.output();
		if (code !== 0) {
			throw new Error(`tar create failed: ${new TextDecoder().decode(stderr)}`);
		}
	} finally {
		await Deno.remove(stage, { recursive: true });
	}
}

function readRestoredLocalPath(dbPath: string): string {
	const database = new Database(dbPath);
	try {
		const row = database.prepare('SELECT local_path FROM database_instances').get() as
			| { local_path: string }
			| undefined;
		if (!row) throw new Error('database_instances row missing');
		return row.local_path;
	} finally {
		database.close();
	}
}

setup(async () => {
	baseDir = await Deno.makeTempDir({ prefix: 'profilarr-restore-local-paths-' });
	config.setBasePath(baseDir);
	await Deno.mkdir(config.paths.data, { recursive: true });
	({ applyPendingRestore } = await import('$utils/backup/applyPending.ts'));
});

teardown(async () => {
	if (baseDir) {
		await Deno.remove(baseDir, { recursive: true });
	}
});

test('restore rewrites database_instances.local_path for the current host', async () => {
	const uuid = crypto.randomUUID();
	const archivePath = `${baseDir}/backup-restore-local-paths.tar.gz`;
	await createRestoreArchive(archivePath, uuid);
	await Deno.writeTextFile(`${baseDir}/${SENTINEL_NAME}`, archivePath);

	await applyPendingRestore();

	assertEquals(readRestoredLocalPath(config.paths.database), `${config.paths.databases}/${uuid}`);
	assertEquals(await Deno.readTextFile(`${config.paths.databases}/${uuid}/pcd.json`), '{}');
});

await run();
