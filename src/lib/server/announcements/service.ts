/**
 * Announcement service façade.
 *
 * Single entry point used by:
 *  - The `announcements.fetch` job (`reconcileFromBulletin`).
 *  - SvelteKit server load functions for the `/announcements` route + layout badge.
 *  - The `/api/v1/announcements{,/[id]}` handlers.
 *
 * All DB access is delegated to `announcementQueries` + `versionsSnapshotQueries`.
 * All HTTP access is delegated to `./client.ts`.
 */

import { db } from '$db/db.ts';
import { announcementQueries, versionsSnapshotQueries } from '$db/queries/announcements.ts';
import { logger } from '$logger/logger.ts';
import { build } from '$lib/shared/build.ts';
import { fetchAnnouncements, fetchBody, fetchVersions } from './client.ts';
import { isVisible, type VisibilityContext } from './filter.ts';
import { reconcileAnnouncements, UnsupportedSchemaError, type ReconcilePlan } from './reconcile.ts';
import { rowToRecord, type AnnouncementRecord, type BulletinVersionsFile } from './types.ts';

/** Hardcoded poll interval. No user-facing knob. */
export const FETCH_INTERVAL_MS = 30 * 60 * 1000;

/** Build the visibility context from the current build + now. */
function currentContext(): VisibilityContext {
	return {
		now: new Date().toISOString(),
		version: build.version,
		channel: build.channel
	};
}

/**
 * Return the list of announcements that should be visible to the current
 * user right now. Sorted newest first. Body is NOT loaded (lazy).
 */
export function listVisible(): AnnouncementRecord[] {
	const ctx = currentContext();
	return announcementQueries
		.listAll()
		.map(rowToRecord)
		.filter((a) => isVisible(a, ctx));
}

/**
 * Count of unread announcements that are currently visible. Powers the nav
 * bell badge and the `/api/v1/status.announcements.unread` field.
 */
export function getUnreadCount(): number {
	return listVisible().filter((a) => a.readAt === null).length;
}

/**
 * Return a single announcement by id. If `loadBody` is true and the body
 * isn't cached yet, fetch it from the bulletin and persist. Returns
 * undefined if the id isn't in the DB (can happen if the API is hit
 * before the first fetch completes).
 */
export async function getDetail(
	id: string,
	opts: { loadBody?: boolean } = {}
): Promise<AnnouncementRecord | undefined> {
	const row = announcementQueries.getById(id);
	if (!row) return undefined;

	if (opts.loadBody && row.body === null) {
		const result = await fetchBody(id);
		if (result.ok) {
			const now = new Date().toISOString();
			announcementQueries.setBody(id, result.data, now);
			return rowToRecord({ ...row, body: result.data, body_fetched_at: now });
		}
		await logger.warn(`Failed to fetch announcement body for ${id}`, {
			source: 'AnnouncementsService',
			meta: { error: result.error }
		});
	}

	return rowToRecord(row);
}

/**
 * Mark an announcement as read. No-op if already read or not found.
 */
export function markRead(id: string): void {
	announcementQueries.markRead(id, new Date().toISOString());
}

/**
 * Flip an announcement back to unread.
 */
export function markUnread(id: string): void {
	announcementQueries.markUnread(id);
}

/**
 * Return the cached versions snapshot payload, or null if no successful
 * sync has happened yet. Parsed on read for caller convenience.
 */
export function getVersionsSnapshot(): { payload: BulletinVersionsFile; fetchedAt: string } | null {
	const row = versionsSnapshotQueries.get();
	if (!row) return null;
	try {
		const payload = JSON.parse(row.payload) as BulletinVersionsFile;
		return { payload, fetchedAt: row.fetched_at };
	} catch {
		// Corrupted cache — treat as absent.
		return null;
	}
}

/**
 * Reconcile result reported back to the job handler. The handler uses
 * `newlyInserted` to fire notifications.
 */
export interface ReconcileReport {
	announcements: 'ok' | 'failed';
	versions: 'ok' | 'failed';
	newlyInserted: AnnouncementRecord[];
}

/**
 * Run a full sync cycle: fetch both files, reconcile announcements into
 * SQLite, overwrite the versions snapshot. Each half is independent — a
 * failed versions fetch does not block the announcements reconcile and
 * vice versa.
 */
export async function reconcileFromBulletin(): Promise<ReconcileReport> {
	const fetchedAt = new Date().toISOString();

	const versionsResult = await fetchVersions();
	let versionsStatus: 'ok' | 'failed' = 'failed';
	if (versionsResult.ok) {
		try {
			if (versionsResult.data.schema !== 1) {
				await logger.warn('Unsupported versions.json schema, ignoring', {
					source: 'AnnouncementsService',
					meta: { schema: versionsResult.data.schema }
				});
			} else {
				versionsSnapshotQueries.set(JSON.stringify(versionsResult.data), fetchedAt);
				versionsStatus = 'ok';
			}
		} catch (error) {
			await logger.warn('Failed to persist versions snapshot', {
				source: 'AnnouncementsService',
				meta: { error: String(error) }
			});
		}
	} else {
		await logger.warn('versions.json fetch failed', {
			source: 'AnnouncementsService',
			meta: { error: versionsResult.error }
		});
	}

	const announcementsResult = await fetchAnnouncements();
	let announcementsStatus: 'ok' | 'failed' = 'failed';
	let newlyInserted: AnnouncementRecord[] = [];

	if (announcementsResult.ok) {
		try {
			const existing = announcementQueries.listAll();
			const plan = reconcileAnnouncements(announcementsResult.data, existing);
			await applyPlan(plan, fetchedAt);
			if (plan.droppedCount > 0) {
				await logger.warn(`Dropped ${plan.droppedCount} announcements beyond cap`, {
					source: 'AnnouncementsService'
				});
			}
			newlyInserted = plan.newlyInserted
				.map((a) => {
					const row = announcementQueries.getById(a.id);
					return row ? rowToRecord(row) : null;
				})
				.filter((r): r is AnnouncementRecord => r !== null);
			announcementsStatus = 'ok';
		} catch (error) {
			if (error instanceof UnsupportedSchemaError) {
				await logger.warn('Unsupported announcements.json schema, ignoring', {
					source: 'AnnouncementsService',
					meta: { schema: error.schema }
				});
			} else {
				await logger.error('Failed to reconcile announcements', {
					source: 'AnnouncementsService',
					meta: { error: String(error) }
				});
			}
		}
	} else {
		await logger.warn('announcements.json fetch failed', {
			source: 'AnnouncementsService',
			meta: { error: announcementsResult.error }
		});
	}

	return {
		announcements: announcementsStatus,
		versions: versionsStatus,
		newlyInserted
	};
}

async function applyPlan(plan: ReconcilePlan, fetchedAt: string): Promise<void> {
	await db.transaction(() => {
		for (const a of plan.upserts) {
			announcementQueries.upsertFromBulletin(a, fetchedAt);
		}
		if (plan.withdrawnIds.length > 0) {
			announcementQueries.markWithdrawn(plan.withdrawnIds);
		}
		if (plan.unwithdrawnIds.length > 0) {
			announcementQueries.markUnwithdrawn(plan.unwithdrawnIds);
		}
	});
}
