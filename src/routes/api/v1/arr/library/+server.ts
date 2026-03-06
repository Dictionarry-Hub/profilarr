import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { components } from '$api/v1.d.ts';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { cache } from '$cache/cache.ts';
import { RadarrClient } from '$utils/arr/clients/radarr.ts';
import { SonarrClient } from '$utils/arr/clients/sonarr.ts';
import {
	getProfilarrProfileNames,
	getProfilesByDatabase
} from '$lib/server/sync/libraryHelpers.ts';
import { logger } from '$logger/logger.ts';

type LibraryResponse = components['schemas']['LibraryResponse'];
type ErrorResponse = components['schemas']['ErrorResponse'];

const MANUAL_CACHE_TTL = 86400; // 24 hours for manual mode

/**
 * GET /api/v1/arr/library
 *
 * Get the full library from an Arr instance with quality profile,
 * score, and progress information.
 *
 * Query params:
 * - instanceId: Arr instance ID (required)
 */
export const GET: RequestHandler = async ({ url }) => {
	const instanceId = url.searchParams.get('instanceId');

	if (!instanceId) {
		return json({ error: 'instanceId is required' } satisfies ErrorResponse, { status: 400 });
	}

	const id = parseInt(instanceId, 10);
	if (isNaN(id)) {
		return json({ error: 'Invalid instanceId' } satisfies ErrorResponse, { status: 400 });
	}

	const instance = arrInstancesQueries.getById(id);
	if (!instance) {
		return json({ error: 'Instance not found' } satisfies ErrorResponse, { status: 404 });
	}

	const cacheKey = `library:${id}`;
	const ttl =
		instance.library_refresh_interval > 0
			? instance.library_refresh_interval * 60
			: MANUAL_CACHE_TTL;
	const profilesByDatabase = await getProfilesByDatabase();

	try {
		if (instance.type === 'radarr') {
			const cached = cache.get<components['schemas']['RadarrLibraryItem'][]>(cacheKey);
			if (cached) {
				return json({
					type: 'radarr',
					items: cached,
					profilesByDatabase
				} satisfies LibraryResponse);
			}

			const profilarrProfileNames = await getProfilarrProfileNames();
			const client = new RadarrClient(instance.url, instance.api_key);
			try {
				const items = await client.getLibrary(profilarrProfileNames);
				cache.set(cacheKey, items, ttl);

				await logger.info(`Fetched library for ${instance.name}`, {
					source: 'arr/library',
					meta: { instanceId: id, movieCount: items.length }
				});

				return json({
					type: 'radarr',
					items,
					profilesByDatabase
				} satisfies LibraryResponse);
			} finally {
				client.close();
			}
		} else if (instance.type === 'sonarr') {
			const cached = cache.get<components['schemas']['SonarrLibraryItem'][]>(cacheKey);
			if (cached) {
				return json({
					type: 'sonarr',
					items: cached,
					profilesByDatabase
				} satisfies LibraryResponse);
			}

			const profilarrProfileNames = await getProfilarrProfileNames();
			const client = new SonarrClient(instance.url, instance.api_key);
			try {
				const items = await client.getLibrary(profilarrProfileNames);
				cache.set(cacheKey, items, ttl);

				await logger.info(`Fetched library for ${instance.name}`, {
					source: 'arr/library',
					meta: { instanceId: id, seriesCount: items.length }
				});

				return json({
					type: 'sonarr',
					items,
					profilesByDatabase
				} satisfies LibraryResponse);
			} finally {
				client.close();
			}
		} else {
			return json(
				{ error: `Unsupported instance type: ${instance.type}` } satisfies ErrorResponse,
				{ status: 400 }
			);
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch library';

		await logger.error(`Failed to fetch library for ${instance.name}`, {
			source: 'arr/library',
			meta: { instanceId: id, error: message }
		});

		return json({ error: message } satisfies ErrorResponse, { status: 500 });
	}
};

/**
 * DELETE /api/v1/arr/library
 *
 * Invalidate the server-side library cache for an instance.
 *
 * Query params:
 * - instanceId: Arr instance ID (required)
 */
export const DELETE: RequestHandler = async ({ url }) => {
	const instanceId = url.searchParams.get('instanceId');

	if (!instanceId) {
		return json({ error: 'instanceId is required' } satisfies ErrorResponse, { status: 400 });
	}

	const id = parseInt(instanceId, 10);
	if (isNaN(id)) {
		return json({ error: 'Invalid instanceId' } satisfies ErrorResponse, { status: 400 });
	}

	cache.delete(`library:${id}`);

	await logger.debug(`Manual library refresh triggered`, {
		source: 'arr/library',
		meta: { instanceId: id }
	});

	return json({ success: true } satisfies components['schemas']['CacheInvalidatedResponse']);
};
