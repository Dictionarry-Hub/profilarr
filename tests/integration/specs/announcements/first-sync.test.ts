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

import { mkdir, writeFile } from 'node:fs/promises';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';
import { getDbPath, startServer, stopServer } from '#integration/harness/server.ts';
import { openDb } from '#integration/harness/db.ts';
import { createDatabaseInstance } from './harness/setup.ts';

const PORT = PORTS.announcements.firstSync;
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
		process.env.APP_BASE_PATH = BASE_PATH;
		process.env.AUTH = 'off';
		modsPromise = (async () => {
			const [serviceMod, configMod, dbMod] = await Promise.all([
				import('#server/announcements/database/service.ts'),
				import('#utils/config/config.ts'),
				import('#db/db.ts')
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
	await mkdir(dir, { recursive: true });
	const content = `---
title: ${title}
severity: info
published_at: 2026-04-20T10:00:00Z
---

Body for ${id}.
`;
	await writeFile(`${dir}/${id}.md`, content);
}

function setLastSyncedAt(databaseId: number, value: string | null): void {
	const db = openDb(dbPath);
	try {
		db.exec('UPDATE database_instances SET last_synced_at = ? WHERE id = ?', [value, databaseId]);
	} finally {
		db.close();
	}
}

function readReadAt(databaseId: number, announcementId: string): string | null {
	const db = openDb(dbPath);
	try {
		const row = db
			.prepare('SELECT read_at FROM database_announcements WHERE database_id = ? AND id = ?')
			.get(databaseId, announcementId) as { read_at: string | null } | undefined;
		return row?.read_at ?? null;
	} finally {
		db.close();
	}
}

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'off' }, 'preview');
	dbPath = getDbPath(PORT);
});

afterAll(async () => {
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

	expect(report.status).toStrictEqual('ok');
	expect(report.firstSync).toStrictEqual(true);
	expect(report.newlyInserted.length).toStrictEqual(0);
	expect(readReadAt(databaseId, 'a-1') !== null, 'a-1 should be marked read').toBeTruthy();
	expect(readReadAt(databaseId, 'a-2') !== null, 'a-2 should be marked read').toBeTruthy();
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

	expect(report.status).toStrictEqual('ok');
	expect(report.firstSync).toStrictEqual(false);
	expect(report.newlyInserted.length).toStrictEqual(1);
	expect(report.newlyInserted[0].id).toStrictEqual('b-1');
	expect(readReadAt(databaseId, 'b-1')).toStrictEqual(null);
});

test('subsequent reconciles do not refire newlyInserted for unchanged ids', async () => {
	const uuid = 'first-sync-stable';
	const databaseId = createDatabaseInstance(dbPath, { uuid, name: 'first-sync-stable' });
	setLastSyncedAt(databaseId, '2026-01-01T00:00:00Z');

	await writeAnnouncementFile(uuid, 'c-1', 'Initial');

	const { reconcileFromWorkingCopy } = await loadMods();

	const first = await reconcileFromWorkingCopy(databaseId, { isFirstSync: false });
	expect(first.newlyInserted.length).toStrictEqual(1);

	const second = await reconcileFromWorkingCopy(databaseId, { isFirstSync: false });
	expect(second.newlyInserted.length).toStrictEqual(0);
});
