import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { cache } from '$cache/cache.ts';
import { SonarrClient } from '$utils/arr/clients/sonarr.ts';
import { arrClientOptionsFromInstance } from '$utils/arr/factory.ts';
import type { ArrInstance } from '$db/queries/arrInstances.ts';
import type { SonarrEpisodeItem } from '$utils/arr/types.ts';
import { logger } from '$logger/logger.ts';

const EPISODE_CACHE_TTL = 300;

async function getSeriesEpisodesCached(
	instance: Pick<
		ArrInstance,
		'id' | 'url' | 'api_key' | 'basic_auth_username' | 'basic_auth_password'
	>,
	seriesId: number
): Promise<SonarrEpisodeItem[]> {
	const cacheKey = `library-episodes:${instance.id}:${seriesId}`;
	const cached = cache.get<SonarrEpisodeItem[]>(cacheKey);
	if (cached) return cached;

	const client = new SonarrClient(
		instance.url,
		instance.api_key,
		arrClientOptionsFromInstance(instance)
	);
	try {
		const profiles = await client.getQualityProfiles();
		const series = await client.getSeries(seriesId);
		const profile = profiles.find((p) => p.id === series.qualityProfileId);
		if (!profile) {
			throw new Error(`Quality profile not found for series ${seriesId}`);
		}
		const episodes = await client.getSeriesEpisodeDetails(seriesId, profile);
		cache.set(cacheKey, episodes, EPISODE_CACHE_TTL);
		return episodes;
	} finally {
		client.close();
	}
}

export const GET: RequestHandler = async ({ params }) => {
	const instanceId = parseInt(params.id ?? '', 10);
	const seriesId = parseInt(params.seriesId ?? '', 10);
	const seasonNumber = parseInt(params.seasonNumber ?? '', 10);
	if (
		!Number.isFinite(instanceId) ||
		!Number.isFinite(seriesId) ||
		!Number.isFinite(seasonNumber)
	) {
		return json({ error: 'Invalid instance, series, or season number' }, { status: 400 });
	}

	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) {
		return json({ error: 'Instance not found' }, { status: 404 });
	}
	if (instance.type !== 'sonarr') {
		return json({ error: 'Episodes are only available for Sonarr instances' }, { status: 400 });
	}

	try {
		const allEpisodes = await getSeriesEpisodesCached(instance, seriesId);
		const episodes = allEpisodes.filter((ep) => ep.seasonNumber === seasonNumber);

		await logger.info(`Fetched episodes for series ${seriesId} season ${seasonNumber}`, {
			source: 'arr/library/episodes',
			meta: { instanceId, seriesId, seasonNumber, episodeCount: episodes.length }
		});

		return json({ episodes });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch episodes';
		await logger.error(`Failed to fetch episodes for series ${seriesId} season ${seasonNumber}`, {
			source: 'arr/library/episodes',
			meta: { instanceId, seriesId, seasonNumber, error: message }
		});
		return json({ error: message }, { status: 500 });
	}
};
