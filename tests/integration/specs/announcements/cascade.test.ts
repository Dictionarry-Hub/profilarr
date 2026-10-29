/**
 * Integration test: FK cascade for `database_announcements`.
 *
 * Exercises the full migration pipeline: starts an integration server
 * (which runs every migration including 063), then verifies that
 * deleting a `database_instances` row cascades through to the
 * `database_announcements` rows it owns, leaves siblings alone, and
 * rejects orphan inserts.
 *
 * If this spec ever fails the likely culprits are: migration 063
 * dropped or weakened the FK constraint, or a code path opened the
 * SQLite connection without `PRAGMA foreign_keys = ON`.
 */

import { afterAll, beforeAll, expect, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';
import { getDbPath, startServer, stopServer } from '#integration/harness/server.ts';
import {
	countAnnouncements,
	countAnnouncementsFor,
	createDatabaseInstance,
	deleteDatabaseInstance,
	insertAnnouncement,
	tryInsertOrphanAnnouncement
} from './harness/setup.ts';

const PORT = PORTS.announcements.cascade;

let dbPath: string;

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'off' }, 'preview');
	dbPath = getDbPath(PORT);
});

afterAll(async () => {
	await stopServer(PORT);
});

test('deleting a parent database cascades only its announcements', () => {
	const alpha = createDatabaseInstance(dbPath, {
		uuid: 'cascade-alpha',
		name: 'cascade-alpha'
	});
	const beta = createDatabaseInstance(dbPath, {
		uuid: 'cascade-beta',
		name: 'cascade-beta'
	});

	insertAnnouncement(dbPath, { id: 'alpha-1', databaseId: alpha });
	insertAnnouncement(dbPath, { id: 'alpha-2', databaseId: alpha });
	insertAnnouncement(dbPath, { id: 'beta-1', databaseId: beta });

	expect(countAnnouncementsFor(dbPath, alpha)).toStrictEqual(2);
	expect(countAnnouncementsFor(dbPath, beta)).toStrictEqual(1);

	deleteDatabaseInstance(dbPath, alpha);

	expect(countAnnouncementsFor(dbPath, alpha)).toStrictEqual(0);
	expect(countAnnouncementsFor(dbPath, beta)).toStrictEqual(1);
});

test('inserting with an unknown database_id is rejected by the FK', () => {
	// 999_999 has not been issued; the FK must reject the insert. If this
	// fails, `PRAGMA foreign_keys` is not on for the integration DB.
	const rejected = tryInsertOrphanAnnouncement(dbPath, 999_999);
	expect(rejected).toStrictEqual(true);
});

test('the same id can live under two different databases (composite PK)', () => {
	const a = createDatabaseInstance(dbPath, {
		uuid: 'composite-a',
		name: 'composite-a'
	});
	const b = createDatabaseInstance(dbPath, {
		uuid: 'composite-b',
		name: 'composite-b'
	});

	insertAnnouncement(dbPath, { id: 'shared', databaseId: a });
	insertAnnouncement(dbPath, { id: 'shared', databaseId: b });

	expect(countAnnouncementsFor(dbPath, a)).toStrictEqual(1);
	expect(countAnnouncementsFor(dbPath, b)).toStrictEqual(1);
});

test('total table count reflects all surviving rows after cascades', () => {
	// One row left from the first scenario, two rows from the composite
	// scenario (one per database). That sums to three.
	expect(countAnnouncements(dbPath)).toStrictEqual(3);
});
