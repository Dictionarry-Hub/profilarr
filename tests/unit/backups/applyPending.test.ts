/**
 * Unit tests for `applyPendingRestore()` from
 * `src/lib/server/utils/backup/applyPending.ts`.
 *
 * The function is pure filesystem work (extract a tar.gz, swap files, remove
 * a sentinel). No DB schema or running server is needed. We isolate state
 * per test by pointing `config.setBasePath` at a per-test temp dir.
 *
 * Branches covered:
 *   - no sentinel -> noop, no throw
 *   - sentinel + missing archive -> sentinel removed, live data preserved
 *   - sentinel + corrupt archive -> throws, sentinel preserved, staging cleaned,
 *     live data preserved
 *   - sentinel + archive without `data/profilarr.db` -> throws, sentinel preserved,
 *     staging cleaned, live data preserved
 *   - happy path -> sidecars wiped, archive applied, sentinel + staging removed
 *   - pre-existing `.restoring/` from a crashed previous apply is wiped
 *     before extract
 */

import { BaseTest, type TestContext } from '../base/BaseTest.ts';
import { assertEquals, assertRejects } from '@std/assert';
import { applyPendingRestore } from '../../../src/lib/server/utils/backup/applyPending.ts';
import { config } from '../../../src/lib/server/utils/config/config.ts';
import { Database } from '@db/sqlite';

const SENTINEL_NAME = '.restore-pending';
const STAGING_NAME = '.restoring';

/**
 * Build a valid tar.gz at `archivePath` containing `data/profilarr.db` and
 * `data/INFO.json`.
 */
async function createValidArchive(
	workDir: string,
	archivePath: string,
	marker: string
): Promise<void> {
	const stage = `${workDir}/_stage`;
	await Deno.mkdir(`${stage}/data`, { recursive: true });
	const database = new Database(`${stage}/data/profilarr.db`);
	try {
		database.exec('CREATE TABLE restore_marker (value TEXT NOT NULL)');
		database.exec('INSERT INTO restore_marker (value) VALUES (?)', [marker]);
	} finally {
		database.close();
	}
	await Deno.writeTextFile(
		`${stage}/data/INFO.json`,
		JSON.stringify({ appVersion: 'test', schemaVersion: 0, sanitized: false })
	);

	const tar = new Deno.Command('tar', {
		args: ['-czf', archivePath, '-C', stage, 'data'],
		stdout: 'piped',
		stderr: 'piped'
	});
	const { code } = await tar.output();
	if (code !== 0) throw new Error(`createValidArchive: tar failed with exit ${code}`);
	await Deno.remove(stage, { recursive: true });
}

/** Build a tar.gz containing only `data/scratch.txt` (no profilarr.db). */
async function createArchiveWithoutDb(workDir: string, archivePath: string): Promise<void> {
	const stage = `${workDir}/_stage`;
	await Deno.mkdir(`${stage}/data`, { recursive: true });
	await Deno.writeTextFile(`${stage}/data/scratch.txt`, 'no db here');

	const tar = new Deno.Command('tar', {
		args: ['-czf', archivePath, '-C', stage, 'data'],
		stdout: 'piped',
		stderr: 'piped'
	});
	const { code } = await tar.output();
	if (code !== 0) throw new Error(`createArchiveWithoutDb: tar failed with exit ${code}`);
	await Deno.remove(stage, { recursive: true });
}

async function exists(path: string): Promise<boolean> {
	try {
		await Deno.stat(path);
		return true;
	} catch (err) {
		if (err instanceof Deno.errors.NotFound) return false;
		throw err;
	}
}

async function readText(path: string): Promise<string> {
	return await Deno.readTextFile(path);
}

function readMarker(dbPath: string): string {
	const database = new Database(dbPath);
	try {
		const row = database.prepare('SELECT value FROM restore_marker').get() as
			| { value: string }
			| undefined;
		if (!row) throw new Error('restore_marker row missing');
		return row.value;
	} finally {
		database.close();
	}
}

class ApplyPendingTest extends BaseTest {
	protected override async beforeEach(ctx: TestContext): Promise<void> {
		// Point config at the per-test temp dir, then create the data/
		// subdirectory the same way config.init() would.
		config.setBasePath(ctx.tempDir);
		await Deno.mkdir(`${ctx.tempDir}/data`, { recursive: true });
	}

	testNoSentinel(): void {
		this.test('no sentinel: returns without error and does not touch data', async (ctx) => {
			await Deno.writeTextFile(`${ctx.tempDir}/data/profilarr.db`, 'live');

			await applyPendingRestore();

			assertEquals(await readText(`${ctx.tempDir}/data/profilarr.db`), 'live');
			assertEquals(await exists(`${ctx.tempDir}/${SENTINEL_NAME}`), false);
			assertEquals(await exists(`${ctx.tempDir}/${STAGING_NAME}`), false);
		});
	}

	testMissingArchive(): void {
		this.test('sentinel pointing at missing archive: clears sentinel, leaves data', async (ctx) => {
			await Deno.writeTextFile(`${ctx.tempDir}/data/profilarr.db`, 'live');
			await Deno.writeTextFile(
				`${ctx.tempDir}/${SENTINEL_NAME}`,
				`${ctx.tempDir}/does-not-exist.tar.gz`
			);

			await applyPendingRestore();

			assertEquals(await exists(`${ctx.tempDir}/${SENTINEL_NAME}`), false);
			assertEquals(await readText(`${ctx.tempDir}/data/profilarr.db`), 'live');
		});
	}

	testCorruptArchive(): void {
		this.test(
			'sentinel + corrupt archive: throws, sentinel preserved, data preserved',
			async (ctx) => {
				await Deno.writeTextFile(`${ctx.tempDir}/data/profilarr.db`, 'live');

				const archivePath = `${ctx.tempDir}/junk.tar.gz`;
				await Deno.writeFile(archivePath, new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff]));
				await Deno.writeTextFile(`${ctx.tempDir}/${SENTINEL_NAME}`, archivePath);

				await assertRejects(() => applyPendingRestore(), Error, 'Restore extraction failed');

				assertEquals(await exists(`${ctx.tempDir}/${SENTINEL_NAME}`), true);
				assertEquals(await exists(`${ctx.tempDir}/${STAGING_NAME}`), false);
				assertEquals(await readText(`${ctx.tempDir}/data/profilarr.db`), 'live');
			}
		);
	}

	testArchiveMissingDb(): void {
		this.test('sentinel + archive without profilarr.db: throws, data preserved', async (ctx) => {
			await Deno.writeTextFile(`${ctx.tempDir}/data/profilarr.db`, 'live');

			const archivePath = `${ctx.tempDir}/no-db.tar.gz`;
			await createArchiveWithoutDb(ctx.tempDir, archivePath);
			await Deno.writeTextFile(`${ctx.tempDir}/${SENTINEL_NAME}`, archivePath);

			await assertRejects(() => applyPendingRestore(), Error, 'does not contain data/profilarr.db');

			assertEquals(await exists(`${ctx.tempDir}/${SENTINEL_NAME}`), true);
			assertEquals(await exists(`${ctx.tempDir}/${STAGING_NAME}`), false);
			assertEquals(await readText(`${ctx.tempDir}/data/profilarr.db`), 'live');
		});
	}

	testHappyPath(): void {
		this.test(
			'happy path: sidecars wiped, archive applied, sentinel and staging removed',
			async (ctx) => {
				// Live data: stale DB plus sidecars plus a databases/ subtree.
				await Deno.writeTextFile(`${ctx.tempDir}/data/profilarr.db`, 'live-OLD');
				await Deno.writeTextFile(`${ctx.tempDir}/data/profilarr.db-wal`, 'stale-wal');
				await Deno.writeTextFile(`${ctx.tempDir}/data/profilarr.db-shm`, 'stale-shm');
				await Deno.mkdir(`${ctx.tempDir}/data/databases`);
				await Deno.writeTextFile(`${ctx.tempDir}/data/databases/old.txt`, 'gone');

				const archivePath = `${ctx.tempDir}/backup.tar.gz`;
				await createValidArchive(ctx.tempDir, archivePath, 'restored-NEW');
				await Deno.writeTextFile(`${ctx.tempDir}/${SENTINEL_NAME}`, archivePath);

				await applyPendingRestore();

				// New DB content moved into place.
				assertEquals(readMarker(`${ctx.tempDir}/data/profilarr.db`), 'restored-NEW');
				// Sidecars wiped (archive doesn't include them, and the live ones are removed pre-swap).
				assertEquals(await exists(`${ctx.tempDir}/data/profilarr.db-wal`), false);
				assertEquals(await exists(`${ctx.tempDir}/data/profilarr.db-shm`), false);
				// Old databases/ subtree replaced.
				assertEquals(await exists(`${ctx.tempDir}/data/databases/old.txt`), false);
				// INFO.json restored.
				assertEquals(await exists(`${ctx.tempDir}/data/INFO.json`), true);
				// Sentinel removed last; staging dir cleaned up.
				assertEquals(await exists(`${ctx.tempDir}/${SENTINEL_NAME}`), false);
				assertEquals(await exists(`${ctx.tempDir}/${STAGING_NAME}`), false);
			}
		);
	}

	testLeftoverStagingWiped(): void {
		this.test(
			'pre-existing .restoring/ from a crashed apply is wiped before extract',
			async (ctx) => {
				await Deno.writeTextFile(`${ctx.tempDir}/data/profilarr.db`, 'live-OLD');

				// Simulate a crashed previous apply: a stale .restoring/ with junk in it.
				await Deno.mkdir(`${ctx.tempDir}/${STAGING_NAME}/data`, { recursive: true });
				await Deno.writeTextFile(`${ctx.tempDir}/${STAGING_NAME}/junk.txt`, 'leftover');

				const archivePath = `${ctx.tempDir}/backup.tar.gz`;
				await createValidArchive(ctx.tempDir, archivePath, 'restored-NEW');
				await Deno.writeTextFile(`${ctx.tempDir}/${SENTINEL_NAME}`, archivePath);

				await applyPendingRestore();

				// New content applied, leftover gone, staging dir removed entirely.
				assertEquals(readMarker(`${ctx.tempDir}/data/profilarr.db`), 'restored-NEW');
				assertEquals(await exists(`${ctx.tempDir}/${STAGING_NAME}`), false);
				assertEquals(await exists(`${ctx.tempDir}/${SENTINEL_NAME}`), false);
			}
		);
	}

	runTests(): void {
		this.testNoSentinel();
		this.testMissingArchive();
		this.testCorruptArchive();
		this.testArchiveMissingDb();
		this.testHappyPath();
		this.testLeftoverStagingWiped();
	}
}

const test = new ApplyPendingTest();
await test.runTests();
