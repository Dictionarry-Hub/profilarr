import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { pcdManager } from '$pcd/core/manager.ts';
import * as qualityProfileQueries from '$pcd/entities/qualityProfiles/index.ts';

export const load: LayoutServerLoad = async ({ params }) => {
	const databaseId = parseInt(params.databaseId, 10);
	const profileId = parseInt(params.id, 10);

	if (isNaN(databaseId) || isNaN(profileId)) {
		error(400, 'Invalid parameters');
	}

	const database = pcdManager.getByIdPublic(databaseId);
	if (!database) error(404, 'Database not found');

	const cache = pcdManager.getCache(databaseId);
	if (!cache) error(500, 'Database cache not available');

	const profiles = await qualityProfileQueries.select(cache);
	const profile = profiles.find((p) => p.id === profileId);
	if (!profile) error(404, 'Quality profile not found');

	return {
		databaseName: database.name,
		profileName: profile.name
	};
};
