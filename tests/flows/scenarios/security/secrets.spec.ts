/**
 * - Threat: a user shares a downloaded backup, such as attaching it to a bug
 *   report, and it carries the secrets the local archive holds: Arr API keys
 *   and URLs, tokens, sessions. Deleting the rows is not enough: SQLite keeps
 *   deleted rows in the file's free space, where the raw bytes still show
 *   them (GHSA-w2w8-9gr2-cg28).
 * - Defence: the download endpoint sanitizes a copy of the archive
 *   (src/lib/server/utils/backup/sanitize.ts). It turns on secure_delete so
 *   deleted rows are zeroed, deletes the secret-bearing rows, nulls the
 *   remaining secret columns, and runs VACUUM so no free space survives.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test, expect } from '#flows/helpers/core/test.ts';
import { addArr } from '#flows/helpers/sync/arrs.ts';
import { createBackup, downloadBackup, openArchive } from '#flows/helpers/settings/backups.ts';

/** Tables the sanitizer empties; a row left in any of them is a leak */
const EMPTIED_TABLES = [
	'arr_instances',
	'users',
	'sessions',
	'api_keys',
	'notification_services'
] as const;

const ARR_NAME = 'Secret Radarr';

/**
 * Flow:
 * 1. The user adds a Radarr instance, so the database holds its API key and
 *    URL. The fake's own key is the secret under test.
 * 2. The user creates a backup on Settings › Backups and waits for it.
 * 3. The user downloads it, confirming the Download Backup dialog.
 *
 * Expects:
 * - the local archive still holds the API key, so the checks below can't
 *   pass on an empty database
 * - the downloaded database's raw bytes hold neither the API key nor the URL,
 *   so nothing survives in free space
 * - the sanitized tables are empty, the fixtures database stays linked with
 *   its token nulled, and the file passes integrity_check
 * - the archive carries no WAL or shm sidecar that could hold old pages
 * - INFO.json marks the archive as sanitized
 */
test('a downloaded backup carries no secrets, even in free space', async ({
	app,
	page,
	fakeRadarr
}, testInfo) => {
	const apiKey = Buffer.from(fakeRadarr.apiKey);
	const url = Buffer.from(fakeRadarr.url);

	await addArr(page, { name: ARR_NAME, fake: fakeRadarr });
	const filename = await createBackup(page);
	const archive = await downloadBackup(page, filename, testInfo.outputPath(filename));
	const downloaded = await openArchive(archive, testInfo.outputPath('downloaded'));

	// Control: the archive left on disk is not sanitized, so it must hold the key
	const local = await openArchive(join(app.dir, 'backups', filename), testInfo.outputPath('local'));
	const localBytes = readFileSync(join(local, 'profilarr.db'));
	expect(
		localBytes.includes(apiKey),
		'control: the local archive on disk should still hold the API key'
	).toBe(true);

	const dbPath = join(downloaded, 'profilarr.db');
	const bytes = readFileSync(dbPath);
	expect(
		bytes.includes(apiKey),
		'the downloaded database should hold no trace of the API key, not even in free space'
	).toBe(false);
	expect(
		bytes.includes(url),
		'the downloaded database should hold no trace of the Arr URL, not even in free space'
	).toBe(false);

	const db = new DatabaseSync(dbPath, { readOnly: true });
	try {
		for (const table of EMPTIED_TABLES) {
			const { count } = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
				count: number;
			};
			expect(count, `${table} should have no rows left`).toBe(0);
		}
		const databases = db
			.prepare('SELECT name, personal_access_token AS token FROM database_instances')
			.all() as { name: string; token: string | null }[];
		expect(databases, 'the linked database should stay in database_instances').toHaveLength(1);
		expect(databases[0].token, 'the linked database should keep no personal access token').toBe(
			null
		);
		const integrity = db.prepare('PRAGMA integrity_check').all() as { integrity_check: string }[];
		expect(
			integrity.map((row) => row.integrity_check),
			'the downloaded database should pass integrity_check'
		).toEqual(['ok']);
	} finally {
		db.close();
	}

	for (const sidecar of ['profilarr.db-wal', 'profilarr.db-shm']) {
		expect(
			existsSync(join(downloaded, sidecar)),
			`the archive should carry no ${sidecar} file`
		).toBe(false);
	}

	const info = JSON.parse(readFileSync(join(downloaded, 'INFO.json'), 'utf8')) as {
		sanitized?: boolean;
	};
	expect(info.sanitized, 'INFO.json should mark the archive as sanitized').toBe(true);
});
