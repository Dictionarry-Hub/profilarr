import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pcdManager } from '$pcd/core/manager.ts';
import * as regularExpressionQueries from '$pcd/entities/regularExpressions/index.ts';

export const GET: RequestHandler = async ({ params }) => {
	const dbId = parseInt(params.databaseId, 10);
	if (isNaN(dbId)) error(400, 'Invalid database ID');

	const cache = pcdManager.getCache(dbId);
	if (!cache) error(404, 'Database cache not available');

	const regexes = await regularExpressionQueries.list(cache);
	const path = regexes.length
		? `/regular-expressions/${dbId}/${regexes[0].id}`
		: `/regular-expressions/${dbId}`;
	return json({ path });
};
