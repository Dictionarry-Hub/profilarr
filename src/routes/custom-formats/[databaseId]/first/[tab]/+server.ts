import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pcdManager } from '$pcd/core/manager.ts';
import * as customFormatQueries from '$pcd/entities/customFormats/index.ts';

const TABS = new Set(['general', 'conditions', 'testing']);

export const GET: RequestHandler = async ({ params }) => {
	const dbId = parseInt(params.databaseId, 10);
	if (isNaN(dbId)) error(400, 'Invalid database ID');
	if (!TABS.has(params.tab)) error(400, 'Invalid tab');

	const cache = pcdManager.getCache(dbId);
	if (!cache) error(404, 'Database cache not available');

	const cfs = await customFormatQueries.list(cache);
	const path = cfs.length
		? `/custom-formats/${dbId}/${cfs[0].id}/${params.tab}`
		: `/custom-formats/${dbId}`;
	return json({ path });
};
