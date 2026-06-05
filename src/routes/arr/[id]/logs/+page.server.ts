import { error } from '@sveltejs/kit';
import type { ServerLoad } from '@sveltejs/kit';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';

export const load: ServerLoad = ({ params, url }) => {
	const id = parseInt(params.id || '', 10);

	if (isNaN(id)) {
		error(404, `Invalid instance ID: ${params.id}`);
	}

	const instance = arrInstancesQueries.getById(id);

	if (!instance) {
		error(404, `Instance not found: ${id}`);
	}

	const { api_key: _, ...safeInstance } = instance;

	return {
		instance: safeInstance,
		filters: {
			page: parseInt(url.searchParams.get('page') || '1', 10),
			pageSize: parseInt(url.searchParams.get('pageSize') || '50', 10),
			level: url.searchParams.get('level') || undefined
		}
	};
};
