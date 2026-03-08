import { fail, redirect } from '@sveltejs/kit';
import type { Actions, ServerLoad } from '@sveltejs/kit';
import { pcdManager } from '$pcd/core/manager.ts';
import { logger } from '$logger/logger.ts';

export const load: ServerLoad = () => {
	const databases = pcdManager.getAllPublic();

	return {
		databases
	};
};

export const actions = {
	delete: async ({ request }) => {
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() || '0', 10);

		if (!id) {
			await logger.warn('Attempted to unlink database without ID', {
				source: 'databases'
			});

			return fail(400, {
				error: 'Database ID is required'
			});
		}

		try {
			await pcdManager.unlink(id);

			await logger.info(`Unlinked database: ${id}`, {
				source: 'databases',
				meta: { id }
			});

			redirect(303, '/databases');
		} catch (error) {
			// Re-throw redirect errors (they're not actual errors)
			if (error && typeof error === 'object' && 'status' in error && 'location' in error) {
				throw error;
			}

			await logger.error('Failed to unlink database', {
				source: 'databases',
				meta: { error: error instanceof Error ? error.message : String(error) }
			});

			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to unlink database'
			});
		}
	}
} satisfies Actions;
