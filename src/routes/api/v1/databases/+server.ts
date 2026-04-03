import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { components } from '$api/v1';
import { pcdManager } from '$pcd/core/manager.ts';

type DatabaseInstance = components['schemas']['DatabaseInstance'];

export const GET: RequestHandler = async () => {
	const databases: DatabaseInstance[] = pcdManager
		.getAllPublic()
		.map(({ local_path, ...rest }) => rest);
	return json(databases);
};
