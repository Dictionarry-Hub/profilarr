import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { components } from '$api/v1';
import { arrInstancesQueries, toPublicArrInstance } from '$db/queries/arrInstances.ts';

type ArrInstance = components['schemas']['ArrInstance'];

export const GET: RequestHandler = async () => {
	const instances = arrInstancesQueries.getAll().map(toPublicArrInstance) as ArrInstance[];
	return json(instances);
};
