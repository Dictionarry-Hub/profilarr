import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { cache } from '$cache/cache.ts';
import { RadarrClient } from '$utils/arr/clients/radarr.ts';
import { arrClientOptionsFromInstance } from '$utils/arr/factory.ts';
import { LIBRARY_REQUEST_TIMEOUT_MS } from '$utils/arr/base.ts';
import type { RadarrLibraryItem } from '$utils/arr/types.ts';
import { getProfilarrProfileNames } from '$lib/server/sync/libraryHelpers.ts';
import { logger } from '$logger/logger.ts';

const MANUAL_CACHE_TTL = 86400;

export const GET: RequestHandler = async ({ params }) => {
	const instanceId = parseInt(params.id ?? '', 10);
	if (!Number.isFinite(instanceId)) {
		return json({ error: 'Invalid instance ID' }, { status: 400 });
	}

	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) {
		return json({ error: 'Instance not found' }, { status: 404 });
	}
	if (instance.type !== 'radarr') {
		return json({ error: `Movies are only available for Radarr instances` }, { status: 400 });
	}

	const cacheKey = `library:${instanceId}`;
	const cached = cache.get<RadarrLibraryItem[]>(cacheKey);
	if (cached) {
		return json({ items: cached });
	}

	const ttl =
		instance.library_refresh_interval > 0
			? instance.library_refresh_interval * 60
			: MANUAL_CACHE_TTL;

	const profilarrProfileNames = await getProfilarrProfileNames();
	const client = new RadarrClient(
		instance.url,
		instance.api_key,
		arrClientOptionsFromInstance(instance, {
			timeout: LIBRARY_REQUEST_TIMEOUT_MS
		})
	);
	try {
		const items = await client.getLibrary(profilarrProfileNames);
		cache.set(cacheKey, items, ttl);

		await logger.info(`Fetched library for ${instance.name}`, {
			source: 'arr/library/movies',
			meta: { instanceId, movieCount: items.length }
		});

		return json({ items });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch library';
		await logger.error(`Failed to fetch library for ${instance.name}`, {
			source: 'arr/library/movies',
			meta: { instanceId, error: message }
		});
		return json({ error: message }, { status: 500 });
	} finally {
		client.close();
	}
};
