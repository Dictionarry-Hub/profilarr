import { BaseHttpClient } from '#utils/http/client.ts';
import { logger } from '#logger/logger.ts';
import type { TMDBMovieSearchResponse, TMDBTVSearchResponse, TMDBAuthResponse } from './types.ts';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

/**
 * TMDB API client
 */
export class TMDBClient extends BaseHttpClient {
	constructor(apiKey: string) {
		super(TMDB_BASE_URL, {
			headers: {
				Authorization: `Bearer ${apiKey}`
			}
		});
	}

	/**
	 * Validate the API key
	 */
	async validateKey(): Promise<TMDBAuthResponse> {
		return this.get<TMDBAuthResponse>('/authentication');
	}

	/**
	 * Search for movies
	 */
	async searchMovies(query: string, page = 1): Promise<TMDBMovieSearchResponse> {
		logger.debug(`Searching movies: "${query}"`, { source: 'TMDB' });
		const params = new URLSearchParams({
			query,
			include_adult: 'false',
			language: 'en-US',
			page: String(page)
		});
		return this.get<TMDBMovieSearchResponse>(`/search/movie?${params}`);
	}

	/**
	 * Search for TV shows
	 */
	async searchTVShows(query: string, page = 1): Promise<TMDBTVSearchResponse> {
		logger.debug(`Searching TV shows: "${query}"`, { source: 'TMDB' });
		const params = new URLSearchParams({
			query,
			include_adult: 'false',
			language: 'en-US',
			page: String(page)
		});
		return this.get<TMDBTVSearchResponse>(`/search/tv?${params}`);
	}
}
