/**
 * Types shared between the profilarr (bulletin) and database announcement
 * subsystems. Anything specific to one source belongs in that subsystem's
 * own types file.
 */

export type AnnouncementSeverity = 'info' | 'warning' | 'critical';

/**
 * Output of the generic reconcile pass.
 *
 * - `upserts`: every entry in the incoming payload (caller persists each as
 *   insert-or-update, preserving read state and any cached body).
 * - `withdrawnIds`: ids present in the DB but absent from the incoming
 *   payload, and not already withdrawn.
 * - `unwithdrawnIds`: ids in the DB currently marked withdrawn that have
 *   reappeared in the incoming payload.
 * - `newlyInserted`: subset of `upserts` that had no matching DB row. Used
 *   by callers to fire one-shot notifications.
 * - `droppedCount`: entries discarded because the payload exceeded the cap.
 */
export interface ReconcilePlan<T> {
	upserts: T[];
	withdrawnIds: string[];
	unwithdrawnIds: string[];
	newlyInserted: T[];
	droppedCount: number;
}
