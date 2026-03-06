import { error } from '@sveltejs/kit';
import type { ServerLoad } from '@sveltejs/kit';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';

export const load: ServerLoad = ({ params }) => {
	const id = parseInt(params.id || '', 10);

	if (isNaN(id)) {
		error(400, 'Invalid database ID');
	}

	const database = databaseInstancesQueries.getById(id);

	if (!database) {
		error(404, 'Database not found');
	}

	const { personal_access_token: _, ...safe } = database;

	return {
		database: safe
	};
};
