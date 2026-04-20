/**
 * Pure reconciliation between a bulletin announcements payload and the
 * local SQLite rows. Given the incoming file and the current rows, decide
 * which ids are new, which disappeared, which reappeared after being
 * withdrawn, and how many entries got dropped because the payload exceeded
 * the sanity cap.
 *
 * No DB access here. The caller (`announcementQueries` / `service`) applies
 * the returned plan inside a transaction.
 */

import type { AnnouncementRow, BulletinAnnouncement, BulletinAnnouncementsFile } from './types.ts';

/** Hard cap to prevent a misbehaving bulletin from writing unbounded rows. */
export const ANNOUNCEMENTS_CAP = 1000;

export interface ReconcilePlan {
	/** All entries to upsert (full metadata). Caller preserves read_at/body on existing rows. */
	upserts: BulletinAnnouncement[];
	/** Ids currently in the DB that are absent from the incoming file and not already withdrawn. */
	withdrawnIds: string[];
	/** Ids currently marked withdrawn in the DB that reappeared in the incoming file. */
	unwithdrawnIds: string[];
	/** Subset of `upserts` that had no matching row in the DB. Used to fire notifications. */
	newlyInserted: BulletinAnnouncement[];
	/** Entries dropped because the payload exceeded `ANNOUNCEMENTS_CAP`. Caller may log. */
	droppedCount: number;
}

export class UnsupportedSchemaError extends Error {
	readonly schema: number;
	constructor(schema: number) {
		super(`Unsupported announcements schema version: ${schema}`);
		this.schema = schema;
		this.name = 'UnsupportedSchemaError';
	}
}

export function reconcileAnnouncements(
	file: BulletinAnnouncementsFile,
	existingRows: AnnouncementRow[]
): ReconcilePlan {
	if (file.schema !== 1) {
		throw new UnsupportedSchemaError(file.schema);
	}

	const total = file.announcements.length;
	const capped = file.announcements.slice(0, ANNOUNCEMENTS_CAP);
	const droppedCount = Math.max(0, total - capped.length);

	const existingById = new Map<string, AnnouncementRow>();
	for (const row of existingRows) {
		existingById.set(row.id, row);
	}

	const incomingIds = new Set<string>();
	const upserts: BulletinAnnouncement[] = [];
	const newlyInserted: BulletinAnnouncement[] = [];
	const unwithdrawnIds: string[] = [];

	for (const announcement of capped) {
		incomingIds.add(announcement.id);
		upserts.push(announcement);
		const existing = existingById.get(announcement.id);
		if (!existing) {
			newlyInserted.push(announcement);
		} else if (existing.withdrawn === 1) {
			unwithdrawnIds.push(announcement.id);
		}
	}

	const withdrawnIds: string[] = [];
	for (const row of existingRows) {
		if (!incomingIds.has(row.id) && row.withdrawn === 0) {
			withdrawnIds.push(row.id);
		}
	}

	return { upserts, withdrawnIds, unwithdrawnIds, newlyInserted, droppedCount };
}
