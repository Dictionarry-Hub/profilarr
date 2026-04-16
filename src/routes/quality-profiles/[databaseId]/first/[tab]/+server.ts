import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pcdManager } from '$pcd/core/manager.ts';
import * as qualityProfileQueries from '$pcd/entities/qualityProfiles/index.ts';

const TABS = new Set(['general', 'scoring', 'qualities']);

export const GET: RequestHandler = async ({ params }) => {
	const dbId = parseInt(params.databaseId, 10);
	if (isNaN(dbId)) error(400, 'Invalid database ID');
	if (!TABS.has(params.tab)) error(400, 'Invalid tab');

	const cache = pcdManager.getCache(dbId);
	if (!cache) error(404, 'Database cache not available');

	const profiles = await qualityProfileQueries.list(cache);
	const path = profiles.length
		? `/quality-profiles/${dbId}/${profiles[0].id}/${params.tab}`
		: `/quality-profiles/${dbId}`;
	return json({ path });
};
