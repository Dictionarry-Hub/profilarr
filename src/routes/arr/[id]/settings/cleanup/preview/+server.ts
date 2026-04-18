import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { createArrClient } from '$utils/arr/factory.ts';
import { scanForStaleItems, type CleanupScanResult } from '$lib/server/sync/cleanup.ts';
import { scanForRemovedEntities, type EntityScanResult } from '$lib/server/sync/entityCleanup.ts';
import type { ArrType } from '$utils/arr/types.ts';

type PreviewSection<T> = { ok: true; data: T } | { ok: false; error: string };

export interface CleanupPreviewResponse {
	configs: PreviewSection<CleanupScanResult>;
	entities: PreviewSection<EntityScanResult>;
}

/**
 * GET /arr/[id]/settings/cleanup/preview
 *
 * Returns a preview of what would be cleaned up for this arr instance: stale
 * custom formats and quality profiles, plus movies/series flagged removed from
 * TMDB/TVDB. Read-only; actual deletion runs through the `arr.cleanup` job
 * handler via the settings page's runCleanupNow form action.
 *
 * Each scan is reported independently so one failure doesn't hide the other.
 */
export const GET: RequestHandler = async ({ params }) => {
	const instanceId = parseInt(params.id ?? '', 10);
	if (!Number.isFinite(instanceId)) {
		return json({ error: 'Invalid instance ID' }, { status: 400 });
	}

	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) {
		return json({ error: 'Instance not found' }, { status: 404 });
	}

	if (instance.type !== 'radarr' && instance.type !== 'sonarr') {
		return json({ error: `Cleanup not supported for ${instance.type}` }, { status: 400 });
	}

	const instanceType = instance.type as 'radarr' | 'sonarr';
	const client = createArrClient(instance.type as ArrType, instance.url, instance.api_key, {
		retries: 0
	});

	try {
		const [configs, entities] = await Promise.all([
			scanForStaleItems(client, instanceId)
				.then<PreviewSection<CleanupScanResult>>((data) => ({ ok: true, data }))
				.catch<PreviewSection<CleanupScanResult>>((err) => ({
					ok: false,
					error: err instanceof Error ? err.message : 'Config scan failed'
				})),
			scanForRemovedEntities(client, instanceType)
				.then<PreviewSection<EntityScanResult>>((data) => ({ ok: true, data }))
				.catch<PreviewSection<EntityScanResult>>((err) => ({
					ok: false,
					error: err instanceof Error ? err.message : 'Entity scan failed'
				}))
		]);

		const response: CleanupPreviewResponse = { configs, entities };
		return json(response);
	} finally {
		client.close();
	}
};
