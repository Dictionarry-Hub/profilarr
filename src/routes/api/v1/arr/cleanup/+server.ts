import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { createArrClient } from '$utils/arr/factory.ts';
import { scanForStaleItems } from '$lib/server/sync/cleanup.ts';
import { scanForRemovedEntities } from '$lib/server/sync/entityCleanup.ts';
import type { ArrType } from '$utils/arr/types.ts';

const VALID_ACTIONS = ['scan', 'scan-entities'] as const;
type Action = (typeof VALID_ACTIONS)[number];

/**
 * POST /api/v1/arr/cleanup
 *
 * Preview-only endpoints used by the cleanup modal. Deletion is performed by the
 * `arr.cleanup` job handler (scheduled runs or manual enqueue via the settings page's
 * runCleanupNow action).
 *
 * Body (scan):          { instanceId, action: 'scan' }
 * Body (scan-entities): { instanceId, action: 'scan-entities' }
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { instanceId, action } = body;

	if (!instanceId || typeof instanceId !== 'number') {
		return json({ error: 'instanceId is required' }, { status: 400 });
	}

	if (!VALID_ACTIONS.includes(action)) {
		return json({ error: `action must be one of: ${VALID_ACTIONS.join(', ')}` }, { status: 400 });
	}

	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) {
		return json({ error: 'Instance not found' }, { status: 404 });
	}

	const instanceType = instance.type as 'radarr' | 'sonarr';

	// Disable retries so "in use" HTTP 500 from the arr fails fast
	const client = createArrClient(instance.type as ArrType, instance.url, instance.api_key, {
		retries: 0
	});

	try {
		switch (action as Action) {
			case 'scan': {
				const result = await scanForStaleItems(client, instanceId);
				return json(result);
			}

			case 'scan-entities': {
				const result = await scanForRemovedEntities(client, instanceType);
				return json(result);
			}
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Cleanup failed';
		return json({ error: message }, { status: 500 });
	} finally {
		client.close();
	}
};
