/**
 * Pure visibility logic for bulletin announcements.
 *
 * Used both when counting unread badge items and when serving the list to
 * the UI / API. No DB or I/O; everything here is derivable from a record
 * plus the running build's channel + version and the current time.
 */

import { isVisibleBase } from '../shared/filter.ts';
import type { AnnouncementSeverity } from '../shared/types.ts';
import type { AnnouncementRecord } from './types.ts';
import type { Channel } from '$lib/shared/build.ts';

export type { AnnouncementSeverity };

export interface VisibilityContext {
	/** ISO-8601 string representing "now". Typically `new Date().toISOString()`. */
	now: string;
	/** Build version (e.g. "2.3.0") or any dev-build sentinel. */
	version: string;
	/** Running channel. */
	channel: Channel;
}

/**
 * Compare two SemVer-ish strings numerically.
 *
 * Returns -1 if a < b, 0 if equal, 1 if a > b. Ignores anything after a `-`
 * suffix (e.g. rc tags) so prereleases compare to their base version.
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
	const pa = a
		.split('-')[0]
		.split('.')
		.map((n) => parseInt(n, 10));
	const pb = b
		.split('-')[0]
		.split('.')
		.map((n) => parseInt(n, 10));
	const len = Math.max(pa.length, pb.length);
	for (let i = 0; i < len; i++) {
		const ai = pa[i] ?? 0;
		const bi = pb[i] ?? 0;
		if (Number.isNaN(ai) || Number.isNaN(bi)) {
			// Non-numeric component: fall back to string compare of the raw prefix.
			const sa = a.split('-')[0];
			const sb = b.split('-')[0];
			if (sa < sb) return -1;
			if (sa > sb) return 1;
			return 0;
		}
		if (ai < bi) return -1;
		if (ai > bi) return 1;
	}
	return 0;
}

/**
 * Returns true if `current` sits within the (optional) `[min, max]` SemVer
 * bounds. Null bounds are treated as unbounded on that end.
 */
export function satisfiesRange(current: string, min: string | null, max: string | null): boolean {
	if (min !== null && compareVersions(current, min) < 0) return false;
	if (max !== null && compareVersions(current, max) > 0) return false;
	return true;
}

/**
 * Should this announcement be shown to the user right now?
 *
 * Rules:
 *  - `withdrawn` → never visible.
 *  - `expiresAt` in the past → not visible.
 *  - `channel === 'dev'` or a version with a `-` suffix → version bounds are
 *    ignored (dev builds see everything).
 *  - Otherwise, must satisfy both `minVersion` and `maxVersion` if set.
 */
export function isVisible(announcement: AnnouncementRecord, ctx: VisibilityContext): boolean {
	if (!isVisibleBase(announcement, ctx.now)) return false;

	// Dev channel or local/prerelease-suffixed versions bypass range checks.
	const isDev = ctx.channel === 'dev' || ctx.version.includes('-');
	if (isDev) return true;

	return satisfiesRange(ctx.version, announcement.minVersion, announcement.maxVersion);
}
