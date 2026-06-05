import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { createArrClient } from '$arr/factory.ts';
import type { ArrType } from '$arr/types.ts';

export const GET: RequestHandler = async ({ params, url }) => {
	const id = parseInt(params.id || '', 10);

	if (isNaN(id)) {
		error(400, 'Invalid instance ID');
	}

	const instance = arrInstancesQueries.getById(id);

	if (!instance) {
		error(404, 'Instance not found');
	}

	const page = parseInt(url.searchParams.get('page') || '1', 10);
	const pageSize = parseInt(url.searchParams.get('pageSize') || '50', 10);
	const level = url.searchParams.get('level') || undefined;

	const client = createArrClient(instance.type as ArrType, instance.url, instance.api_key);

	try {
		const logs = await client.getLogs({
			page,
			pageSize,
			sortKey: 'time',
			sortDirection: 'descending',
			level: level as 'Trace' | 'Debug' | 'Info' | 'Warn' | 'Error' | 'Fatal' | undefined
		});

		return json(logs);
	} catch (err) {
		error(502, `Failed to fetch logs: ${err instanceof Error ? err.message : 'Unknown error'}`);
	} finally {
		client.close();
	}
};
