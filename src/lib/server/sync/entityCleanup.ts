/**
 * Entity cleanup: delete movies/series flagged as removed from TMDB/TVDB
 * by the Arr health check system.
 *
 * Flow: get health → find RemovedMovieCheck/RemovedSeriesCheck →
 * extract TMDB/TVDB IDs → match against library → delete.
 */

import type { BaseArrClient } from '#arr/base.ts';
import { RadarrClient } from '#arr/clients/radarr.ts';
import { SonarrClient } from '#arr/clients/sonarr.ts';
import { logger } from '#logger/logger.ts';

const SOURCE = 'EntityCleanup';

const TMDB_ID_REGEX = /\btmdb(?:id)?[-_:\s]*(\d+)\b/gi;
const TVDB_ID_REGEX = /\btvdb(?:id)?[-_:\s]*(\d+)\b/gi;

export interface RemovedEntity {
	id: number;
	title: string;
	externalId: number;
}

export interface EntityScanResult {
	removedEntities: RemovedEntity[];
}

export interface EntityDeleteResult {
	deletedEntities: RemovedEntity[];
	failedEntities: { entity: RemovedEntity; reason: string }[];
}

/**
 * Scan an Arr instance for media removed from TMDB/TVDB.
 */
export async function scanForRemovedEntities(
	client: BaseArrClient,
	instanceType: 'radarr' | 'sonarr'
): Promise<EntityScanResult> {
	const health = await client.getHealth();

	const checkSource = instanceType === 'radarr' ? 'RemovedMovieCheck' : 'RemovedSeriesCheck';
	const idRegex = instanceType === 'radarr' ? TMDB_ID_REGEX : TVDB_ID_REGEX;

	// Extract external IDs from health messages
	const flaggedIds = new Set<number>();
	for (const item of health) {
		if (item.source !== checkSource) continue;
		for (const match of item.message.matchAll(idRegex)) {
			flaggedIds.add(parseInt(match[1], 10));
		}
	}

	if (flaggedIds.size === 0) {
		await logger.debug('No removed entities found in health checks', {
			source: SOURCE,
			meta: { instanceType }
		});
		return { removedEntities: [] };
	}

	// Fetch library and match
	const removedEntities: RemovedEntity[] = [];

	if (instanceType === 'radarr') {
		const movies = await (client as RadarrClient).getMovies();
		for (const movie of movies) {
			if (movie.tmdbId != null && flaggedIds.has(movie.tmdbId)) {
				removedEntities.push({
					id: movie.id,
					title: movie.title,
					externalId: movie.tmdbId
				});
			}
		}
	} else {
		const series = await (client as SonarrClient).getAllSeries();
		for (const s of series) {
			if (s.tvdbId != null && flaggedIds.has(s.tvdbId)) {
				removedEntities.push({
					id: s.id,
					title: s.title,
					externalId: s.tvdbId
				});
			}
		}
	}

	await logger.debug('Entity scan complete', {
		source: SOURCE,
		meta: {
			instanceType,
			flaggedIds: [...flaggedIds],
			matched: removedEntities.length
		}
	});

	return { removedEntities };
}

/**
 * Delete removed entities from an Arr instance.
 */
export async function deleteRemovedEntities(
	client: BaseArrClient,
	instanceType: 'radarr' | 'sonarr',
	entities: RemovedEntity[]
): Promise<EntityDeleteResult> {
	const deletedEntities: RemovedEntity[] = [];
	const failedEntities: { entity: RemovedEntity; reason: string }[] = [];

	for (const entity of entities) {
		try {
			if (instanceType === 'radarr') {
				await (client as RadarrClient).deleteMovie(entity.id);
			} else {
				await (client as SonarrClient).deleteSeries(entity.id);
			}
			deletedEntities.push(entity);
		} catch (err) {
			const reason = err instanceof Error ? err.message : String(err);
			failedEntities.push({ entity, reason });
		}
	}

	return { deletedEntities, failedEntities };
}
