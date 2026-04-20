import type { Migration } from '../migrations.ts';

/**
 * Migration 061: Create announcements + versions_snapshot tables
 *
 * Backing storage for the announcements feature. Both are populated by the
 * `announcements.fetch` job which pulls `announcements.json` and
 * `versions.json` from the bulletin repo every 30 minutes.
 *
 * `announcements` carries read state inline (`read_at`) because Profilarr is
 * a single-user app in practice. `versions_snapshot` is a singleton that
 * caches the last successful versions.json fetch for the About page and the
 * footer version badge.
 */

export const migration: Migration = {
	version: 61,
	name: 'Create announcements and versions_snapshot tables',

	up: `
		CREATE TABLE announcements (
			id TEXT PRIMARY KEY,                                 -- ULID from bulletin
			title TEXT NOT NULL,
			severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
			published_at DATETIME NOT NULL,
			expires_at DATETIME,
			min_version TEXT,
			max_version TEXT,
			link TEXT,
			body TEXT,                                           -- null until first open
			withdrawn INTEGER NOT NULL DEFAULT 0 CHECK (withdrawn IN (0,1)),
			read_at DATETIME,                                    -- null = unread
			fetched_at DATETIME NOT NULL,                        -- last manifest sync timestamp
			body_fetched_at DATETIME                             -- set when body is lazy-loaded
		);

		CREATE INDEX idx_announcements_published_at ON announcements(published_at DESC);
		CREATE INDEX idx_announcements_visible ON announcements(withdrawn, expires_at);

		CREATE TABLE versions_snapshot (
			id INTEGER PRIMARY KEY CHECK (id = 1),
			payload TEXT NOT NULL,                               -- raw versions.json as fetched
			fetched_at DATETIME NOT NULL
		);
	`,

	down: `
		DROP INDEX IF EXISTS idx_announcements_visible;
		DROP INDEX IF EXISTS idx_announcements_published_at;
		DROP TABLE IF EXISTS announcements;
		DROP TABLE IF EXISTS versions_snapshot;
	`
};
