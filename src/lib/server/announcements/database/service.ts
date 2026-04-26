/**
 * Per-database (PCD) announcements service.
 *
 * Reads the working copy of a linked database, reconciles the announcement
 * files into the `database_announcements` table, and reports which entries
 * are newly inserted so the caller (the pcd.sync job handler) can fire
 * `announcement.new` notifications.
 *
 * First-sync detection: when a database has no rows yet in the table, all
 * inserts during this pass are marked as already-read (`read_at = NOW`)
 * and excluded from `newlyInserted`. This prevents notification spam when
 * a user newly links a PCD that already has historical announcements
 * published.
 */

import { db } from '$db/db.ts';
import { databaseAnnouncementQueries } from '$db/queries/databaseAnnouncements.ts';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { logger } from '$logger/logger.ts';
import { notificationManager } from '$notifications/NotificationManager.ts';
import { notifications } from '$notifications/definitions/index.ts';
import { reconcile } from '../shared/reconcile.ts';
import type { ReconcilePlan } from '../shared/types.ts';
import { parseAnnouncementsDir, type ParseError } from './parser.ts';
import {
	rowToRecord,
	type DatabaseAnnouncementParsed,
	type DatabaseAnnouncementRecord
} from './types.ts';
import { getPCDPath } from '$pcd/utils/operations.ts';

/** Match the bulletin cap. Misbehaving PCDs can't blow up the table. */
export const DATABASE_ANNOUNCEMENTS_CAP = 1000;

/** Source tag for log entries. */
const LOG_SOURCE = 'announcements.database.service';

export interface DatabaseReconcileReport {
	status: 'ok' | 'failed';
	databaseId: number;
	/** Empty when the database id is unknown. Used by the notification handler. */
	databaseName: string;
	/**
	 * Records that were inserted during this pass and should fire an
	 * `announcement.new` notification. Empty during first-sync (silent
	 * insert) and when nothing changed.
	 */
	newlyInserted: DatabaseAnnouncementRecord[];
	/** Parser failures encountered during this pass. Already logged. */
	parseErrors: ParseError[];
	/** True when this pass was the first reconcile for this database. */
	firstSync: boolean;
	/** Counts for the job handler's output line. */
	counts: {
		upserts: number;
		withdrawn: number;
		unwithdrawn: number;
		dropped: number;
	};
}

export interface ReconcileOptions {
	/**
	 * When true, every newly-inserted row is marked as already-read
	 * (`read_at = NOW`) and excluded from `newlyInserted`. Use this when
	 * the user is being introduced to a backlog (newly-linked PCD with
	 * historical announcements) so they aren't pinged once per item.
	 *
	 * Callers must determine this from a stable signal: typically
	 * `!instance.last_synced_at` captured BEFORE the sync runs, since
	 * the sync paths update `last_synced_at` as part of their work.
	 *
	 * Required (no fallback) on purpose: a fallback like "no rows for
	 * this database yet" would silence the maintainer's first published
	 * announcement on a long-linked DB, which is the opposite of what
	 * we want.
	 */
	isFirstSync: boolean;
}

/**
 * Run a full reconcile pass for one database. Reads the working copy,
 * parses announcement files, applies the diff transactionally, and
 * returns a report the caller uses to fire notifications.
 *
 * Failures here are logged but do not throw, mirroring the bulletin
 * service: a broken file or missing directory must not fail the parent
 * `pcd.sync` job.
 */
export async function reconcileFromWorkingCopy(
	databaseId: number,
	opts: ReconcileOptions
): Promise<DatabaseReconcileReport> {
	const empty = (status: 'ok' | 'failed', name = ''): DatabaseReconcileReport => ({
		status,
		databaseId,
		databaseName: name,
		newlyInserted: [],
		parseErrors: [],
		firstSync: opts.isFirstSync,
		counts: { upserts: 0, withdrawn: 0, unwithdrawn: 0, dropped: 0 }
	});

	const instance = databaseInstancesQueries.getById(databaseId);
	if (!instance) {
		await logger.warn('reconcileFromWorkingCopy called with unknown database id', {
			source: LOG_SOURCE,
			meta: { databaseId }
		});
		return empty('failed');
	}

	const pcdPath = getPCDPath(instance.uuid);

	let parsed: DatabaseAnnouncementParsed[];
	let parseErrors: ParseError[];
	try {
		const result = await parseAnnouncementsDir(pcdPath);
		parsed = result.parsed;
		parseErrors = result.errors;
	} catch (error) {
		await logger.error('Failed to read announcements directory', {
			source: LOG_SOURCE,
			meta: { databaseId, pcdPath, error: describe(error) }
		});
		return empty('failed', instance.name);
	}

	if (parseErrors.length > 0) {
		await logger.warn(`Skipped ${parseErrors.length} malformed announcement file(s)`, {
			source: LOG_SOURCE,
			meta: { databaseId, errors: parseErrors }
		});
	}

	const fetchedAt = new Date().toISOString();
	const firstSync = opts.isFirstSync;
	const readAtOnInsert = firstSync ? fetchedAt : null;

	const existing = databaseAnnouncementQueries.listForDatabase(databaseId);
	const plan: ReconcilePlan<DatabaseAnnouncementParsed> = reconcile(parsed, existing, {
		cap: DATABASE_ANNOUNCEMENTS_CAP
	});

	if (plan.droppedCount > 0) {
		await logger.warn(`Dropped ${plan.droppedCount} announcements beyond cap`, {
			source: LOG_SOURCE,
			meta: { databaseId, cap: DATABASE_ANNOUNCEMENTS_CAP }
		});
	}

	try {
		await db.transaction(() => {
			for (const a of plan.upserts) {
				databaseAnnouncementQueries.upsertFromParsed(a, databaseId, fetchedAt, readAtOnInsert);
			}
			if (plan.withdrawnIds.length > 0) {
				databaseAnnouncementQueries.markWithdrawn(plan.withdrawnIds, databaseId);
			}
			if (plan.unwithdrawnIds.length > 0) {
				databaseAnnouncementQueries.markUnwithdrawn(plan.unwithdrawnIds, databaseId);
			}
		});
	} catch (error) {
		await logger.error('Failed to apply database announcement reconcile plan', {
			source: LOG_SOURCE,
			meta: { databaseId, error: describe(error) }
		});
		return {
			...empty('failed', instance.name),
			parseErrors,
			firstSync
		};
	}

	// Suppress notifications on first sync. The user just linked the
	// database; firing one notification per historical announcement would
	// be hostile.
	const newlyInserted: DatabaseAnnouncementRecord[] = firstSync
		? []
		: plan.newlyInserted
				.map((p) => {
					const row = databaseAnnouncementQueries.getById(p.id, databaseId);
					return row ? rowToRecord(row) : null;
				})
				.filter((r): r is DatabaseAnnouncementRecord => r !== null);

	return {
		status: 'ok',
		databaseId,
		databaseName: instance.name,
		newlyInserted,
		parseErrors,
		firstSync,
		counts: {
			upserts: plan.upserts.length,
			withdrawn: plan.withdrawnIds.length,
			unwithdrawn: plan.unwithdrawnIds.length,
			dropped: plan.droppedCount
		}
	};
}

/**
 * Run a reconcile pass and fire `announcement.new` for each net-new entry.
 *
 * Use this from any path that has just brought the working copy of a PCD
 * up to date: the scheduled `pcd.sync` job handler, the manual pull form
 * action. All errors are logged and swallowed: a broken announcement file
 * must never fail the parent action.
 *
 * `isFirstSync` MUST be captured by the caller before any code path that
 * may have updated `last_synced_at`. See `ReconcileOptions.isFirstSync`.
 */
export async function reconcileAndNotify(
	databaseId: number,
	context: { source: string; jobId?: number; isFirstSync: boolean }
): Promise<DatabaseReconcileReport | null> {
	let report: DatabaseReconcileReport;
	try {
		report = await reconcileFromWorkingCopy(databaseId, { isFirstSync: context.isFirstSync });
	} catch (error) {
		await logger.error('Database announcements reconcile threw unexpectedly', {
			source: context.source,
			meta: { jobId: context.jobId, databaseId, error: describe(error) }
		});
		return null;
	}

	if (report.status === 'failed') return report;

	for (const announcement of report.newlyInserted) {
		try {
			await notificationManager.notify(
				notifications.announcementNew({
					announcement,
					source: { kind: 'pcd', databaseName: report.databaseName }
				})
			);
		} catch (error) {
			await logger.error('Failed to send database announcement notification', {
				source: context.source,
				meta: {
					jobId: context.jobId,
					databaseId,
					announcementId: announcement.id,
					error: describe(error)
				}
			});
		}
	}

	return report;
}

/** Return a single announcement by composite key. Used by the inbox detail view. */
export function getDetail(id: string, databaseId: number): DatabaseAnnouncementRecord | undefined {
	const row = databaseAnnouncementQueries.getById(id, databaseId);
	return row ? rowToRecord(row) : undefined;
}

/** Mark a database announcement as read. */
export function markRead(id: string, databaseId: number): void {
	databaseAnnouncementQueries.markRead(id, databaseId, new Date().toISOString());
}

/** Flip a database announcement back to unread. */
export function markUnread(id: string, databaseId: number): void {
	databaseAnnouncementQueries.markUnread(id, databaseId);
}

function describe(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}
