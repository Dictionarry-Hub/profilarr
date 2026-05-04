/**
 * Helpers for the database-announcements integration suite. Inserts rows
 * directly into a real, migrated SQLite database via `@db/sqlite`, so
 * each spec exercises the full migration pipeline alongside the FK
 * constraints under test.
 */

import { openDb } from '$test-harness/db.ts';

export interface CreateDbOpts {
	uuid: string;
	name?: string;
}

/**
 * Insert a `database_instances` row directly. Returns the new row id.
 * Mirrors the conflicts harness pattern: foreign-key cascades depend on
 * the row existing in the same DB the announcements live in, so we use
 * the integration server's actual SQLite file.
 */
export function createDatabaseInstance(dbPath: string, opts: CreateDbOpts): number {
	const db = openDb(dbPath);
	try {
		db.exec(
			`INSERT INTO database_instances (
				uuid, name, repository_url, local_path,
				sync_strategy, auto_pull, enabled, is_private,
				local_ops_enabled, conflict_strategy
			) VALUES (?, ?, '', ?, 60, 0, 1, 0, 1, 'ask')`,
			[opts.uuid, opts.name ?? `db-${opts.uuid}`, `/tmp/${opts.uuid}`]
		);
		const row = db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number };
		// Block auto-link in case the suite ever runs against a fresh setup.
		db.exec('UPDATE setup_state SET default_database_linked = 1 WHERE id = 1');
		return row.id;
	} finally {
		db.close();
	}
}

export interface InsertAnnouncementOpts {
	id: string;
	databaseId: number;
	title?: string;
	severity?: 'info' | 'warning' | 'critical';
	publishedAt?: string;
	body?: string;
}

/** Insert one `database_announcements` row directly. */
export function insertAnnouncement(dbPath: string, opts: InsertAnnouncementOpts): void {
	const db = openDb(dbPath);
	try {
		db.exec(
			`INSERT INTO database_announcements (
				id, database_id, title, severity, published_at, body, fetched_at
			) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				opts.id,
				opts.databaseId,
				opts.title ?? `Title ${opts.id}`,
				opts.severity ?? 'info',
				opts.publishedAt ?? '2026-04-20T10:00:00Z',
				opts.body ?? '',
				'2026-04-20T10:30:00Z'
			]
		);
	} finally {
		db.close();
	}
}

/** Count announcements scoped to a single database id. */
export function countAnnouncementsFor(dbPath: string, databaseId: number): number {
	const db = openDb(dbPath);
	try {
		const row = db
			.prepare('SELECT COUNT(*) AS c FROM database_announcements WHERE database_id = ?')
			.get(databaseId) as { c: number } | undefined;
		return row?.c ?? 0;
	} finally {
		db.close();
	}
}

/** Total count across all databases. */
export function countAnnouncements(dbPath: string): number {
	const db = openDb(dbPath);
	try {
		const row = db.prepare('SELECT COUNT(*) AS c FROM database_announcements').get() as
			| { c: number }
			| undefined;
		return row?.c ?? 0;
	} finally {
		db.close();
	}
}

/** Delete one parent row, exercising the ON DELETE CASCADE. */
export function deleteDatabaseInstance(dbPath: string, id: number): void {
	const db = openDb(dbPath);
	try {
		db.exec('DELETE FROM database_instances WHERE id = ?', [id]);
	} finally {
		db.close();
	}
}

/** Try to insert with a non-existent database_id. Returns true if rejected. */
export function tryInsertOrphanAnnouncement(dbPath: string, missingId: number): boolean {
	const db = openDb(dbPath);
	try {
		try {
			db.exec(
				`INSERT INTO database_announcements (
					id, database_id, title, severity, published_at, body, fetched_at
				) VALUES ('orphan', ?, 'orphan', 'info', '2026-04-20T10:00:00Z', '', '2026-04-20T10:30:00Z')`,
				[missingId]
			);
			return false;
		} catch {
			return true;
		}
	} finally {
		db.close();
	}
}
