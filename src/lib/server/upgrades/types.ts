/**
 * Types for the upgrade processing system
 */

import type { RadarrMovie, SonarrSeries } from '$lib/server/utils/arr/types.ts';
import type { FilterGroup } from '$shared/upgrades/filters.ts';

/**
 * Normalized item interface that matches filter field names
 * Used for evaluating filter rules against library items
 */
export interface UpgradeItem {
	// Shared fields
	id: number;
	title: string;
	year: number;
	monitored: boolean;
	cutoff_met: boolean;
	quality_profile: string;
	original_language: string;
	genres: string;
	tags: string;
	rating: number;
	runtime: number;
	size_on_disk: number;
	date_added: string;

	// Radarr-only fields (empty/zero defaults for Sonarr)
	minimum_availability: string;
	collection: string;
	studio: string;
	keywords: string;
	release_group: string;
	popularity: number;
	tmdb_rating: number;
	imdb_rating: number;
	tomato_rating: number;
	trakt_rating: number;
	digital_release: string | null;
	physical_release: string | null;

	// Sonarr-only fields (empty/zero defaults for Radarr)
	status: string;
	network: string;
	series_type: string;
	certification: string;
	season_count: number;
	episode_count: number;
	episode_file_count: number;
	first_aired: string | null;
	last_aired: string | null;

	// For selectors (camelCase versions)
	dateAdded: string;
	score: number;

	// Original data for API calls
	_raw: RadarrMovie | SonarrSeries;
	_tags: number[];
}

/**
 * Original file info for upgrade comparison
 */
export interface UpgradeOriginalFile {
	type: 'movie';
	fileName: string;
	formats: string[];
	score: number;
}

export interface UpgradeOriginalEpisode {
	seasonNumber: number;
	fileName: string;
	formats: string[];
	score: number;
}

export interface UpgradeOriginalSeries {
	type: 'series';
	title: string;
	episodes: UpgradeOriginalEpisode[];
}

export type UpgradeOriginal = UpgradeOriginalFile | UpgradeOriginalSeries;

/**
 * Upgrade/new release info
 */
export interface UpgradeNewRelease {
	release: string; // release title
	formats: string[];
	score: number;
	seasonNumber?: number; // Sonarr only — which season this grab is for
}

/**
 * Selection item with score comparison details
 */
export interface UpgradeSelectionItem {
	id: number;
	title: string;
	original: UpgradeOriginal;
	upgrades: UpgradeNewRelease[];
	imageUrl?: string;
}

/**
 * Structured log for each upgrade run
 * Contains all metrics and details about what happened
 */
export interface UpgradeJobLog {
	id: string; // UUID
	configId: number;
	instanceId: number;
	instanceName: string;
	startedAt: string;
	completedAt: string;
	status: 'success' | 'partial' | 'failed' | 'skipped';

	config: {
		cron: string;
		filterMode: string;
		selectedFilter: string;
		dryRun: boolean;
	};

	library: {
		totalItems: number;
		fetchedFromCache: boolean;
		fetchDurationMs: number;
	};

	filter: {
		id: string;
		name: string;
		rules: FilterGroup;
		matchedCount: number;
		afterCooldown: number;
		dryRunExcluded: number;
	};

	selection: {
		method: string;
		requestedCount: number;
		actualCount: number;
		items: UpgradeSelectionItem[];
	};

	results: {
		searchesTriggered: number;
		successful: number;
		failed: number;
		errors: string[];
	};
}

/**
 * Result from processing a single upgrade config
 */
export interface UpgradeProcessResult {
	success: boolean;
	log: UpgradeJobLog;
	error?: string;
}
