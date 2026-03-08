import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { pcdManager } from '$pcd/core/manager.ts';
import { list } from '$pcd/entities/mediaManagement/quality-definitions/read.ts';

export const load: PageServerLoad = async ({ params }) => {
	const { databaseId } = params;

	if (!databaseId) {
		throw error(400, 'Missing database ID');
	}

	const currentDatabaseId = parseInt(databaseId, 10);
	if (isNaN(currentDatabaseId)) {
		throw error(400, 'Invalid database ID');
	}

	const cache = pcdManager.getCache(currentDatabaseId);
	if (!cache) {
		throw error(500, 'Database cache not available');
	}

	const qualityDefinitionsConfigs = await list(cache);

	return {
		qualityDefinitionsConfigs
	};
};
