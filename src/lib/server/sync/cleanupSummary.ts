/**
 * The cleanup job stores its result as a one-line summary in job history.
 * `formatCleanupSummary` writes it and `parseCleanupRemoved` reads the count
 * back for the Arr card, so the two must change together.
 */

const NOTHING = 'Nothing to clean up';
const DELETED = /^Deleted (\d+) stale config\(s\), (\d+) removed entit(?:y|ies)$/;

export function formatCleanupSummary(deletedConfigs: number, deletedEntities: number): string {
	if (deletedConfigs + deletedEntities === 0) return NOTHING;
	return `Deleted ${deletedConfigs} stale config(s), ${deletedEntities} removed entit${deletedEntities === 1 ? 'y' : 'ies'}`;
}

/** Total items a cleanup run removed, or null if the summary isn't a cleanup result. */
export function parseCleanupRemoved(summary: string | null): number | null {
	if (summary === NOTHING) return 0;
	const match = summary?.match(DELETED);
	if (!match) return null;
	return Number(match[1]) + Number(match[2]);
}
