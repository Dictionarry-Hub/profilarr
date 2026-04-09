import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { TMDBClient } from '$lib/server/utils/tmdb/client.ts';
import { tmdbSettingsQueries } from '$db/queries/tmdbSettings.ts';
import { logger } from '$lib/server/utils/logger/logger.ts';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('query');
	const type = url.searchParams.get('type') || 'both'; // 'movie', 'tv', or 'both'
	const page = parseInt(url.searchParams.get('page') || '1', 10);

	if (!query) {
		return json({ error: 'Query is required' }, { status: 400 });
	}

	const settings = tmdbSettingsQueries.get();
	if (!settings?.api_key) {
		return json({ error: 'TMDB API key not configured' }, { status: 400 });
	}

	try {
		const client = new TMDBClient(settings.api_key);

		if (type === 'movie') {
			const result = await client.searchMovies(query, page);
			return json({
				results: result.results.map((m) => ({
					id: m.id,
					type: 'movie' as const,
					title: m.title,
					overview: m.overview,
					posterPath: m.poster_path,
					releaseDate: m.release_date,
					voteAverage: m.vote_average,
					popularity: m.popularity
				})),
				totalPages: result.total_pages,
				totalResults: result.total_results,
				page: result.page
			});
		} else if (type === 'tv') {
			const result = await client.searchTVShows(query, page);
			return json({
				results: result.results.map((t) => ({
					id: t.id,
					type: 'series' as const,
					title: t.name,
					overview: t.overview,
					posterPath: t.poster_path,
					releaseDate: t.first_air_date,
					voteAverage: t.vote_average,
					popularity: t.popularity
				})),
				totalPages: result.total_pages,
				totalResults: result.total_results,
				page: result.page
			});
		} else {
			// Search both and combine
			const [movies, tvShows] = await Promise.all([
				client.searchMovies(query, page),
				client.searchTVShows(query, page)
			]);

			const combined = [
				...movies.results.map((m) => ({
					id: m.id,
					type: 'movie' as const,
					title: m.title,
					overview: m.overview,
					posterPath: m.poster_path,
					releaseDate: m.release_date,
					voteAverage: m.vote_average,
					popularity: m.popularity
				})),
				...tvShows.results.map((t) => ({
					id: t.id,
					type: 'series' as const,
					title: t.name,
					overview: t.overview,
					posterPath: t.poster_path,
					releaseDate: t.first_air_date,
					voteAverage: t.vote_average,
					popularity: t.popularity
				}))
			].sort((a, b) => b.popularity - a.popularity);

			return json({
				results: combined,
				totalPages: Math.max(movies.total_pages, tvShows.total_pages),
				totalResults: movies.total_results + tvShows.total_results,
				page
			});
		}
	} catch (error) {
		logger.error(
			`TMDB search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
			{ source: 'TMDB' }
		);
		return json(
			{
				error: error instanceof Error ? error.message : 'Search failed'
			},
			{ status: 500 }
		);
	}
};
