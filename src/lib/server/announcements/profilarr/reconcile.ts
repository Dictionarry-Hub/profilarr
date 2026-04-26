/**
 * Bulletin-specific reconcile wrapper.
 *
 * Validates the schema version, then delegates to the generic shared
 * reconcile. Constants and the schema-error type are re-exported here so
 * existing callers don't need to know about the shared module.
 */

import { reconcile } from '../shared/reconcile.ts';
import type { ReconcilePlan } from '../shared/types.ts';
import type { AnnouncementRow, BulletinAnnouncement, BulletinAnnouncementsFile } from './types.ts';

/** Hard cap to prevent a misbehaving bulletin from writing unbounded rows. */
export const ANNOUNCEMENTS_CAP = 1000;

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
): ReconcilePlan<BulletinAnnouncement> {
	if (file.schema !== 1) {
		throw new UnsupportedSchemaError(file.schema);
	}
	return reconcile(file.announcements, existingRows, { cap: ANNOUNCEMENTS_CAP });
}
