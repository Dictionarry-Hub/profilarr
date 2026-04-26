import { db } from '../db.ts';
import type {
	DatabaseAnnouncementParsed,
	DatabaseAnnouncementRow
} from '$announcements/database/types.ts';

/**
 * Queries for the database_announcements table (per-PCD announcements).
 *
 * Mutation helpers are designed to be called inside a single transaction
 * from the service layer's reconcile step. Read helpers are safe to call
 * directly from load functions.
 *
 * Every mutation is scoped to a `databaseId` so a reconcile pass for one
 * PCD can never affect rows belonging to another PCD or the bulletin
 * announcements table. This is the structural defense the plan calls out.
 */

export const databaseAnnouncementQueries = {
	/**
	 * Return all rows for a single database, newest first.
	 */
	listForDatabase(databaseId: number): DatabaseAnnouncementRow[] {
		return db.query<DatabaseAnnouncementRow>(
			`SELECT * FROM database_announcements
			 WHERE database_id = ?
			 ORDER BY published_at DESC, id DESC`,
			databaseId
		);
	},

	/**
	 * Return every row across every database, newest first. Used by the
	 * inbox UNION in `announcements/inbox.ts`.
	 */
	listAll(): DatabaseAnnouncementRow[] {
		return db.query<DatabaseAnnouncementRow>(
			`SELECT * FROM database_announcements
			 ORDER BY published_at DESC, id DESC`
		);
	},

	/**
	 * Return a single row by (id, databaseId) tuple.
	 */
	getById(id: string, databaseId: number): DatabaseAnnouncementRow | undefined {
		return db.queryFirst<DatabaseAnnouncementRow>(
			'SELECT * FROM database_announcements WHERE id = ? AND database_id = ?',
			id,
			databaseId
		);
	},

	/**
	 * Insert a new row, or update an existing row preserving `read_at`.
	 * Returns true if the row was newly inserted (so the caller can fire a
	 * notification).
	 *
	 * `readAtOnInsert` lets the caller mark first-sync inserts as already
	 * read by passing the current timestamp. Pass `null` for the normal
	 * case (subsequent syncs, where new entries should appear unread and
	 * fire `announcement.new`).
	 */
	upsertFromParsed(
		announcement: DatabaseAnnouncementParsed,
		databaseId: number,
		fetchedAt: string,
		readAtOnInsert: string | null
	): boolean {
		const existing = this.getById(announcement.id, databaseId);

		if (!existing) {
			db.execute(
				`INSERT INTO database_announcements (
					id, database_id, title, severity, published_at, expires_at,
					link, body, withdrawn, read_at, fetched_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
				announcement.id,
				databaseId,
				announcement.title,
				announcement.severity,
				announcement.published_at,
				announcement.expires_at,
				announcement.link,
				announcement.body,
				readAtOnInsert,
				fetchedAt
			);
			return true;
		}

		db.execute(
			`UPDATE database_announcements SET
				title = ?,
				severity = ?,
				published_at = ?,
				expires_at = ?,
				link = ?,
				body = ?,
				fetched_at = ?
			WHERE id = ? AND database_id = ?`,
			announcement.title,
			announcement.severity,
			announcement.published_at,
			announcement.expires_at,
			announcement.link,
			announcement.body,
			fetchedAt,
			announcement.id,
			databaseId
		);
		return false;
	},

	/**
	 * Set `withdrawn = 1` for the given ids within a single database.
	 */
	markWithdrawn(ids: string[], databaseId: number): void {
		for (const id of ids) {
			db.execute(
				'UPDATE database_announcements SET withdrawn = 1 WHERE id = ? AND database_id = ?',
				id,
				databaseId
			);
		}
	},

	/**
	 * Set `withdrawn = 0` for the given ids within a single database.
	 */
	markUnwithdrawn(ids: string[], databaseId: number): void {
		for (const id of ids) {
			db.execute(
				'UPDATE database_announcements SET withdrawn = 0 WHERE id = ? AND database_id = ?',
				id,
				databaseId
			);
		}
	},

	/**
	 * Set `read_at` for a single announcement. No-op if already read.
	 */
	markRead(id: string, databaseId: number, now: string): void {
		db.execute(
			`UPDATE database_announcements SET read_at = ?
			 WHERE id = ? AND database_id = ? AND read_at IS NULL`,
			now,
			id,
			databaseId
		);
	},

	/**
	 * Clear `read_at` for a single announcement (flip back to unread).
	 */
	markUnread(id: string, databaseId: number): void {
		db.execute(
			'UPDATE database_announcements SET read_at = NULL WHERE id = ? AND database_id = ?',
			id,
			databaseId
		);
	}
};
