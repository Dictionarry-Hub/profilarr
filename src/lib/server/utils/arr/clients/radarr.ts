import { BaseArrClient } from '../base.ts';
import { HttpError } from '$utils/http/types.ts';
import type {
	RadarrMovie,
	RadarrMovieFile,
	ArrQualityProfile,
	RadarrLibraryItem,
	ArrTag,
	ArrCommand,
	RadarrRelease,
	RadarrQueueItem,
	RenamePreviewItem
} from '../types.ts';

/**
 * Radarr API client
 * Extends BaseArrClient with Radarr-specific API methods
 */
export class RadarrClient extends BaseArrClient {
	/**
	 * Get all movies
	 */
	getMovies(): Promise<RadarrMovie[]> {
		return this.get<RadarrMovie[]>(`/api/${this.apiVersion}/movie`);
	}

	/**
	 * Get all quality profiles
	 */
	override getQualityProfiles(): Promise<ArrQualityProfile[]> {
		return this.get<ArrQualityProfile[]>(`/api/${this.apiVersion}/qualityprofile`);
	}

	/**
	 * Get movie files by movie IDs
	 * Uses movieId params for batching (NOT movieFileIds which can error on stale IDs)
	 */
	async getMovieFiles(movieIds: number[]): Promise<RadarrMovieFile[]> {
		if (movieIds.length === 0) {
			return [];
		}

		const MAX_IDS_PER_REQUEST = 200;

		const fetchBatch = async (ids: number[]): Promise<RadarrMovieFile[]> => {
			const queryString = ids.map((id) => `movieId=${id}`).join('&');
			try {
				return await this.get<RadarrMovieFile[]>(
					`/api/${this.apiVersion}/moviefile?${queryString}`
				);
			} catch (error) {
				// If URL still exceeds upstream limits, split and retry recursively.
				if (error instanceof HttpError && error.status === 414 && ids.length > 1) {
					const midpoint = Math.ceil(ids.length / 2);
					const [left, right] = await Promise.all([
						fetchBatch(ids.slice(0, midpoint)),
						fetchBatch(ids.slice(midpoint))
					]);
					return [...left, ...right];
				}

				throw error;
			}
		};

		const files: RadarrMovieFile[] = [];
		for (let i = 0; i < movieIds.length; i += MAX_IDS_PER_REQUEST) {
			const chunk = movieIds.slice(i, i + MAX_IDS_PER_REQUEST);
			const chunkFiles = await fetchBatch(chunk);
			files.push(...chunkFiles);
		}

		return files;
	}

	/**
	 * Fetch and compute library data with all joined information
	 * Makes 3 API calls: movies, quality profiles, and movie files (batched)
	 * @param profilarrProfileNames - Set of profile names from Profilarr databases
	 */
	async getLibrary(profilarrProfileNames?: Set<string>): Promise<RadarrLibraryItem[]> {
		// Fetch movies and profiles in parallel
		const [movies, profiles] = await Promise.all([this.getMovies(), this.getQualityProfiles()]);

		// Create profile lookup map
		const profileMap = new Map(profiles.map((p) => [p.id, p]));

		// Get movie IDs that have files
		const movieIdsWithFiles = movies.filter((m) => m.hasFile).map((m) => m.id);

		// Fetch movie files in batch
		const movieFiles = await this.getMovieFiles(movieIdsWithFiles);

		// Create movie file lookup by movieId
		const movieFileMap = new Map(movieFiles.map((mf) => [mf.movieId, mf]));

		// Build library items
		const libraryItems: RadarrLibraryItem[] = movies.map((movie) => {
			const profile = profileMap.get(movie.qualityProfileId);
			const movieFile = movieFileMap.get(movie.id);

			const customFormats = movieFile?.customFormats ?? [];
			const customFormatScore = movieFile?.customFormatScore ?? 0;
			const cutoffScore = profile?.cutoffFormatScore ?? 0;
			const minScore = profile?.minFormatScore ?? 0;

			// Compute score breakdown
			const scoreBreakdown = profile
				? this.computeScoreBreakdown(customFormats, profile.formatItems)
				: [];

			// Calculate progress (0 to 1+, where 1 = cutoff met)
			const progress = cutoffScore > 0 ? customFormatScore / cutoffScore : 0;

			const profileName = profile?.name ?? 'Unknown';

			return {
				id: movie.id,
				tmdbId: movie.tmdbId,
				title: movie.title,
				year: movie.year,
				qualityProfileId: movie.qualityProfileId,
				qualityProfileName: profileName,
				hasFile: movie.hasFile,
				dateAdded: movie.added,
				popularity: movie.popularity,
				customFormats,
				customFormatScore,
				qualityName: movieFile?.quality?.quality?.name,
				fileName: movieFile?.relativePath?.split('/').pop(),
				scoreBreakdown,
				cutoffScore,
				minScore,
				progress,
				cutoffMet: customFormatScore >= cutoffScore,
				isProfilarrProfile: profilarrProfileNames?.has(profileName) ?? false
			};
		});

		return libraryItems;
	}

	/**
	 * Delete a movie from Radarr
	 */
	deleteMovie(movieId: number): Promise<void> {
		return this.delete(`/api/${this.apiVersion}/movie/${movieId}`);
	}

	// =========================================================================
	// Search Methods
	// =========================================================================

	/**
	 * Trigger a search for specific movies
	 * Uses the MoviesSearch command endpoint
	 */
	searchMovies(movieIds: number[]): Promise<ArrCommand> {
		return this.post<ArrCommand>(`/api/${this.apiVersion}/command`, {
			name: 'MoviesSearch',
			movieIds
		});
	}

	/**
	 * Get releases for a movie (interactive search)
	 * Queries all configured indexers and returns available releases
	 * Note: This can take several seconds as it searches indexers in real-time
	 */
	getReleases(movieId: number): Promise<RadarrRelease[]> {
		return this.get<RadarrRelease[]>(`/api/${this.apiVersion}/release?movieId=${movieId}`);
	}

	/**
	 * Get queue items (downloads in progress)
	 * @param movieIds - Optional filter by movie IDs
	 */
	async getQueue(movieIds?: number[]): Promise<RadarrQueueItem[]> {
		const response = await this.get<{ records: RadarrQueueItem[] }>(
			`/api/${this.apiVersion}/queue?page=1&pageSize=200&includeMovie=true`
		);

		const records = response.records;

		if (movieIds && movieIds.length > 0) {
			const movieIdSet = new Set(movieIds);
			return records.filter((item) => movieIdSet.has(item.movieId));
		}

		return records;
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
	// Movie Update Methods
	// =========================================================================

	/**
	 * Update a movie (used for adding/removing tags)
	 */
	updateMovie(movie: RadarrMovie): Promise<RadarrMovie> {
		return this.put<RadarrMovie>(`/api/${this.apiVersion}/movie/${movie.id}`, movie);
	}

	// =========================================================================
	// Rename Methods
	// =========================================================================

	/**
	 * Get rename preview for a movie
	 * Shows what files would be renamed without making changes
	 */
	getRenamePreview(movieId: number): Promise<RenamePreviewItem[]> {
		return this.get<RenamePreviewItem[]>(`/api/${this.apiVersion}/rename?movieId=${movieId}`);
	}

	/**
	 * Trigger rename for movies
	 * Renames all files that need renaming for the given movie IDs
	 */
	renameMovies(movieIds: number[]): Promise<ArrCommand> {
		return this.post<ArrCommand>(`/api/${this.apiVersion}/command`, {
			name: 'RenameMovie',
			movieIds
		});
	}

	/**
	 * Refresh movies (update metadata from sources)
	 * Required after folder rename to update paths
	 */
	refreshMovies(movieIds: number[]): Promise<ArrCommand> {
		return this.post<ArrCommand>(`/api/${this.apiVersion}/command`, {
			name: 'RefreshMovie',
			movieIds
		});
	}

	/**
	 * Rename movie folders using the movie editor endpoint
	 * Bulk updates movie root folder paths
	 */
	renameMovieFolders(movieIds: number[], rootFolderPath: string): Promise<void> {
		return this.put<void>(`/api/${this.apiVersion}/movie/editor`, {
			movieIds,
			rootFolderPath,
			moveFiles: true
		});
	}
}
