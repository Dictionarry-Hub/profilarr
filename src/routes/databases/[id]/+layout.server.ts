import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';

export const load: LayoutServerLoad = ({ params }) => {
	const id = parseInt(params.id || '', 10);

	if (isNaN(id)) {
		error(400, 'Invalid database ID');
	}

	const database = databaseInstancesQueries.getById(id);

	if (!database) {
		error(404, 'Database not found');
	}

	const { personal_access_token, ...safe } = database;

	return {
		database: { ...safe, hasPat: personal_access_token !== null }
	};
};
