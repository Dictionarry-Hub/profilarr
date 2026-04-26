/**
 * Integration test: first-sync detection is driven by the explicit
 * `isFirstSync` parameter, NOT by "the table is empty for this database."
 *
 * The bug this guards against: a user with a long-linked PCD that has
 * never had any announcements gets the maintainer's first-ever
 * announcement as silently-inserted-and-already-read, missing the
 * notification. Detection must be based on `last_synced_at IS NULL`,
 * captured before sync runs, NOT on row count.
 */

import { assertEquals, assert } from '@std/assert';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { getDbPath, startServer, stopServer } from '$test-harness/server.ts';
import { Database } from '@db/sqlite';
import { createDatabaseInstance } from '../harness/setup.ts';

const PORT = 7171;
const BASE_PATH = `./dist/integration-${PORT}`;

let dbPath: string;

interface ReconcileMods {
	reconcileFromWorkingCopy: (
		databaseId: number,
		opts: { isFirstSync: boolean }
	) => Promise<{
		status: 'ok' | 'failed';
		newlyInserted: Array<{ id: string; readAt: string | null }>;
		firstSync: boolean;
	}>;
}

let modsPromise: Promise<ReconcileMods> | null = null;

async function loadMods(): Promise<ReconcileMods> {
	if (!modsPromise) {
		Deno.env.set('APP_BASE_PATH', BASE_PATH);
		Deno.env.set('AUTH', 'off');
		modsPromise = (async () => {
			const [serviceMod, configMod, dbMod] = await Promise.all([
				import('../../../../src/lib/server/announcements/database/service.ts'),
				import('../../../../src/lib/server/utils/config/config.ts'),
				import('../../../../src/lib/server/db/db.ts')
			]);
			await configMod.config.init();
			await dbMod.db.initialize();
			return {
				reconcileFromWorkingCopy: serviceMod.reconcileFromWorkingCopy
			};
		})();
	}
	return modsPromise;
}

async function writeAnnouncementFile(uuid: string, id: string, title: string): Promise<void> {
	const dir = `${BASE_PATH}/data/databases/${uuid}/announcements`;
	await Deno.mkdir(dir, { recursive: true });
	const content = `---
title: ${title}
severity: info
published_at: 2026-04-20T10:00:00Z
---

Body for ${id}.
`;
	await Deno.writeTextFile(`${dir}/${id}.md`, content);
}

function setLastSyncedAt(databaseId: number, value: string | null): void {
	const db = new Database(dbPath);
	try {
		db.exec('UPDATE database_instances SET last_synced_at = ? WHERE id = ?', [value, databaseId]);
	} finally {
		db.close();
	}
}

function readReadAt(databaseId: number, announcementId: string): string | null {
	const db = new Database(dbPath);
	try {
		const row = db
			.prepare('SELECT read_at FROM database_announcements WHERE database_id = ? AND id = ?')
			.get(databaseId, announcementId) as { read_at: string | null } | undefined;
		return row?.read_at ?? null;
	} finally {
		db.close();
	}
}

setup(async () => {
	await startServer(PORT, { AUTH: 'off' }, 'preview');
	dbPath = getDbPath(PORT);
});

teardown(async () => {
	await stopServer(PORT);
});

test('isFirstSync=true marks every insert as already-read and returns empty newlyInserted', async () => {
	const uuid = 'first-sync-true';
	const databaseId = createDatabaseInstance(dbPath, { uuid, name: 'first-sync-true' });
	setLastSyncedAt(databaseId, null);

	await writeAnnouncementFile(uuid, 'a-1', 'Historical 1');
	await writeAnnouncementFile(uuid, 'a-2', 'Historical 2');

	const { reconcileFromWorkingCopy } = await loadMods();
	const report = await reconcileFromWorkingCopy(databaseId, { isFirstSync: true });

	assertEquals(report.status, 'ok');
	assertEquals(report.firstSync, true);
	assertEquals(report.newlyInserted.length, 0);
	assert(readReadAt(databaseId, 'a-1') !== null, 'a-1 should be marked read');
	assert(readReadAt(databaseId, 'a-2') !== null, 'a-2 should be marked read');
});

test('isFirstSync=false fires for net-new entries even when the table was empty for this database', async () => {
	// THIS is the regression case: long-linked DB whose table is
	// empty (the maintainer never published anything yet). When the
	// first announcement finally arrives, it MUST be reported as
	// newlyInserted with read_at = NULL.
	const uuid = 'first-sync-false';
	const databaseId = createDatabaseInstance(dbPath, { uuid, name: 'first-sync-false' });
	setLastSyncedAt(databaseId, '2026-01-01T00:00:00Z');

	await writeAnnouncementFile(uuid, 'b-1', 'Maintainers first');

	const { reconcileFromWorkingCopy } = await loadMods();
	const report = await reconcileFromWorkingCopy(databaseId, { isFirstSync: false });

	assertEquals(report.status, 'ok');
	assertEquals(report.firstSync, false);
	assertEquals(report.newlyInserted.length, 1);
	assertEquals(report.newlyInserted[0].id, 'b-1');
	assertEquals(readReadAt(databaseId, 'b-1'), null);
});

test('subsequent reconciles do not refire newlyInserted for unchanged ids', async () => {
	const uuid = 'first-sync-stable';
	const databaseId = createDatabaseInstance(dbPath, { uuid, name: 'first-sync-stable' });
	setLastSyncedAt(databaseId, '2026-01-01T00:00:00Z');

	await writeAnnouncementFile(uuid, 'c-1', 'Initial');

	const { reconcileFromWorkingCopy } = await loadMods();

	const first = await reconcileFromWorkingCopy(databaseId, { isFirstSync: false });
	assertEquals(first.newlyInserted.length, 1);

	const second = await reconcileFromWorkingCopy(databaseId, { isFirstSync: false });
	assertEquals(second.newlyInserted.length, 0);
});

await run();
