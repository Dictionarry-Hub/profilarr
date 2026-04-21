import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { cache } from '$cache/cache.ts';
import { logger } from '$logger/logger.ts';

export const POST: RequestHandler = async ({ params }) => {
	const instanceId = parseInt(params.id ?? '', 10);
	if (!Number.isFinite(instanceId)) {
		return json({ error: 'Invalid instance ID' }, { status: 400 });
	}

	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) {
		return json({ error: 'Instance not found' }, { status: 404 });
	}

	cache.delete(`library:${instanceId}`);
	cache.deleteByPrefix(`library-episodes:${instanceId}:`);

	await logger.debug(`Manual library refresh triggered`, {
		source: 'arr/library/refresh',
		meta: { instanceId }
	});

	return json({ success: true });
};
