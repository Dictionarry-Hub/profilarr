/**
 * Release Import Utilities
 * Helpers for importing releases from Arr interactive search into PCD test releases
 */

import { INDEXER_FLAGS } from '$lib/server/sync/mappings.ts';
import type { SonarrSeries, SonarrSeason, RadarrRelease, SonarrRelease } from './types.ts';

// =============================================================================
// Season Helpers
// =============================================================================

/**
 * Get finished seasons from a series (where all episodes have aired)
 * A season is considered finished when episodeCount === totalEpisodeCount
 */
export function getFinishedSeasons(series: SonarrSeries): SonarrSeason[] {
	return series.seasons.filter((s) => isSeasonFinished(s));
}

/**
 * Check if a specific season is finished
 */
export function isSeasonFinished(season: SonarrSeason): boolean {
	return (
		season.statistics !== undefined &&
		season.statistics.episodeCount === season.statistics.totalEpisodeCount
	);
}

// =============================================================================
// Flag Normalization
// =============================================================================

/**
 * Normalize Radarr indexer flags (string array with G_ prefix)
 * Example: ["G_Freeleech", "G_Internal"] -> ["freeleech", "internal"]
 */
export function normalizeRadarrFlags(flags: string[]): string[] {
	return flags.map((f) => f.replace(/^G_/i, '').toLowerCase().replace(/_/g, ' '));
}

/**
 * Decode Sonarr indexer flags bitmask to string array
 * Example: 9 -> ["freeleech", "internal"]
 */
export function decodeSonarrFlags(bitmask: number): string[] {
	const flags: string[] = [];
	const sonarrFlags = INDEXER_FLAGS.sonarr;

	for (const [name, value] of Object.entries(sonarrFlags)) {
		if (bitmask & value) {
			// Convert snake_case to readable format
			flags.push(name.replace(/_/g, ' '));
		}
	}

	return flags;
}

// =============================================================================
// Indexer Name Sanitization
// =============================================================================

/**
 * Sanitize indexer name by removing common suffixes
 * Example: "PassThePopcorn (Prowlarr)" -> "PassThePopcorn"
 */
export function sanitizeIndexerName(name: string): string {
	return name
		.replace(/\s*\(Prowlarr\)$/i, '')
		.replace(/\s*\(Jackett\)$/i, '')
		.trim();
}

// =============================================================================
// Title Normalization & Similarity
// =============================================================================

/**
 * Normalize a release title for comparison
 * - Lowercase
 * - Replace dots and underscores with spaces
 * - Collapse multiple spaces
 * - Trim
 */
export function normalizeTitle(title: string): string {
	return title.toLowerCase().replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Calculate similarity between two titles using Dice coefficient
 * Returns a value between 0 and 1 (1 = identical)
 */
export function titleSimilarity(title1: string, title2: string): number {
	const norm1 = normalizeTitle(title1);
	const norm2 = normalizeTitle(title2);

	if (norm1 === norm2) return 1;

	// Create bigrams
	const bigrams1 = getBigrams(norm1);
	const bigrams2 = getBigrams(norm2);

	// Calculate intersection
	const intersection = new Set([...bigrams1].filter((b) => bigrams2.has(b)));

	// Dice coefficient: 2 * |intersection| / (|set1| + |set2|)
	return (2 * intersection.size) / (bigrams1.size + bigrams2.size);
}

/**
 * Get bigrams (2-character sequences) from a string
 */
function getBigrams(str: string): Set<string> {
	const bigrams = new Set<string>();
	for (let i = 0; i < str.length - 1; i++) {
		bigrams.add(str.slice(i, i + 2));
	}
	return bigrams;
}

// =============================================================================
// Release Grouping/Deduplication
// =============================================================================

/**
 * Grouped release after deduplication
 */
export interface GroupedRelease {
	title: string;
	size: number;
	indexers: string[];
	languages: string[];
	flags: string[];
	occurrences: number;
}

/**
 * Union helper for arrays (returns unique values)
 */
function union<T>(arr1: T[], arr2: T[]): T[] {
	return [...new Set([...arr1, ...arr2])];
}

/**
 * Group Radarr releases by similarity
 * Releases are grouped if title similarity > threshold AND size within tolerance
 *
 * @param releases - Raw releases from Radarr API
 * @param titleThreshold - Minimum title similarity (0-1, default 0.9)
 * @param sizeTolerance - Maximum size difference as fraction (default 0.05 = 5%)
 */
export function groupRadarrReleases(
	releases: RadarrRelease[],
	titleThreshold = 0.9,
	sizeTolerance = 0.05
): GroupedRelease[] {
	const groups: GroupedRelease[] = [];

	for (const release of releases) {
		const match = groups.find((g) => {
			const similarity = titleSimilarity(g.title, release.title);
			const sizeDiff = Math.abs(g.size - release.size) / Math.max(g.size, 1);
			return similarity > titleThreshold && sizeDiff < sizeTolerance;
		});

		const languages = release.languages.map((l) => l.name);
		const flags = normalizeRadarrFlags(release.indexerFlags);
		const indexer = sanitizeIndexerName(release.indexer);

		if (match) {
			match.indexers = union(match.indexers, [indexer]);
			match.languages = union(match.languages, languages);
			match.flags = union(match.flags, flags);
			match.occurrences++;
		} else {
			groups.push({
				title: release.title,
				size: release.size,
				indexers: [indexer],
				languages,
				flags,
				occurrences: 1
			});
		}
	}

	return groups;
}

/**
 * Group Sonarr releases by similarity
 * Same as Radarr but handles the integer bitmask for flags
 *
 * @param releases - Raw releases from Sonarr API
 * @param titleThreshold - Minimum title similarity (0-1, default 0.9)
 * @param sizeTolerance - Maximum size difference as fraction (default 0.05 = 5%)
 */
export function groupSonarrReleases(
	releases: SonarrRelease[],
	titleThreshold = 0.9,
	sizeTolerance = 0.05
): GroupedRelease[] {
	const groups: GroupedRelease[] = [];

	for (const release of releases) {
		const match = groups.find((g) => {
			const similarity = titleSimilarity(g.title, release.title);
			const sizeDiff = Math.abs(g.size - release.size) / Math.max(g.size, 1);
			return similarity > titleThreshold && sizeDiff < sizeTolerance;
		});

		const languages = release.languages.map((l) => l.name);
		const flags = decodeSonarrFlags(release.indexerFlags);
		const indexer = sanitizeIndexerName(release.indexer);

		if (match) {
			match.indexers = union(match.indexers, [indexer]);
			match.languages = union(match.languages, languages);
			match.flags = union(match.flags, flags);
			match.occurrences++;
		} else {
			groups.push({
				title: release.title,
				size: release.size,
				indexers: [indexer],
				languages,
				flags,
				occurrences: 1
			});
		}
	}

	return groups;
}
