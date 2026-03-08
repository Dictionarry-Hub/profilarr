import type { ServerLoad } from '@sveltejs/kit';
import { pcdManager } from '$pcd/core/manager.ts';
import { redirectToLastDatabase } from '$utils/redirect/lastDatabase.ts';

export const load: ServerLoad = ({ cookies }) => {
	redirectToLastDatabase(cookies, 'last_db_et', '/quality-profiles/entity-testing');

	return {
		databases: pcdManager.getAllPublic()
	};
};
