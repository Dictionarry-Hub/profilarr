/**
 * Tag-based cooldown tracking for upgrade searches
 *
 * Basic mode (current implementation):
 * - Uses filter-level tags: profilarr-filter-{filterId}
 * - Items are tagged when searched
 * - Tagged items are skipped on subsequent runs
 * - When filter is exhausted (no untagged items), all tags are cleared to reset
 *
 * Future: Advanced mode with adaptive backoff per scratchpad.md
 */

import type { ArrTag, RadarrMovie, SonarrSeries } from '$lib/server/utils/arr/types.ts';
import type { RadarrClient } from '$lib/server/utils/arr/clients/radarr.ts';
import type { SonarrClient } from '$lib/server/utils/arr/clients/sonarr.ts';

export { getFilterTagLabel, resolveTagLabel } from '$shared/upgrades/filters.ts';

const FILTER_TAG_PREFIX = 'profilarr-';

/**
 * Check if a tag label is a profilarr filter tag
 */
export function isFilterTag(label: string): boolean {
	return label.startsWith(FILTER_TAG_PREFIX);
}

/**
 * Check if an item has a specific tag by label
 */
export function hasFilterTag(itemTagIds: number[], allTags: ArrTag[], tagLabel: string): boolean {
	const tagMap = new Map(allTags.map((t) => [t.id, t.label]));

	for (const tagId of itemTagIds) {
		const label = tagMap.get(tagId);
		if (label?.toLowerCase() === tagLabel.toLowerCase()) {
			return true;
		}
	}

	return false;
}

/**
 * Filter items that do NOT have the given tag
 * Returns only items eligible for searching (not yet searched by this filter)
 */
export function filterByFilterTag<T extends { _tags: number[] }>(
	items: T[],
	allTags: ArrTag[],
	tagLabel: string
): T[] {
	return items.filter((item) => !hasFilterTag(item._tags, allTags, tagLabel));
}

// =========================================================================
// Radarr-specific tag functions
// =========================================================================

/**
 * Apply a filter's tag to a movie
 * Adds the tag to the movie's existing tags and updates via API
 */
export async function applyFilterTag(
	client: RadarrClient,
	movie: RadarrMovie,
	tagId: number
): Promise<RadarrMovie> {
	const currentTags = movie.tags ?? [];
	if (currentTags.includes(tagId)) {
		return movie; // Already has the tag
	}

	const updatedMovie = {
		...movie,
		tags: [...currentTags, tagId]
	};

	return await client.updateMovie(updatedMovie);
}

/**
 * Apply filter tag to multiple movies
 */
export async function applyFilterTagToMovies(
	client: RadarrClient,
	movies: RadarrMovie[],
	tagId: number
): Promise<{ success: number; failed: number; errors: string[] }> {
	let success = 0;
	let failed = 0;
	const errors: string[] = [];

	for (const movie of movies) {
		try {
			await applyFilterTag(client, movie, tagId);
			success++;
		} catch (error) {
			failed++;
			errors.push(
				`Failed to tag "${movie.title}": ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	return { success, failed, errors };
}

/**
 * Remove a filter's tag from a single movie
 */
export async function removeFilterTag(
	client: RadarrClient,
	movie: RadarrMovie,
	tagId: number
): Promise<RadarrMovie> {
	const currentTags = movie.tags ?? [];
	if (!currentTags.includes(tagId)) {
		return movie; // Doesn't have the tag
	}

	const updatedMovie = {
		...movie,
		tags: currentTags.filter((id) => id !== tagId)
	};

	return await client.updateMovie(updatedMovie);
}

/**
 * Reset filter cooldown by removing the filter's tag from all movies that have it
 * Called when a filter is "exhausted" (no more untagged items to search)
 *
 * @returns Count of movies that had their tags removed
 */
export async function resetFilterCooldown(
	client: RadarrClient,
	tagLabel: string
): Promise<{ reset: number; failed: number; errors: string[] }>;
/**
 * Reset filter cooldown for Sonarr — bulk removes the tag from all tagged series
 */
export async function resetFilterCooldown(
	client: SonarrClient,
	tagLabel: string
): Promise<{ reset: number; failed: number; errors: string[] }>;
export async function resetFilterCooldown(
	client: RadarrClient | SonarrClient,
	tagLabel: string
): Promise<{ reset: number; failed: number; errors: string[] }> {
	// Find the tag ID
	const tags = await client.getTags();
	const filterTag = tags.find((t) => t.label.toLowerCase() === tagLabel.toLowerCase());

	if (!filterTag) {
		return { reset: 0, failed: 0, errors: [] };
	}

	// Branch by client type
	if ('getMovies' in client) {
		// Radarr: fetch all movies, remove tag one by one
		const radarrClient = client as RadarrClient;
		const movies = await radarrClient.getMovies();
		const taggedMovies = movies.filter((m) => m.tags?.includes(filterTag.id));

		if (taggedMovies.length === 0) {
			return { reset: 0, failed: 0, errors: [] };
		}

		let reset = 0;
		let failed = 0;
		const errors: string[] = [];

		for (const movie of taggedMovies) {
			try {
				await removeFilterTag(radarrClient, movie, filterTag.id);
				reset++;
			} catch (error) {
				failed++;
				errors.push(
					`Failed to untag "${movie.title}": ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}

		return { reset, failed, errors };
	} else {
		// Sonarr: fetch all series, bulk remove tag
		const sonarrClient = client as SonarrClient;
		const allSeries = await sonarrClient.getAllSeries();
		const taggedSeries = allSeries.filter((s) => s.tags?.includes(filterTag.id));

		if (taggedSeries.length === 0) {
			return { reset: 0, failed: 0, errors: [] };
		}

		try {
			const seriesIds = taggedSeries.map((s) => s.id);
			await sonarrClient.removeTagFromSeries(seriesIds, filterTag.id);
			return { reset: taggedSeries.length, failed: 0, errors: [] };
		} catch (error) {
			return {
				reset: 0,
				failed: taggedSeries.length,
				errors: [
					`Failed to bulk untag series: ${error instanceof Error ? error.message : String(error)}`
				]
			};
		}
	}
}

// =========================================================================
// Sonarr-specific tag functions
// =========================================================================

/**
 * Apply filter tag to multiple series using bulk editor endpoint
 */
export async function applyFilterTagToSeries(
	client: SonarrClient,
	seriesList: SonarrSeries[],
	tagId: number
): Promise<{ success: number; failed: number; errors: string[] }> {
	// Filter to only series that don't already have the tag
	const untagged = seriesList.filter((s) => !(s.tags ?? []).includes(tagId));

	if (untagged.length === 0) {
		return { success: seriesList.length, failed: 0, errors: [] };
	}

	try {
		const seriesIds = untagged.map((s) => s.id);
		await client.applyTagToSeries(seriesIds, tagId);
		return { success: seriesList.length, failed: 0, errors: [] };
	} catch (error) {
		return {
			success: 0,
			failed: seriesList.length,
			errors: [
				`Failed to bulk tag series: ${error instanceof Error ? error.message : String(error)}`
			]
		};
	}
}

/**
 * Check if a filter is exhausted (all matched items are tagged)
 * When true, the filter should be reset before the next run
 */
export function isFilterExhausted<T extends { _tags: number[] }>(
	matchedItems: T[],
	allTags: ArrTag[],
	tagLabel: string
): boolean {
	const untaggedItems = filterByFilterTag(matchedItems, allTags, tagLabel);
	return untaggedItems.length === 0 && matchedItems.length > 0;
}
