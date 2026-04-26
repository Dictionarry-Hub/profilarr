/**
 * Visibility logic shared across announcement sources.
 *
 * The bulletin and per-database subsystems both honour `withdrawn` and
 * `expiresAt`. Source-specific rules (bulletin's min/max version bounds)
 * live in that subsystem's own filter module.
 */

export interface ExpirableRecord {
	withdrawn: boolean;
	expiresAt: string | null;
}

/**
 * Returns true if the record is not withdrawn and either has no expiry or
 * its expiry is still in the future relative to `now`.
 */
export function isVisibleBase(record: ExpirableRecord, now: string): boolean {
	if (record.withdrawn) return false;
	if (record.expiresAt !== null && record.expiresAt < now) return false;
	return true;
}
