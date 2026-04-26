/**
 * Types for the per-database (PCD) announcements subsystem.
 *
 * Three logical groups:
 *  1. Frontmatter / parsed-file shapes: parsed from `${pcdPath}/announcements/<ulid>.md`.
 *  2. Database row type: snake_case mirror of the `database_announcements` table.
 *  3. Service record type: camelCase shape exposed to API routes and load functions.
 */

import type { AnnouncementSeverity } from '../shared/types.ts';

export type { AnnouncementSeverity };

// ─── Frontmatter / parsed file ───────────────────────────────────────────

/**
 * The raw frontmatter we accept from a working-copy .md file. Required
 * fields are validated by the parser; optional ones are nullable.
 */
export interface DatabaseAnnouncementFrontmatter {
	title: string;
	severity: AnnouncementSeverity;
	published_at: string;
	expires_at: string | null;
	link: string | null;
}

/**
 * Result of parsing one announcement file. `id` is derived from the
 * filename (without the .md extension), `body` is the markdown after the
 * frontmatter delimiter.
 */
export interface DatabaseAnnouncementParsed extends DatabaseAnnouncementFrontmatter {
	id: string;
	body: string;
}

// ─── Database row (raw DB shape) ──────────────────────────────────────────

export interface DatabaseAnnouncementRow {
	id: string;
	database_id: number;
	title: string;
	severity: AnnouncementSeverity;
	published_at: string;
	expires_at: string | null;
	link: string | null;
	body: string;
	withdrawn: number;
	read_at: string | null;
	fetched_at: string;
}

// ─── Service records (exposed to routes) ──────────────────────────────────

export interface DatabaseAnnouncementRecord {
	id: string;
	databaseId: number;
	title: string;
	severity: AnnouncementSeverity;
	publishedAt: string;
	expiresAt: string | null;
	link: string | null;
	body: string;
	withdrawn: boolean;
	readAt: string | null;
	fetchedAt: string;
}

export function rowToRecord(row: DatabaseAnnouncementRow): DatabaseAnnouncementRecord {
	return {
		id: row.id,
		databaseId: row.database_id,
		title: row.title,
		severity: row.severity,
		publishedAt: row.published_at,
		expiresAt: row.expires_at,
		link: row.link,
		body: row.body,
		withdrawn: row.withdrawn === 1,
		readAt: row.read_at,
		fetchedAt: row.fetched_at
	};
}
