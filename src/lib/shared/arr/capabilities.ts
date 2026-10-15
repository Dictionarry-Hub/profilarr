/**
 * What an Arr instance can do, derived from what it reported on the last
 * version probe (see `src/lib/server/utils/arr/version.ts`). Pure, so the
 * server and the UI reach the same answer from the same row.
 */

export interface ArrVersionFields {
	type: string;
	detected_version: string | null;
	detected_api: string | null;
}

/** Leading number of a version string such as "5.0.0.2569"; null if there is none. */
export function versionMajor(version: string | null | undefined): number | null {
	const match = /^(\d+)(?:\.|$)/.exec(version ?? '');
	return match ? Number(match[1]) : null;
}

/** Number of an API generation such as "v5"; null if it is not in that form. */
export function apiGeneration(api: string | null | undefined): number | null {
	const match = /^v(\d+)$/i.exec(api ?? '');
	return match ? Number(match[1]) : null;
}

/**
 * Sonarr v5 stores quality size limits (min, max, preferred) on each quality
 * profile item instead of in the global quality definitions. The reported API
 * generation decides; the version major is the fallback for instances whose
 * /api route gave no answer.
 */
export function hasProfileItemSizes(instance: ArrVersionFields): boolean {
	if (instance.type !== 'sonarr') return false;
	const generation = apiGeneration(instance.detected_api);
	if (generation !== null) return generation >= 5;
	const major = versionMajor(instance.detected_version);
	return major !== null && major >= 5;
}

/**
 * Support for this instance's version is still experimental. Today that is
 * exactly the per-profile size model of Sonarr v5.
 */
export function isExperimentalVersion(instance: ArrVersionFields): boolean {
	return hasProfileItemSizes(instance);
}
