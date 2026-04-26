import { db } from '../db.ts';
import type {
	AnnouncementRow,
	BulletinAnnouncement,
	VersionsSnapshotRow
} from '$announcements/profilarr/types.ts';

/**
 * Queries for the announcements + versions_snapshot tables.
 *
 * Mutation helpers are designed to be called inside a single transaction
 * from the service layer's reconcile step. Read helpers are safe to call
 * from load functions directly.
 */

export const announcementQueries = {
	/**
	 * Return all rows, newest first.
	 */
	listAll(): AnnouncementRow[] {
		return db.query<AnnouncementRow>(
			'SELECT * FROM announcements ORDER BY published_at DESC, id DESC'
		);
	},

	/**
	 * Return a single row by id, or undefined.
	 */
	getById(id: string): AnnouncementRow | undefined {
		return db.queryFirst<AnnouncementRow>('SELECT * FROM announcements WHERE id = ?', id);
	},

	/**
	 * Insert a new bulletin announcement, or update an existing row preserving
	 * `read_at`, `body`, and `body_fetched_at`. Returns true if the row was
	 * newly inserted (so the caller can fire a notification).
	 */
	upsertFromBulletin(announcement: BulletinAnnouncement, fetchedAt: string): boolean {
		const existing = this.getById(announcement.id);

		if (!existing) {
			db.execute(
				`INSERT INTO announcements (
					id, title, severity, published_at, expires_at,
					min_version, max_version, link, body, withdrawn,
					read_at, fetched_at, body_fetched_at
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, NULL, ?, NULL)`,
				announcement.id,
				announcement.title,
				announcement.severity,
				announcement.published_at,
				announcement.expires_at,
				announcement.min_version,
				announcement.max_version,
				announcement.link,
				fetchedAt
			);
			return true;
		}

		db.execute(
			`UPDATE announcements SET
				title = ?,
				severity = ?,
				published_at = ?,
				expires_at = ?,
				min_version = ?,
				max_version = ?,
				link = ?,
				fetched_at = ?
			WHERE id = ?`,
			announcement.title,
			announcement.severity,
			announcement.published_at,
			announcement.expires_at,
			announcement.min_version,
			announcement.max_version,
			announcement.link,
			fetchedAt,
			announcement.id
		);
		return false;
	},

	/**
	 * Set `withdrawn = 1` for the given ids.
	 */
	markWithdrawn(ids: string[]): void {
		for (const id of ids) {
			db.execute('UPDATE announcements SET withdrawn = 1 WHERE id = ?', id);
		}
	},

	/**
	 * Set `withdrawn = 0` for the given ids (ids that reappeared).
	 */
	markUnwithdrawn(ids: string[]): void {
		for (const id of ids) {
			db.execute('UPDATE announcements SET withdrawn = 0 WHERE id = ?', id);
		}
	},

	/**
	 * Set `read_at` for a single announcement. No-op if the row doesn't exist.
	 */
	markRead(id: string, now: string): void {
		db.execute('UPDATE announcements SET read_at = ? WHERE id = ? AND read_at IS NULL', now, id);
	},

	/**
	 * Clear `read_at` for a single announcement (flip back to unread).
	 */
	markUnread(id: string): void {
		db.execute('UPDATE announcements SET read_at = NULL WHERE id = ?', id);
	},

	/**
	 * Populate the cached body for an announcement after a lazy fetch.
	 */
	setBody(id: string, body: string, now: string): void {
		db.execute(
			'UPDATE announcements SET body = ?, body_fetched_at = ? WHERE id = ?',
			body,
			now,
			id
		);
	}
};

export const versionsSnapshotQueries = {
	/**
	 * Return the singleton snapshot row, or undefined if no sync has happened.
	 */
	get(): VersionsSnapshotRow | undefined {
		return db.queryFirst<VersionsSnapshotRow>('SELECT * FROM versions_snapshot WHERE id = 1');
	},

	/**
	 * Upsert the singleton snapshot with the given payload (raw versions.json).
	 */
	set(payload: string, fetchedAt: string): void {
		db.execute(
			`INSERT INTO versions_snapshot (id, payload, fetched_at) VALUES (1, ?, ?)
			 ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
			payload,
			fetchedAt
		);
	}
};
