/**
 * Types for the profilarr (bulletin) announcements subsystem.
 *
 * Three logical groups:
 *  1. Bulletin payloads: exact shape fetched from raw.githubusercontent.com.
 *  2. Database row types: snake_case mirrors of the announcements/versions_snapshot tables.
 *  3. Service record types: camelCase shape exposed to API routes and load functions.
 */

import type { AnnouncementSeverity } from '../shared/types.ts';

export type { AnnouncementSeverity };

// ─── Bulletin payloads (raw JSON) ─────────────────────────────────────────

export interface BulletinAnnouncement {
	id: string;
	title: string;
	severity: AnnouncementSeverity;
	published_at: string;
	expires_at: string | null;
	min_version: string | null;
	max_version: string | null;
	link: string | null;
}

export interface BulletinAnnouncementsFile {
	schema: number;
	updated_at: string;
	announcements: BulletinAnnouncement[];
}

export interface BulletinRelease {
	tag: string;
	published_at: string;
	url: string;
}

export interface BulletinVersionsFile {
	schema: number;
	updated_at: string;
	channels: {
		stable: {
			latest: string;
			releases: BulletinRelease[];
		};
		develop: {
			latest: string;
			published_at: string;
		};
	};
}

// ─── Database row (raw DB shape) ──────────────────────────────────────────

export interface AnnouncementRow {
	id: string;
	title: string;
	severity: AnnouncementSeverity;
	published_at: string;
	expires_at: string | null;
	min_version: string | null;
	max_version: string | null;
	link: string | null;
	body: string | null;
	withdrawn: number;
	read_at: string | null;
	fetched_at: string;
	body_fetched_at: string | null;
}

export interface VersionsSnapshotRow {
	id: 1;
	payload: string;
	fetched_at: string;
}

// ─── Service records (exposed to routes) ──────────────────────────────────

export interface AnnouncementRecord {
	id: string;
	title: string;
	severity: AnnouncementSeverity;
	publishedAt: string;
	expiresAt: string | null;
	minVersion: string | null;
	maxVersion: string | null;
	link: string | null;
	body: string | null;
	withdrawn: boolean;
	readAt: string | null;
	fetchedAt: string;
	bodyFetchedAt: string | null;
}

export function rowToRecord(row: AnnouncementRow): AnnouncementRecord {
	return {
		id: row.id,
		title: row.title,
		severity: row.severity,
		publishedAt: row.published_at,
		expiresAt: row.expires_at,
		minVersion: row.min_version,
		maxVersion: row.max_version,
		link: row.link,
		body: row.body,
		withdrawn: row.withdrawn === 1,
		readAt: row.read_at,
		fetchedAt: row.fetched_at,
		bodyFetchedAt: row.body_fetched_at
	};
}
