/**
 * Generic reconciliation between an incoming announcements payload and the
 * local SQLite rows for one source (bulletin, a specific PCD, etc.). Given
 * the incoming list and the current rows, decide which ids are new, which
 * disappeared, which reappeared after being withdrawn, and how many entries
 * got dropped because the payload exceeded the sanity cap.
 *
 * Pure: no DB or filesystem access. Each subsystem wraps this with its own
 * source-specific validation (schema check, file IO, etc.) before calling
 * in.
 */

import type { ReconcilePlan } from './types.ts';

/** Anything reconcilable: every entry has a stable id. */
export interface IncomingLike {
	id: string;
}

/** A DB row with at minimum an id and a withdrawn flag (0 or 1). */
export interface RowLike {
	id: string;
	withdrawn: number;
}

export interface ReconcileOptions {
	/** Hard cap on incoming entries per pass. Excess is dropped. */
	cap: number;
}

export function reconcile<TIncoming extends IncomingLike, TRow extends RowLike>(
	incoming: TIncoming[],
	existing: TRow[],
	options: ReconcileOptions
): ReconcilePlan<TIncoming> {
	const total = incoming.length;
	const capped = incoming.slice(0, options.cap);
	const droppedCount = Math.max(0, total - capped.length);

	const existingById = new Map<string, TRow>();
	for (const row of existing) {
		existingById.set(row.id, row);
	}

	const incomingIds = new Set<string>();
	const upserts: TIncoming[] = [];
	const newlyInserted: TIncoming[] = [];
	const unwithdrawnIds: string[] = [];

	for (const entry of capped) {
		incomingIds.add(entry.id);
		upserts.push(entry);
		const existingRow = existingById.get(entry.id);
		if (!existingRow) {
			newlyInserted.push(entry);
		} else if (existingRow.withdrawn === 1) {
			unwithdrawnIds.push(entry.id);
		}
	}

	const withdrawnIds: string[] = [];
	for (const row of existing) {
		if (!incomingIds.has(row.id) && row.withdrawn === 0) {
			withdrawnIds.push(row.id);
		}
	}

	return { upserts, withdrawnIds, unwithdrawnIds, newlyInserted, droppedCount };
}
