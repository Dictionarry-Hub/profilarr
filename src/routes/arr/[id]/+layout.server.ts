import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { arrSyncQueries } from '$db/queries/arrSync.ts';

export const load: LayoutServerLoad = ({ params }) => {
	const id = parseInt(params.id || '', 10);

	if (isNaN(id)) {
		error(404, `Invalid instance ID: ${params.id}`);
	}

	const instance = arrInstancesQueries.getById(id);

	if (!instance) {
		error(404, `Instance not found: ${id}`);
	}

	const { api_key, ...safe } = instance;

	const sync = arrSyncQueries.getFullSyncData(id);
	const hasSyncConfig =
		sync.qualityProfiles.selections.length > 0 ||
		(!!sync.delayProfiles.databaseId && !!sync.delayProfiles.profileName) ||
		!!sync.mediaManagement.namingDatabaseId ||
		!!sync.mediaManagement.qualityDefinitionsDatabaseId ||
		!!sync.mediaManagement.mediaSettingsDatabaseId;

	return {
		instance: safe,
		hasSyncConfig
	};
};
