import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { cache } from '$cache/cache.ts';
import { SonarrClient } from '$utils/arr/clients/sonarr.ts';
import type { SonarrLibraryItem } from '$utils/arr/types.ts';
import { getProfilarrProfileNames } from '$lib/server/sync/libraryHelpers.ts';
import { logger } from '$logger/logger.ts';

const MANUAL_CACHE_TTL = 86400;

async function getLibraryCached(instanceId: number): Promise<SonarrLibraryItem[]> {
	const cacheKey = `library:${instanceId}`;
	const cached = cache.get<SonarrLibraryItem[]>(cacheKey);
	if (cached) return cached;

	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) throw new Error('Instance not found');

	const ttl =
		instance.library_refresh_interval > 0
			? instance.library_refresh_interval * 60
			: MANUAL_CACHE_TTL;

	const profilarrProfileNames = await getProfilarrProfileNames();
	const client = new SonarrClient(instance.url, instance.api_key);
	try {
		const items = await client.getLibrary(profilarrProfileNames);
		cache.set(cacheKey, items, ttl);
		return items;
	} finally {
		client.close();
	}
}

export const GET: RequestHandler = async ({ params }) => {
	const instanceId = parseInt(params.id ?? '', 10);
	const seriesId = parseInt(params.seriesId ?? '', 10);
	if (!Number.isFinite(instanceId) || !Number.isFinite(seriesId)) {
		return json({ error: 'Invalid instance or series ID' }, { status: 400 });
	}

	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) {
		return json({ error: 'Instance not found' }, { status: 404 });
	}
	if (instance.type !== 'sonarr') {
		return json({ error: 'Seasons are only available for Sonarr instances' }, { status: 400 });
	}

	try {
		const library = await getLibraryCached(instanceId);
		const series = library.find((s) => s.id === seriesId);
		if (!series) {
			return json({ error: 'Series not found' }, { status: 404 });
		}
		return json({ seasons: series.seasons });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch seasons';
		await logger.error(`Failed to fetch seasons for series ${seriesId}`, {
			source: 'arr/library/seasons',
			meta: { instanceId, seriesId, error: message }
		});
		return json({ error: message }, { status: 500 });
	}
};
