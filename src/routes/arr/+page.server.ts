import { fail, redirect } from '@sveltejs/kit';
import type { Actions, ServerLoad } from '@sveltejs/kit';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { cleanupJobsForArrInstance } from '$lib/server/jobs/cleanup.ts';
import { logger } from '$logger/logger.ts';

export const load: ServerLoad = () => {
	const instances = arrInstancesQueries.getAll();

	return {
		instances: instances.map(({ api_key, ...safe }) => safe)
	};
};

export const actions = {
	delete: async ({ request }) => {
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() || '0', 10);

		if (!id) {
			await logger.warn('Attempted to delete arr instance without ID', {
				source: 'arr'
			});

			return fail(400, {
				error: 'Instance ID is required'
			});
		}

		try {
			cleanupJobsForArrInstance(id);
			const deleted = arrInstancesQueries.delete(id);

			if (!deleted) {
				return fail(404, {
					error: 'Instance not found'
				});
			}

			await logger.info(`Deleted arr instance: ${id}`, {
				source: 'arr',
				meta: { id }
			});

			redirect(303, '/arr');
		} catch (error) {
			// Re-throw redirect errors (they're not actual errors)
			if (error && typeof error === 'object' && 'status' in error && 'location' in error) {
				throw error;
			}

			await logger.error('Failed to delete arr instance', {
				source: 'arr',
				meta: { error: error instanceof Error ? error.message : String(error) }
			});

			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to delete instance'
			});
		}
	}
} satisfies Actions;
