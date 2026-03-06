import type { ServerLoad } from '@sveltejs/kit';
import { pcdManager } from '$pcd/index.ts';
import { redirectToLastDatabase } from '$utils/redirect/lastDatabase.ts';

export const load: ServerLoad = ({ cookies }) => {
	redirectToLastDatabase(cookies, 'last_db_re', '/regular-expressions');

	return {
		databases: pcdManager.getAllPublic()
	};
};
