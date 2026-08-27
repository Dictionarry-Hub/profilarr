import { redirect } from '$utils/redirect/redirect.ts';
import type { Actions } from '@sveltejs/kit';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { cache } from '$cache/cache.ts';
import { cleanupJobsForArrInstance } from '$lib/server/jobs/cleanup.ts';

export const actions: Actions = {
	delete: ({ params }) => {
		const id = parseInt(params.id || '', 10);
		if (!isNaN(id)) {
			cleanupJobsForArrInstance(id);
			arrInstancesQueries.delete(id);
			cache.delete(`library:${id}`);
		}
		redirect(303, '/arr');
	}
};
