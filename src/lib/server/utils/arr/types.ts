/**
 * Arr Client Types
 */

export type ArrType = 'radarr' | 'sonarr' | 'lidarr' | 'chaptarr';

// =============================================================================
// Shared Types
// =============================================================================

/**
 * Image reference from Arr API (poster, fanart, banner, clearlogo)
 */
export interface ArrImage {
	coverType: string;
	url: string;
	remoteUrl?: string;
}

/**
 * Slim media info extracted from movie/episode files
 */
export interface ArrMediaInfo {
	audioCodec?: string;
	audioChannels?: number;
	videoCodec?: string;
	videoBitDepth?: number;
	videoDynamicRange?: string;
	videoDynamicRangeType?: string;
	resolution?: string;
	subtitles?: string;
}

// =============================================================================
// Radarr Types
// =============================================================================

/**
 * Movie from /api/v3/movie
 */
export interface RadarrMovie {
	id: number;
	title: string;
	originalTitle?: string;
	sortTitle?: string;
	year?: number;
	qualityProfileId: number;
	hasFile: boolean;
	movieFileId?: number;
	monitored?: boolean;
	minimumAvailability?: string;
	runtime?: number;
	tmdbId?: number;
	imdbId?: string;
	added?: string;
	inCinemas?: string;
	digitalRelease?: string;
	physicalRelease?: string;
	certification?: string;
	ratings?: {
		imdb?: { votes: number; value: number };
		tmdb?: { votes: number; value: number };
		metacritic?: { votes: number; value: number };
		rottenTomatoes?: { votes: number; value: number };
		trakt?: { votes: number; value: number };
	};
	genres?: string[];
	keywords?: string[];
	overview?: string;
	images?: ArrImage[];
	path?: string;
	studio?: string;
	rootFolderPath?: string;
	sizeOnDisk?: number;
	status?: string;
	tags?: number[];
	collection?: {
		title?: string;
		name?: string; // Deprecated, use title
		tmdbId?: number;
	};
	popularity?: number;
	originalLanguage?: {
		id: number;
		name: string;
	};
}

/**
 * Custom format reference (minimal, as returned in movie file)
 */
export interface CustomFormatRef {
	id: number;
	name: string;
}

/**
 * Movie file from /api/v3/moviefile
 */
export interface RadarrMovieFile {
	id: number;
	movieId: number;
	relativePath?: string;
	path?: string;
	size?: number;
	dateAdded?: string;
	quality?: {
		quality: { id: number; name: string; source?: string; resolution?: number };
		revision?: { version: number; real: number; isRepack?: boolean };
	};
	customFormats: CustomFormatRef[];
	customFormatScore: number;
	mediaInfo?: {
		audioBitrate?: number;
		audioChannels?: number;
		audioCodec?: string;
		audioLanguages?: string;
		audioStreamCount?: number;
		videoBitDepth?: number;
		videoBitrate?: number;
		videoCodec?: string;
		videoFps?: number;
		videoDynamicRange?: string;
		videoDynamicRangeType?: string;
		resolution?: string;
		runTime?: string;
		scanType?: string;
		subtitles?: string;
	};
	originalFilePath?: string;
	sceneName?: string;
	releaseGroup?: string;
	edition?: string;
	languages?: { id: number; name: string }[];
}

/**
 * Format item within a quality profile
 */
export interface QualityProfileFormatItem {
	format: number;
	name: string;
	score: number;
}

/**
 * Quality profile from /api/v3/qualityprofile
 */
export interface ArrQualityProfile {
	id: number;
	name: string;
	upgradeAllowed?: boolean;
	cutoff?: number;
	cutoffFormatScore: number;
	minFormatScore: number;
	formatItems: QualityProfileFormatItem[];
	items?: {
		id?: number;
		name?: string;
		quality?: { id: number; name: string; source?: string; resolution?: number };
		items?: unknown[];
		allowed?: boolean;
	}[];
}

/** @deprecated Use ArrQualityProfile instead */
export type RadarrQualityProfile = ArrQualityProfile;

/** @deprecated Use ArrTag instead */
export type RadarrTag = ArrTag;

/**
 * Command response from /api/v3/command
 * Shared between Radarr and Sonarr
 */
export interface ArrCommand {
	id: number;
	name: string;
	commandName: string;
	status: 'queued' | 'started' | 'completed' | 'failed' | string;
	queued?: string;
	started?: string;
	ended?: string;
	message?: string;
	body?: {
		movieIds?: number[];
		seriesIds?: number[];
		sendUpdatesToClient?: boolean;
	};
}

/** @deprecated Use ArrCommand instead */
export type RadarrCommand = ArrCommand;

/**
 * Queue item from /api/v3/queue
 * Represents a download in progress or completed
 */
export interface RadarrQueueItem {
	id: number;
	movieId: number;
	title: string;
	status: string;
	quality: {
		quality: { id: number; name: string; source?: string; resolution?: number };
		revision?: { version: number; real: number; isRepack?: boolean };
	};
	customFormats: CustomFormatRef[];
	customFormatScore: number;
	downloadId: string;
	protocol: 'torrent' | 'usenet' | 'unknown';
	indexer: string;
}

/**
 * Queue item from /api/v3/queue (Sonarr)
 * One record per episode, even for season packs (same downloadId across episodes)
 */
export interface SonarrQueueItem {
	id: number;
	seriesId: number;
	episodeId: number;
	seasonNumber: number;
	title: string;
	status: string;
	quality: {
		quality: { id: number; name: string; source?: string; resolution?: number };
		revision?: { version: number; real: number; isRepack?: boolean };
	};
	customFormats: CustomFormatRef[];
	customFormatScore: number;
	downloadId: string;
	protocol: 'torrent' | 'usenet' | 'unknown';
	indexer: string;
}

/**
 * Rename preview item from /api/v3/rename
 * Shows what would be renamed before executing
 */
export interface RenamePreviewItem {
	// Radarr fields
	movieId?: number;
	movieFileId?: number;
	// Sonarr fields
	seriesId?: number;
	seasonNumber?: number;
	episodeNumbers?: number[];
	episodeFileId?: number;
	// Shared fields
	existingPath: string;
	newPath: string;
}

// =============================================================================
// Release Types (Interactive Search)
// =============================================================================

/**
 * Release from /api/v3/release (Radarr)
 * Returned by interactive search endpoint
 */
export interface RadarrRelease {
	guid: string;
	title: string;
	size: number;
	indexer: string;
	indexerId: number;
	languages: Array<{ id: number; name: string }>;
	indexerFlags: string[]; // String array like ["G_Internal", "G_Freeleech"]
	quality: {
		quality: {
			id: number;
			name: string;
			source: string;
			resolution: number;
			modifier: string;
		};
		revision?: {
			version: number;
			real: number;
			isRepack: boolean;
		};
	};
	customFormats: Array<{ id: number; name: string }>;
	customFormatScore: number;
	releaseGroup: string | null;
	seeders: number | null;
	leechers: number | null;
	protocol: 'torrent' | 'usenet' | 'unknown';
	age: number;
	ageHours: number;
	ageMinutes: number;
	approved: boolean;
	temporarilyRejected: boolean;
	rejected: boolean;
	rejections: string[];
	publishDate: string;
	downloadUrl: string | null;
	infoUrl: string | null;
	magnetUrl: string | null;
	infoHash: string | null;
}

// =============================================================================
// Sonarr Types
// =============================================================================

/**
 * Season statistics from /api/v3/series
 */
export interface SonarrSeasonStatistics {
	previousAiring?: string;
	nextAiring?: string;
	episodeFileCount: number;
	episodeCount: number;
	totalEpisodeCount: number;
	sizeOnDisk: number;
	releaseGroups: string[];
	percentOfEpisodes: number;
}

/**
 * Season from /api/v3/series
 */
export interface SonarrSeason {
	seasonNumber: number;
	monitored: boolean;
	statistics: SonarrSeasonStatistics;
}

/**
 * Series from /api/v3/series
 */
export interface SonarrSeries {
	id: number;
	title: string;
	sortTitle?: string;
	tvdbId?: number;
	imdbId?: string;
	overview?: string;
	path?: string;
	rootFolderPath?: string;
	qualityProfileId: number;
	seasonFolder?: boolean;
	monitored: boolean;
	status?: string;
	year?: number;
	runtime?: number;
	network?: string;
	seriesType?: string;
	certification?: string;
	firstAired?: string;
	lastAired?: string;
	originalLanguage?: { id: number; name: string };
	ratings?: { value: number; votes: number };
	seasons: SonarrSeason[];
	images?: Array<{ coverType: string; url: string; remoteUrl?: string }>;
	genres?: string[];
	tags?: number[];
	added?: string;
	statistics?: {
		seasonCount: number;
		episodeFileCount: number;
		episodeCount: number;
		totalEpisodeCount: number;
		sizeOnDisk: number;
		percentOfEpisodes: number;
	};
}

/**
 * Release from /api/v3/release (Sonarr)
 * Returned by interactive search endpoint
 */
export interface SonarrRelease {
	guid: string;
	title: string;
	size: number;
	indexer: string;
	indexerId: number;
	languages: Array<{ id: number; name: string }>;
	indexerFlags: number; // Integer bitmask
	fullSeason: boolean;
	seasonNumber: number;
	seriesTitle: string;
	episodeNumbers: number[];
	absoluteEpisodeNumbers: number[];
	mappedSeasonNumber: number | null;
	mappedEpisodeNumbers: number[] | null;
	mappedSeriesId: number | null;
	quality: {
		quality: {
			id: number;
			name: string;
			source: string;
			resolution: number;
		};
		revision?: {
			version: number;
			real: number;
			isRepack: boolean;
		};
	};
	customFormats: Array<{ id: number; name: string }>;
	customFormatScore: number;
	releaseGroup: string | null;
	seeders: number | null;
	leechers: number | null;
	protocol: 'torrent' | 'usenet' | 'unknown';
	age: number;
	ageHours: number;
	ageMinutes: number;
	approved: boolean;
	temporarilyRejected: boolean;
	rejected: boolean;
	rejections: string[];
	publishDate: string;
	downloadUrl: string | null;
	infoUrl: string | null;
	magnetUrl: string | null;
	infoHash: string | null;
}

// =============================================================================
// Sonarr Episode/File Types
// =============================================================================

/**
 * Episode from /api/v3/episode
 */
export interface SonarrEpisode {
	id: number;
	seriesId: number;
	seasonNumber: number;
	episodeNumber: number;
	title: string;
	hasFile: boolean;
	monitored: boolean;
	episodeFileId: number;
	airDateUtc?: string;
}

/**
 * Episode file from /api/v3/episodefile
 */
export interface SonarrEpisodeFile {
	id: number;
	seriesId: number;
	seasonNumber: number;
	relativePath?: string;
	size: number;
	dateAdded?: string;
	quality: {
		quality: { id: number; name: string; source?: string; resolution?: number };
		revision?: { version: number; real: number; isRepack?: boolean };
	};
	customFormats: CustomFormatRef[];
	customFormatScore: number;
	qualityCutoffNotMet: boolean;
	releaseGroup?: string;
	languages?: { id: number; name: string }[];
	mediaInfo?: {
		audioBitrate?: number;
		audioChannels?: number;
		audioCodec?: string;
		audioLanguages?: string;
		audioStreamCount?: number;
		videoBitDepth?: number;
		videoBitrate?: number;
		videoCodec?: string;
		videoFps?: number;
		videoDynamicRange?: string;
		videoDynamicRangeType?: string;
		resolution?: string;
		runTime?: string;
		scanType?: string;
		subtitles?: string;
	};
	releaseType?: string;
}

// =============================================================================
// Library View Types (computed/joined data)
// =============================================================================

/**
 * Score breakdown showing how each custom format contributes to the total score
 */
export interface ScoreBreakdownItem {
	name: string;
	score: number;
}

/**
 * Library item with all computed fields for the UI
 */
export interface RadarrLibraryItem {
	// From /movie
	id: number;
	tmdbId?: number;
	imdbId?: string;
	title: string;
	year?: number;
	qualityProfileId: number;
	qualityProfileName: string;
	hasFile: boolean;
	monitored: boolean;
	status?: string;
	dateAdded?: string;
	popularity?: number;
	sizeOnDisk?: number;
	runtime?: number;
	certification?: string;
	genres?: string[];
	studio?: string;
	ratings?: {
		imdb?: { votes: number; value: number };
		tmdb?: { votes: number; value: number };
		metacritic?: { votes: number; value: number };
		rottenTomatoes?: { votes: number; value: number };
		trakt?: { votes: number; value: number };
	};
	images?: ArrImage[];
	collection?: { title?: string; tmdbId?: number };
	originalLanguage?: { id: number; name: string };

	// From /moviefile (only if hasFile)
	customFormats: CustomFormatRef[];
	customFormatScore: number;
	qualityName?: string;
	fileName?: string;
	releaseGroup?: string;
	edition?: string;
	languages?: { id: number; name: string }[];
	mediaInfo?: ArrMediaInfo;

	// Computed
	scoreBreakdown: ScoreBreakdownItem[];
	cutoffScore: number;
	minScore: number;
	progress: number;
	cutoffMet: boolean;
	isProfilarrProfile: boolean;
}

/**
 * Computed episode item for Sonarr library view
 */
export interface SonarrEpisodeItem {
	id: number;
	episodeNumber: number;
	seasonNumber: number;
	title: string;
	hasFile: boolean;
	monitored: boolean;
	qualityName?: string;
	fileName?: string;
	size?: number;
	customFormats: CustomFormatRef[];
	customFormatScore: number;
	scoreBreakdown: ScoreBreakdownItem[];
	cutoffScore: number;
	progress: number;
	cutoffMet: boolean;
	releaseGroup?: string;
	languages?: { id: number; name: string }[];
	mediaInfo?: ArrMediaInfo;
}

/**
 * Season summary for Sonarr library view
 */
export interface SonarrSeasonItem {
	seasonNumber: number;
	monitored: boolean;
	episodeCount: number;
	episodeFileCount: number;
	totalEpisodeCount: number;
	sizeOnDisk: number;
	percentOfEpisodes: number;
}

/**
 * Sonarr library item (series-level) with all computed fields for the UI
 */
export interface SonarrLibraryItem {
	id: number;
	tvdbId?: number;
	imdbId?: string;
	title: string;
	year?: number;
	qualityProfileId: number;
	qualityProfileName: string;
	status?: string;
	monitored: boolean;
	seasonCount: number;
	episodeCount: number;
	episodeFileCount: number;
	totalEpisodeCount: number;
	sizeOnDisk: number;
	percentOfEpisodes: number;
	dateAdded?: string;
	seasons: SonarrSeasonItem[];
	isProfilarrProfile: boolean;
	network?: string;
	seriesType?: string;
	certification?: string;
	genres?: string[];
	runtime?: number;
	ratings?: { votes: number; value: number };
	images?: ArrImage[];
	originalLanguage?: { id: number; name: string };
	firstAired?: string;
	lastAired?: string;
}

// =============================================================================
// Delay Profile Types (shared across arr apps)
// =============================================================================

/**
 * Delay profile from /api/v3/delayprofile
 * Schema is identical for Radarr and Sonarr
 */
export interface ArrDelayProfile {
	id: number;
	enableUsenet: boolean;
	enableTorrent: boolean;
	preferredProtocol: string; // 'usenet' | 'torrent' | 'unknown'
	usenetDelay: number;
	torrentDelay: number;
	bypassIfHighestQuality: boolean;
	bypassIfAboveCustomFormatScore: boolean;
	minimumCustomFormatScore: number;
	order: number;
	tags: number[];
}

/**
 * Tag from /api/v3/tag (shared across arr apps)
 */
export interface ArrTag {
	id: number;
	label: string;
}

// =============================================================================
// Media Management Config Types
// =============================================================================

/**
 * Propers and repacks download preference
 * Shared between Radarr and Sonarr
 * API values: doNotPrefer, preferAndUpgrade, doNotUpgrade
 */
export type ArrPropersAndRepacks = 'doNotPrefer' | 'preferAndUpgrade' | 'doNotUpgrade';

/**
 * Media management config from /api/v3/config/mediamanagement
 * Only includes fields we care about syncing - the full response has many more fields
 * We GET the full config, modify these fields, and PUT the whole thing back
 */
export interface ArrMediaManagementConfig {
	id: number;
	downloadPropersAndRepacks: ArrPropersAndRepacks;
	enableMediaInfo: boolean;
	// The API returns many more fields - we preserve them when updating
	[key: string]: unknown;
}

// =============================================================================
// Naming Config Types
// =============================================================================

/**
 * Radarr colon replacement format (string enum)
 */
export type RadarrColonReplacementFormat =
	| 'delete'
	| 'dash'
	| 'spaceDash'
	| 'spaceDashSpace'
	| 'smart';

/**
 * Radarr naming config from /api/v3/config/naming
 */
export interface RadarrNamingConfig {
	id: number;
	renameMovies: boolean;
	replaceIllegalCharacters: boolean;
	colonReplacementFormat: RadarrColonReplacementFormat;
	standardMovieFormat: string | null;
	movieFolderFormat: string | null;
	[key: string]: unknown;
}

/**
 * Sonarr naming config from /api/v3/config/naming
 * Note: colonReplacementFormat and multiEpisodeStyle are integers, not strings
 */
export interface SonarrNamingConfig {
	id: number;
	renameEpisodes: boolean;
	replaceIllegalCharacters: boolean;
	colonReplacementFormat: number;
	customColonReplacementFormat: string | null;
	multiEpisodeStyle: number;
	standardEpisodeFormat: string | null;
	dailyEpisodeFormat: string | null;
	animeEpisodeFormat: string | null;
	seriesFolderFormat: string | null;
	seasonFolderFormat: string | null;
	specialsFolderFormat: string | null;
	[key: string]: unknown;
}

/**
 * Union type for naming config (varies by arr type)
 */
export type ArrNamingConfig = RadarrNamingConfig | SonarrNamingConfig;

// =============================================================================
// Quality Definition Types
// =============================================================================

/**
 * Quality info within a quality definition
 */
export interface ArrQuality {
	id: number;
	name: string | null;
	source?: string;
	resolution?: number;
}

/**
 * Quality definition from /api/v3/qualitydefinition
 */
export interface ArrQualityDefinition {
	id: number;
	quality: ArrQuality;
	title: string | null;
	weight: number;
	minSize: number | null;
	maxSize: number | null;
	preferredSize: number | null;
}

// =============================================================================
// Custom Format Types
// =============================================================================

/**
 * Custom format specification field
 */
export interface ArrSpecificationField {
	name: string;
	value: unknown;
}

/**
 * Custom format specification (condition)
 */
export interface ArrCustomFormatSpecification {
	name: string;
	implementation: string;
	negate: boolean;
	required: boolean;
	fields: ArrSpecificationField[];
}

/**
 * Custom format from /api/v3/customformat
 */
export interface ArrCustomFormat {
	id?: number;
	name: string;
	includeCustomFormatWhenRenaming?: boolean;
	specifications: ArrCustomFormatSpecification[];
}

// =============================================================================
// Quality Profile Types (for create/update)
// =============================================================================

/**
 * Quality item within a quality profile
 */
export interface ArrQualityProfileItem {
	quality?: {
		id: number;
		name: string;
		source?: string;
		resolution?: number;
	};
	items: ArrQualityProfileItem[];
	allowed: boolean;
	id?: number;
	name?: string;
}

/**
 * Language setting for quality profile
 */
export interface ArrLanguage {
	id: number;
	name: string;
}

/**
 * Quality profile for create/update operations
 */
export interface ArrQualityProfilePayload {
	id?: number;
	name: string;
	items: ArrQualityProfileItem[];
	language?: ArrLanguage; // Radarr only - Sonarr uses custom formats for language filtering
	upgradeAllowed: boolean;
	cutoff: number;
	minFormatScore: number;
	cutoffFormatScore: number;
	minUpgradeFormatScore: number;
	formatItems: QualityProfileFormatItem[];
}

// =============================================================================
// System Types
// =============================================================================

/**
 * Health check item from /api/v3/health
 */
export interface ArrHealthItem {
	source: string;
	type: string;
	message: string;
	wikiUrl?: string;
}

/**
 * System status response from /api/v3/system/status
 * Based on actual Radarr API response
 */
export interface ArrSystemStatus {
	appName: string;
	instanceName: string;
	version: string;
	buildTime: string;
	isDebug: boolean;
	isProduction: boolean;
	isAdmin: boolean;
	isUserInteractive: boolean;
	startupPath: string;
	appData: string;
	osName: string;
	osVersion: string;
	isNetCore: boolean;
	isLinux: boolean;
	isOsx: boolean;
	isWindows: boolean;
	isDocker: boolean;
	mode: 'console' | string;
	branch: string;
	databaseType: 'sqLite' | string;
	databaseVersion: string;
	authentication: 'none' | 'basic' | 'forms' | string;
	migrationVersion: number;
	urlBase: string;
	runtimeVersion: string;
	runtimeName: string;
	startTime: string;
	packageVersion: string;
	packageAuthor: string;
	packageUpdateMechanism: 'builtIn' | string;
	packageUpdateMechanismMessage: string;
}

// =============================================================================
// Log Types
// =============================================================================

/**
 * Log level for filtering
 * API accepts: Trace, Debug, Info, Warn, Error, Fatal
 */
export type ArrLogLevel = 'Trace' | 'Debug' | 'Info' | 'Warn' | 'Error' | 'Fatal';

/**
 * Sort direction for log queries
 */
export type ArrSortDirection = 'ascending' | 'descending' | 'default';

/**
 * Log entry from /api/v3/log
 */
export interface ArrLogEntry {
	id: number;
	time: string; // ISO 8601 UTC
	level: string; // lowercase: "info", "warn", "error", "debug", "trace", "fatal"
	logger: string; // source/component: "RssSyncService", "DiskScanService"
	message: string;
	exception?: string | null;
	exceptionType?: string | null;
	method?: string | null;
}

/**
 * Paginated log response from /api/v3/log
 */
export interface ArrLogResponse {
	page: number;
	pageSize: number;
	sortKey: string;
	sortDirection: string;
	totalRecords: number;
	records: ArrLogEntry[];
}

/**
 * Log file metadata from /api/v3/log/file
 */
export interface ArrLogFile {
	id: number;
	filename: string;
	lastWriteTime: string; // ISO 8601
	contentsUrl: string;
	downloadUrl: string;
}

/**
 * Parameters for fetching logs
 */
export interface ArrLogParams {
	page?: number;
	pageSize?: number;
	sortKey?: string;
	sortDirection?: ArrSortDirection;
	level?: ArrLogLevel;
}
