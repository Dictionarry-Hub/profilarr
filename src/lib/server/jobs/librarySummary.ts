/**
 * The library refresh job stores its result as a one-line summary in job
 * history. `formatLibrarySummary` writes it and `parseLibraryCount` reads the
 * count back for the Arr card, so the two must change together.
 */

const CACHED = /^Cached (\d+) item\(s\)$/;

export function formatLibrarySummary(itemCount: number): string {
	return `Cached ${itemCount} item(s)`;
}

/** Items a library refresh cached, or null if the summary isn't a refresh result. */
export function parseLibraryCount(summary: string | null): number | null {
	const match = summary?.match(CACHED);
	return match ? Number(match[1]) : null;
}
