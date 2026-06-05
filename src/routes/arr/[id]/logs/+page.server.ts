import { error } from '@sveltejs/kit';
import type { ServerLoad } from '@sveltejs/kit';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { createArrClient } from '$arr/factory.ts';
import type { ArrType } from '$arr/types.ts';

export const load: ServerLoad = ({ params, url }) => {
	const id = parseInt(params.id || '', 10);

	if (isNaN(id)) {
		error(404, `Invalid instance ID: ${params.id}`);
	}

	const instance = arrInstancesQueries.getById(id);

	if (!instance) {
		error(404, `Instance not found: ${id}`);
	}

	// Parse query params for pagination/filtering
	const page = parseInt(url.searchParams.get('page') || '1', 10);
	const pageSize = parseInt(url.searchParams.get('pageSize') || '50', 10);
	const level = url.searchParams.get('level') || undefined;

	const client = createArrClient(instance.type as ArrType, instance.url, instance.api_key);

	// Stream the logs promise so navigation isn't blocked by the arr HTTP call
	const logs = client
		.getLogs({
			page,
			pageSize,
			sortKey: 'time',
			sortDirection: 'descending',
			level: level as 'Trace' | 'Debug' | 'Info' | 'Warn' | 'Error' | 'Fatal' | undefined
		})
		.finally(() => client.close());

	const { api_key: _, ...safeInstance } = instance;

	return {
		instance: safeInstance,
		logs,
		filters: {
			page,
			pageSize,
			level
		}
	};
};
