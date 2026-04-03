import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';

export const GET: RequestHandler = async () => {
	const instances = arrInstancesQueries.getAll().map(({ api_key, ...safe }) => safe);
	return json(instances);
};
