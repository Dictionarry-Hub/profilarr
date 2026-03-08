/**
 * Normalization logic for converting arr library items to UpgradeItem
 * Maps raw API responses to the normalized interface used by filter evaluation
 */

import type {
	RadarrMovie,
	RadarrMovieFile,
	SonarrSeries,
	ArrQualityProfile
} from '$lib/server/utils/arr/types.ts';
import type { UpgradeItem } from './types.ts';

/**
 * Normalize a Radarr movie to an UpgradeItem for filter evaluation
 *
 * @param movie - The raw movie from Radarr API
 * @param movieFile - The movie file (if exists)
 * @param profile - The quality profile
 * @param cutoffPercent - The cutoff percentage from filter config (0-100)
 * @param tagMap - Map of tag IDs to labels for resolving tag names
 */
export function normalizeRadarrItem(
	movie: RadarrMovie,
	movieFile: RadarrMovieFile | undefined,
	profile: ArrQualityProfile | undefined,
	cutoffPercent: number,
	tagMap?: Map<number, string>
): UpgradeItem {
	// Calculate current score
	const currentScore = movieFile?.customFormatScore ?? 0;

	// Calculate cutoff threshold based on profile and filter's cutoff percent
	const profileCutoff = profile?.cutoffFormatScore ?? 0;
	const cutoffThreshold = (profileCutoff * cutoffPercent) / 100;

	// Determine if cutoff is met
	const cutoffMet = currentScore >= cutoffThreshold;

	// Convert size to GB
	const sizeOnDiskGB = (movie.sizeOnDisk ?? 0) / (1024 * 1024 * 1024);

	// Extract ratings with fallbacks
	const tmdbRating = movie.ratings?.tmdb?.value ?? 0;
	const imdbRating = movie.ratings?.imdb?.value ?? 0;
	const tomatoRating = movie.ratings?.rottenTomatoes?.value ?? 0;
	const traktRating = movie.ratings?.trakt?.value ?? 0;

	// Date added - use movie's added date
	const dateAdded = movie.added ?? new Date().toISOString();

	// Release dates (null if not available)
	const digitalRelease = movie.digitalRelease ?? null;
	const physicalRelease = movie.physicalRelease ?? null;

	// Convert tag IDs to labels
	const tags = (movie.tags ?? [])
		.map((tagId) => tagMap?.get(tagId) ?? '')
		.filter(Boolean)
		.join(', ');

	return {
		// Shared fields
		id: movie.id,
		title: movie.title,
		year: movie.year ?? 0,
		monitored: movie.monitored ?? false,
		cutoff_met: cutoffMet,
		quality_profile: profile?.name ?? 'Unknown',
		original_language: movie.originalLanguage?.name ?? '',
		genres: movie.genres?.join(', ') ?? '',
		tags,
		rating: tmdbRating,
		runtime: movie.runtime ?? 0,
		size_on_disk: sizeOnDiskGB,
		date_added: dateAdded,

		// Radarr-specific fields
		minimum_availability: movie.minimumAvailability ?? 'released',
		collection: movie.collection?.title ?? movie.collection?.name ?? '',
		studio: movie.studio ?? '',
		keywords: movie.keywords?.join(', ') ?? '',
		release_group: movieFile?.releaseGroup ?? '',
		popularity: movie.popularity ?? 0,
		tmdb_rating: tmdbRating,
		imdb_rating: imdbRating,
		tomato_rating: tomatoRating,
		trakt_rating: traktRating,
		digital_release: digitalRelease,
		physical_release: physicalRelease,

		// Radarr status (actual release state)
		status: movie.status ?? '',
		network: '',
		series_type: '',
		certification: '',
		season_count: 0,
		episode_count: 0,
		episode_file_count: 0,
		first_aired: null,
		last_aired: null,

		// For selectors (camelCase)
		dateAdded: dateAdded,
		score: currentScore,

		// Original data
		_raw: movie,
		_tags: movie.tags ?? []
	};
}

/**
 * Normalize a batch of Radarr movies
 */
export function normalizeRadarrItems(
	movies: RadarrMovie[],
	movieFileMap: Map<number, RadarrMovieFile>,
	profileMap: Map<number, ArrQualityProfile>,
	cutoffPercent: number,
	tagMap?: Map<number, string>
): UpgradeItem[] {
	return movies.map((movie) => {
		const movieFile = movieFileMap.get(movie.id);
		const profile = profileMap.get(movie.qualityProfileId);
		return normalizeRadarrItem(movie, movieFile, profile, cutoffPercent, tagMap);
	});
}

/**
 * Normalize a Sonarr series to an UpgradeItem for filter evaluation
 *
 * @param series - The raw series from Sonarr API
 * @param profile - The quality profile
 * @param cutoffPercent - The cutoff percentage from filter config (0-100)
 * @param tagMap - Map of tag IDs to labels for resolving tag names
 */
export function normalizeSonarrItem(
	series: SonarrSeries,
	profile: ArrQualityProfile | undefined,
	_cutoffPercent: number,
	tagMap?: Map<number, string>
): UpgradeItem {
	// Score: 0 for now (series-level score requires fetching all episode files)
	const currentScore = 0;

	// Cutoff: always false for now (no series-level score)
	const cutoffMet = false;

	// Convert size to GB
	const sizeOnDiskGB = (series.statistics?.sizeOnDisk ?? 0) / (1024 * 1024 * 1024);

	// Date added
	const dateAdded = series.added ?? new Date().toISOString();

	// Convert tag IDs to labels
	const tags = (series.tags ?? [])
		.map((tagId) => tagMap?.get(tagId) ?? '')
		.filter(Boolean)
		.join(', ');

	return {
		// Shared fields
		id: series.id,
		title: series.title,
		year: series.year ?? 0,
		monitored: series.monitored,
		cutoff_met: cutoffMet,
		quality_profile: profile?.name ?? 'Unknown',
		original_language: series.originalLanguage?.name ?? '',
		genres: series.genres?.join(', ') ?? '',
		tags,
		rating: series.ratings?.value ?? 0,
		runtime: series.runtime ?? 0,
		size_on_disk: sizeOnDiskGB,
		date_added: dateAdded,

		// Radarr fields (defaults for Sonarr)
		minimum_availability: '',
		collection: '',
		studio: '',
		keywords: '',
		release_group: '',
		popularity: 0,
		tmdb_rating: 0,
		imdb_rating: 0,
		tomato_rating: 0,
		trakt_rating: 0,
		digital_release: null,
		physical_release: null,

		// Sonarr-specific fields
		status: series.status ?? '',
		network: series.network ?? '',
		series_type: series.seriesType ?? '',
		certification: series.certification ?? '',
		season_count: series.statistics?.seasonCount ?? series.seasons.length,
		episode_count: series.statistics?.episodeCount ?? 0,
		episode_file_count: series.statistics?.episodeFileCount ?? 0,
		first_aired: series.firstAired ?? null,
		last_aired: series.lastAired ?? null,

		// For selectors (camelCase)
		dateAdded: dateAdded,
		score: currentScore,

		// Original data
		_raw: series,
		_tags: series.tags ?? []
	};
}

/**
 * Normalize a batch of Sonarr series
 */
export function normalizeSonarrItems(
	seriesList: SonarrSeries[],
	profileMap: Map<number, ArrQualityProfile>,
	cutoffPercent: number,
	tagMap?: Map<number, string>
): UpgradeItem[] {
	return seriesList.map((series) => {
		const profile = profileMap.get(series.qualityProfileId);
		return normalizeSonarrItem(series, profile, cutoffPercent, tagMap);
	});
}
