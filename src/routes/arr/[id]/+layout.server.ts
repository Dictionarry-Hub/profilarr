import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { arrInstancesQueries, toPublicArrInstance } from '$db/queries/arrInstances.ts';
import { arrSyncQueries } from '$db/queries/arrSync.ts';
import { arrDriftStatusQueries } from '$db/queries/arrDriftStatus.ts';

export const load: LayoutServerLoad = ({ params }) => {
	const id = parseInt(params.id || '', 10);

	if (isNaN(id)) {
		error(404, `Invalid instance ID: ${params.id}`);
	}

	const instance = arrInstancesQueries.getById(id);

	if (!instance) {
		error(404, `Instance not found: ${id}`);
	}

	const safe = toPublicArrInstance(instance);

	const sync = arrSyncQueries.getFullSyncData(id);
	const hasSyncConfig =
		sync.qualityProfiles.selections.length > 0 ||
		(!!sync.delayProfiles.databaseId && !!sync.delayProfiles.profileName) ||
		!!sync.mediaManagement.namingDatabaseId ||
		!!sync.mediaManagement.qualityDefinitionsDatabaseId ||
		!!sync.mediaManagement.mediaSettingsDatabaseId;

	const driftStatus = arrDriftStatusQueries.getByInstanceId(id);
	const driftCount =
		driftStatus?.status === 'drift_detected'
			? Object.values(driftStatus.counts).reduce((sum, n) => sum + (n ?? 0), 0)
			: 0;

	return {
		instance: safe,
		hasSyncConfig,
		driftCount
	};
};
