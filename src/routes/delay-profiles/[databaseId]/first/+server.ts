import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pcdManager } from '$pcd/core/manager.ts';
import * as delayProfileQueries from '$pcd/entities/delayProfiles/index.ts';

export const GET: RequestHandler = async ({ params }) => {
	const dbId = parseInt(params.databaseId, 10);
	if (isNaN(dbId)) error(400, 'Invalid database ID');

	const cache = pcdManager.getCache(dbId);
	if (!cache) error(404, 'Database cache not available');

	const profiles = await delayProfileQueries.list(cache);
	const path = profiles.length
		? `/delay-profiles/${dbId}/${encodeURIComponent(profiles[0].name)}`
		: `/delay-profiles/${dbId}/new`;
	return json({ path });
};
