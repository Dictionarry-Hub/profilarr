import type { Migration } from '../migrations.ts';

/**
 * Migration 063: Create database_announcements table
 *
 * Per-PCD announcement storage. Each linked database can publish
 * announcements via files in its working copy at
 * `${pcdPath}/announcements/<ulid>.md`. The pcd.sync job reads those files
 * and reconciles them into this table, scoped to the database row's id.
 *
 * Composite primary key (id, database_id) so the same ULID could in
 * principle appear under two PCDs without collision. ON DELETE CASCADE
 * means unlinking a database wipes its announcements automatically.
 *
 * Body is NOT NULL because the working copy is on disk during reconcile,
 * so we snapshot the body alongside the metadata. No lazy fetch needed
 * (unlike the bulletin announcements table).
 */

export const migration: Migration = {
	version: 63,
	name: 'Create database_announcements table',

	up: `
		CREATE TABLE database_announcements (
			id TEXT NOT NULL,                                    -- ULID, matches the working-copy filename
			database_id INTEGER NOT NULL,
			title TEXT NOT NULL,
			severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
			published_at DATETIME NOT NULL,
			expires_at DATETIME,
			link TEXT,
			body TEXT NOT NULL,                                  -- snapshotted from working copy at reconcile time
			withdrawn INTEGER NOT NULL DEFAULT 0 CHECK (withdrawn IN (0,1)),
			read_at DATETIME,                                    -- null = unread
			fetched_at DATETIME NOT NULL,                        -- last reconcile timestamp
			PRIMARY KEY (id, database_id),
			FOREIGN KEY (database_id) REFERENCES database_instances(id) ON DELETE CASCADE
		);

		CREATE INDEX idx_database_announcements_published_at
			ON database_announcements(published_at DESC);

		CREATE INDEX idx_database_announcements_visible
			ON database_announcements(database_id, withdrawn, expires_at);
	`,

	down: `
		DROP INDEX IF EXISTS idx_database_announcements_visible;
		DROP INDEX IF EXISTS idx_database_announcements_published_at;
		DROP TABLE IF EXISTS database_announcements;
	`
};
