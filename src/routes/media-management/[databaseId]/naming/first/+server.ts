import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pcdManager } from '$pcd/core/manager.ts';
import * as namingQueries from '$pcd/entities/mediaManagement/naming/index.ts';

export const GET: RequestHandler = async ({ params }) => {
	const dbId = parseInt(params.databaseId, 10);
	if (isNaN(dbId)) error(400, 'Invalid database ID');

	const cache = pcdManager.getCache(dbId);
	if (!cache) error(404, 'Database cache not available');

	const items = await namingQueries.list(cache);
	const path = items.length
		? `/media-management/${dbId}/naming/${items[0].arr_type}/${encodeURIComponent(items[0].name)}`
		: `/media-management/${dbId}/naming`;
	return json({ path });
};
