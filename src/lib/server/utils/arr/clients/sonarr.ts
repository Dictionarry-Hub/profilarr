import { BaseArrClient } from '../base.ts';
import type {
	SonarrSeries,
	SonarrRelease,
	SonarrEpisode,
	SonarrEpisodeFile,
	SonarrEpisodeItem,
	SonarrLibraryItem,
	SonarrQueueItem,
	ArrQualityProfile,
	ArrTag,
	ArrCommand,
	RenamePreviewItem
} from '../types.ts';

/**
 * Sonarr API client
 * Extends BaseArrClient with Sonarr-specific API methods
 */
export class SonarrClient extends BaseArrClient {
	// =========================================================================
	// Series Methods
	// =========================================================================

	/**
	 * Get all series
	 */
	getAllSeries(): Promise<SonarrSeries[]> {
		return this.get<SonarrSeries[]>(`/api/${this.apiVersion}/series`);
	}

	/**
	 * Get a specific series by ID
	 * Includes season information with statistics
	 */
	getSeries(seriesId: number): Promise<SonarrSeries> {
		return this.get<SonarrSeries>(`/api/${this.apiVersion}/series/${seriesId}`);
	}

	/**
	 * Delete a series from Sonarr
	 */
	deleteSeries(seriesId: number): Promise<void> {
		return this.delete(`/api/${this.apiVersion}/series/${seriesId}`);
	}

	// =========================================================================
	// Episode Methods
	// =========================================================================

	/**
	 * Get all episodes for a series
	 */
	getEpisodes(seriesId: number): Promise<SonarrEpisode[]> {
		return this.get<SonarrEpisode[]>(`/api/${this.apiVersion}/episode?seriesId=${seriesId}`);
	}

	/**
	 * Get all episode files for a series
	 */
	getEpisodeFiles(seriesId: number): Promise<SonarrEpisodeFile[]> {
		return this.get<SonarrEpisodeFile[]>(
			`/api/${this.apiVersion}/episodefile?seriesId=${seriesId}`
		);
	}

	// =========================================================================
	// Library Methods
	// =========================================================================

	/**
	 * Get quality profiles (override for proper typing)
	 */
	override getQualityProfiles(): Promise<ArrQualityProfile[]> {
		return this.get<ArrQualityProfile[]>(`/api/${this.apiVersion}/qualityprofile`);
	}

	/**
	 * Fetch and compute library data (series-level, no episode details)
	 * Makes 2 API calls: series and quality profiles
	 * @param profilarrProfileNames - Set of profile names from Profilarr databases
	 */
	async getLibrary(profilarrProfileNames?: Set<string>): Promise<SonarrLibraryItem[]> {
		const [allSeries, profiles] = await Promise.all([
			this.getAllSeries(),
			this.getQualityProfiles()
		]);

		const profileMap = new Map(profiles.map((p) => [p.id, p]));

		return allSeries.map((series) => {
			const profile = profileMap.get(series.qualityProfileId);
			const profileName = profile?.name ?? 'Unknown';

			return {
				id: series.id,
				tvdbId: series.tvdbId,
				imdbId: series.imdbId,
				title: series.title,
				titleSlug: series.titleSlug,
				year: series.year,
				qualityProfileId: series.qualityProfileId,
				qualityProfileName: profileName,
				status: series.status,
				monitored: series.monitored,
				seasonCount: series.statistics?.seasonCount ?? series.seasons.length,
				episodeCount: series.statistics?.episodeCount ?? 0,
				episodeFileCount: series.statistics?.episodeFileCount ?? 0,
				totalEpisodeCount: series.statistics?.totalEpisodeCount ?? 0,
				sizeOnDisk: series.statistics?.sizeOnDisk ?? 0,
				percentOfEpisodes: series.statistics?.percentOfEpisodes ?? 0,
				dateAdded: series.added,
				seasons: series.seasons.map((s) => ({
					seasonNumber: s.seasonNumber,
					monitored: s.monitored,
					episodeCount: s.statistics.episodeCount,
					episodeFileCount: s.statistics.episodeFileCount,
					totalEpisodeCount: s.statistics.totalEpisodeCount,
					sizeOnDisk: s.statistics.sizeOnDisk,
					percentOfEpisodes: s.statistics.percentOfEpisodes
				})),
				isProfilarrProfile: profilarrProfileNames?.has(profileName) ?? false,
				network: series.network,
				seriesType: series.seriesType,
				certification: series.certification,
				genres: series.genres,
				runtime: series.runtime,
				ratings: series.ratings,
				images: series.images,
				originalLanguage: series.originalLanguage,
				firstAired: series.firstAired,
				lastAired: series.lastAired
			};
		});
	}

	/**
	 * Fetch episode details for a series (lazy-loaded on expand)
	 * Fetches episodes + episode files, joins them, computes scores
	 * @param seriesId - The series to fetch episode details for
	 * @param profile - The quality profile for score computation
	 */
	async getSeriesEpisodeDetails(
		seriesId: number,
		profile: ArrQualityProfile
	): Promise<SonarrEpisodeItem[]> {
		const [episodes, episodeFiles] = await Promise.all([
			this.getEpisodes(seriesId),
			this.getEpisodeFiles(seriesId)
		]);

		// Create episode file lookup by ID
		const fileMap = new Map(episodeFiles.map((f) => [f.id, f]));

		const cutoffScore = profile.cutoffFormatScore ?? 0;

		return episodes.map((ep) => {
			const file = ep.episodeFileId ? fileMap.get(ep.episodeFileId) : undefined;

			const customFormats = file?.customFormats ?? [];
			const customFormatScore = file?.customFormatScore ?? 0;
			const scoreBreakdown = file
				? this.computeScoreBreakdown(customFormats, profile.formatItems)
				: [];
			const progress = cutoffScore > 0 ? customFormatScore / cutoffScore : 0;

			return {
				id: ep.id,
				episodeNumber: ep.episodeNumber,
				seasonNumber: ep.seasonNumber,
				title: ep.title,
				hasFile: ep.hasFile,
				monitored: ep.monitored,
				qualityName: file?.quality?.quality?.name,
				fileName: file?.relativePath?.split('/').pop(),
				size: file?.size,
				customFormats,
				customFormatScore,
				scoreBreakdown,
				cutoffScore,
				progress,
				cutoffMet: file ? !file.qualityCutoffNotMet : false,
				releaseGroup: file?.releaseGroup,
				languages: file?.languages,
				mediaInfo: file?.mediaInfo
					? {
							audioCodec: file.mediaInfo.audioCodec,
							audioChannels: file.mediaInfo.audioChannels,
							videoCodec: file.mediaInfo.videoCodec,
							videoBitDepth: file.mediaInfo.videoBitDepth,
							videoDynamicRange: file.mediaInfo.videoDynamicRange,
							videoDynamicRangeType: file.mediaInfo.videoDynamicRangeType,
							resolution: file.mediaInfo.resolution,
							subtitles: file.mediaInfo.subtitles
						}
					: undefined
			};
		});
	}

	// =========================================================================
	// Upgrade Methods
	// =========================================================================

	/**
	 * Trigger a search for a specific series
	 * Sonarr searches one series at a time (not batched like Radarr)
	 */
	searchSeries(seriesId: number): Promise<ArrCommand> {
		return this.post<ArrCommand>(`/api/${this.apiVersion}/command`, {
			name: 'SeriesSearch',
			seriesId
		});
	}

	/**
	 * Get queue items (downloads in progress)
	 * Returns one record per episode, even for season packs
	 * @param seriesIds - Optional filter by series IDs
	 */
	async getQueue(seriesIds?: number[]): Promise<SonarrQueueItem[]> {
		const response = await this.get<{ records: SonarrQueueItem[] }>(
			`/api/${this.apiVersion}/queue?page=1&pageSize=200&includeSeries=true`
		);

		const records = response.records;

		if (seriesIds && seriesIds.length > 0) {
			const seriesIdSet = new Set(seriesIds);
			return records.filter((item) => seriesIdSet.has(item.seriesId));
		}

		return records;
	}

	/**
	 * Update a series (used for adding/removing tags)
	 */
	updateSeries(series: SonarrSeries): Promise<SonarrSeries> {
		return this.put<SonarrSeries>(`/api/${this.apiVersion}/series/${series.id}`, series);
	}

	/**
	 * Bulk add a tag to multiple series via the series editor endpoint
	 */
	applyTagToSeries(seriesIds: number[], tagId: number): Promise<void> {
		return this.put<void>(`/api/${this.apiVersion}/series/editor`, {
			seriesIds,
			tags: [tagId],
			applyTags: 'add'
		});
	}

	/**
	 * Bulk remove a tag from multiple series via the series editor endpoint
	 */
	removeTagFromSeries(seriesIds: number[], tagId: number): Promise<void> {
		return this.put<void>(`/api/${this.apiVersion}/series/editor`, {
			seriesIds,
			tags: [tagId],
			applyTags: 'remove'
		});
	}

	// =========================================================================
	// Tag Methods
	// =========================================================================

	/**
	 * Get all tags
	 */
	override getTags(): Promise<ArrTag[]> {
		return this.get<ArrTag[]>(`/api/${this.apiVersion}/tag`);
	}

	/**
	 * Create a new tag
	 */
	override createTag(label: string): Promise<ArrTag> {
		return this.post<ArrTag>(`/api/${this.apiVersion}/tag`, { label });
	}

	/**
	 * Get a tag by label, or create it if it doesn't exist
	 */
	async getOrCreateTag(label: string): Promise<ArrTag> {
		const tags = await this.getTags();
		const existing = tags.find((t) => t.label.toLowerCase() === label.toLowerCase());

		if (existing) {
			return existing;
		}

		return this.createTag(label);
	}

	// =========================================================================
	// Search Methods
	// =========================================================================

	/**
	 * Get releases for a series/season (interactive search)
	 * Queries all configured indexers and returns available releases
	 * Note: This can take several seconds as it searches indexers in real-time
	 *
	 * @param seriesId - The series ID
	 * @param seasonNumber - The season number to search
	 * @returns Array of releases from indexers
	 */
	getReleases(seriesId: number, seasonNumber: number): Promise<SonarrRelease[]> {
		return this.get<SonarrRelease[]>(
			`/api/${this.apiVersion}/release?seriesId=${seriesId}&seasonNumber=${seasonNumber}`
		);
	}

	/**
	 * Get only season pack releases (fullSeason: true)
	 * Filters out individual episode releases
	 */
	async getSeasonPackReleases(seriesId: number, seasonNumber: number): Promise<SonarrRelease[]> {
		const releases = await this.getReleases(seriesId, seasonNumber);
		return releases.filter((r) => r.fullSeason);
	}

	// =========================================================================
	// Rename Methods
	// =========================================================================

	/**
	 * Get rename preview for a series
	 * Shows what files would be renamed without making changes
	 */
	getRenamePreview(seriesId: number): Promise<RenamePreviewItem[]> {
		return this.get<RenamePreviewItem[]>(`/api/${this.apiVersion}/rename?seriesId=${seriesId}`);
	}

	/**
	 * Trigger rename for series
	 * Renames all files that need renaming for the given series IDs
	 */
	renameSeries(seriesIds: number[]): Promise<ArrCommand> {
		return this.post<ArrCommand>(`/api/${this.apiVersion}/command`, {
			name: 'RenameSeries',
			seriesIds
		});
	}

	/**
	 * Refresh series (update metadata from sources)
	 * Required after folder rename to update paths
	 */
	refreshSeries(seriesIds: number[]): Promise<ArrCommand> {
		return this.post<ArrCommand>(`/api/${this.apiVersion}/command`, {
			name: 'RefreshSeries',
			seriesIds
		});
	}

	/**
	 * Rename series folders using the series editor endpoint
	 * Bulk updates series root folder paths
	 */
	renameSeriesFolders(seriesIds: number[], rootFolderPath: string): Promise<void> {
		return this.put<void>(`/api/${this.apiVersion}/series/editor`, {
			seriesIds,
			rootFolderPath,
			moveFiles: true
		});
	}
}
