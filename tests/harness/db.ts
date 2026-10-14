/**
 * Open a SQLite connection from a test harness with the same pragma
 * configuration the server uses (src/lib/server/db/db.ts).
 *
 * Critical: busy_timeout = 5000. Without it the @db/sqlite default is 0,
 * so the test connection fails with SQLITE_BUSY the moment the server
 * writer holds the lock (e.g. announcements.fetch firing on startup).
 *
 * journal_mode = WAL is persistent in the file header so we don't repeat it.
 * synchronous is per-connection but only affects crash safety, not concurrency.
 */

import { Database } from '@db/sqlite';

export function openDb(dbPath: string): Database {
	const db = new Database(dbPath);
	db.exec('PRAGMA busy_timeout = 5000');
	db.exec('PRAGMA foreign_keys = ON');
	return db;
}
