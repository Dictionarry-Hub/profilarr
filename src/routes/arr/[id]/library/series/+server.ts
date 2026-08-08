import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { cache } from '$cache/cache.ts';
import { SonarrClient } from '$utils/arr/clients/sonarr.ts';
import { LIBRARY_REQUEST_TIMEOUT_MS } from '$utils/arr/base.ts';
import type { SonarrLibraryItem, SonarrSeriesItem } from '$utils/arr/types.ts';
import { getProfilarrProfileNames } from '$lib/server/sync/libraryHelpers.ts';
import { jobQueueQueries } from '$db/queries/jobQueue.ts';
import { scheduleLibraryRefreshForInstance } from '$lib/server/jobs/schedule.ts';
import { logger } from '$logger/logger.ts';

const MANUAL_CACHE_TTL = 86400;

function getNextRefreshAt(instanceId: number): string | null {
	return jobQueueQueries.getByDedupeKey(`arr.library.refresh:${instanceId}`)?.runAt ?? null;
}

function stripSeasons(items: SonarrLibraryItem[]): SonarrSeriesItem[] {
	return items.map(({ seasons: _seasons, ...rest }) => rest);
}

export const GET: RequestHandler = async ({ params }) => {
	const instanceId = parseInt(params.id ?? '', 10);
	if (!Number.isFinite(instanceId)) {
		return json({ error: 'Invalid instance ID' }, { status: 400 });
	}

	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) {
		return json({ error: 'Instance not found' }, { status: 404 });
	}
	if (instance.type !== 'sonarr') {
		return json({ error: `Series are only available for Sonarr instances` }, { status: 400 });
	}

	const cacheKey = `library:${instanceId}`;
	const cached = cache.get<SonarrLibraryItem[]>(cacheKey);
	if (cached) {
		return json({
			items: stripSeasons(cached),
			refreshedAt: instance.library_last_refreshed_at,
			nextRefreshAt: getNextRefreshAt(instanceId)
		});
	}

	const ttl =
		instance.library_refresh_interval > 0
			? instance.library_refresh_interval * 60
			: MANUAL_CACHE_TTL;

	const profilarrProfileNames = await getProfilarrProfileNames();
	const client = new SonarrClient(instance.url, instance.api_key, {
		timeout: LIBRARY_REQUEST_TIMEOUT_MS
	});
	try {
		const items = await client.getLibrary(profilarrProfileNames);
		const refreshedAt = new Date().toISOString();
		cache.set(cacheKey, items, ttl);
		arrInstancesQueries.updateLibraryRefreshedAt(instanceId, refreshedAt);
		scheduleLibraryRefreshForInstance(instanceId);

		await logger.info(`Fetched library for ${instance.name}`, {
			source: 'arr/library/series',
			meta: { instanceId, seriesCount: items.length }
		});

		return json({
			items: stripSeasons(items),
			refreshedAt,
			nextRefreshAt: getNextRefreshAt(instanceId)
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch library';
		await logger.error(`Failed to fetch library for ${instance.name}`, {
			source: 'arr/library/series',
			meta: { instanceId, error: message }
		});
		return json({ error: message }, { status: 500 });
	} finally {
		client.close();
	}
};
