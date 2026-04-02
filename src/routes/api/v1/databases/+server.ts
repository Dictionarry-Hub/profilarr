import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { pcdManager } from '$pcd/core/manager.ts';

export const GET: RequestHandler = async () => {
	const databases = pcdManager.getAllPublic().map(({ local_path, ...rest }) => rest);
	return json(databases);
};
