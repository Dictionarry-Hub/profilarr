import { redirect } from '$utils/redirect/redirect.ts';
import type { ServerLoad } from '@sveltejs/kit';
import { arrSyncQueries } from '$db/queries/arrSync.ts';

export const load: ServerLoad = ({ params }) => {
	const id = parseInt(params.id || '', 10);
	const sync = arrSyncQueries.getFullSyncData(id);

	const hasSyncConfig =
		sync.qualityProfiles.selections.length > 0 ||
		(!!sync.delayProfiles.databaseId && !!sync.delayProfiles.profileName) ||
		!!sync.mediaManagement.namingDatabaseId ||
		!!sync.mediaManagement.qualityDefinitionsDatabaseId ||
		!!sync.mediaManagement.mediaSettingsDatabaseId;

	redirect(302, `/arr/${params.id}/${hasSyncConfig ? 'library' : 'sync'}`);
};
