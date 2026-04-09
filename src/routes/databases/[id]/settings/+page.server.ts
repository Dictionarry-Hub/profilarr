import { redirect, fail } from '@sveltejs/kit';
import type { Actions } from '@sveltejs/kit';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { pcdManager } from '$pcd/core/manager.ts';
import { validateUpdateInput, checkNameConflict } from '$pcd/core/validate.ts';
import { logger } from '$logger/logger.ts';
import { schedulePcdSyncForDatabase } from '$lib/server/jobs/init.ts';

export const actions: Actions = {
	update: async ({ params, request }) => {
		const id = parseInt(params.id || '', 10);

		if (isNaN(id)) {
			await logger.warn('Update failed: Invalid database ID', {
				source: 'databases/[id]/settings',
				meta: { id: params.id }
			});
			return fail(400, { error: 'Invalid database ID' });
		}

		const instance = databaseInstancesQueries.getById(id);
		if (!instance) {
			await logger.warn('Update failed: Database not found', {
				source: 'databases/[id]/settings',
				meta: { id }
			});
			return fail(404, { error: 'Database not found' });
		}

		const formData = await request.formData();
		const raw: Record<string, unknown> = {};
		raw.name = formData.get('name')?.toString();
		raw.sync_strategy = formData.get('sync_strategy')?.toString();
		raw.auto_pull = formData.get('auto_pull') === '1';
		raw.local_ops_enabled = formData.get('local_ops_enabled') === '1';
		const pat = formData.get('personal_access_token')?.toString().trim();
		if (pat) raw.personal_access_token = pat;
		if (formData.has('git_user_name'))
			raw.git_user_name = formData.get('git_user_name')?.toString();
		if (formData.has('git_user_email'))
			raw.git_user_email = formData.get('git_user_email')?.toString();
		const cs = formData.get('conflict_strategy')?.toString().trim();
		if (cs) raw.conflict_strategy = cs;

		const result = validateUpdateInput(raw);
		if (!result.ok) {
			return fail(400, { error: result.error, values: { name: raw.name } });
		}

		const { input } = result;

		if (input.name && checkNameConflict(input.name, id)) {
			await logger.warn('Attempted to update database with duplicate name', {
				source: 'databases/[id]/settings',
				meta: { id, name: input.name }
			});
			return fail(400, {
				error: 'A database with this name already exists',
				values: { name: input.name }
			});
		}

		try {
			const updated = databaseInstancesQueries.update(id, input);
			if (!updated) {
				throw new Error('Update returned false');
			}

			await logger.info(`Updated database: ${input.name ?? instance.name}`, {
				source: 'databases/[id]/settings',
				meta: { id, name: input.name ?? instance.name }
			});

			schedulePcdSyncForDatabase(id);

			return { success: true };
		} catch (err) {
			await logger.error('Failed to update database', {
				source: 'databases/[id]/settings',
				meta: { error: err instanceof Error ? err.message : String(err) }
			});

			return fail(500, {
				error: 'Failed to update database',
				values: { name: input.name }
			});
		}
	},

	delete: async ({ params }) => {
		const id = parseInt(params.id || '', 10);

		if (isNaN(id)) {
			await logger.warn('Delete failed: Invalid database ID', {
				source: 'databases/[id]/settings',
				meta: { id: params.id }
			});
			return fail(400, { error: 'Invalid database ID' });
		}

		const instance = databaseInstancesQueries.getById(id);
		if (!instance) {
			await logger.warn('Delete failed: Database not found', {
				source: 'databases/[id]/settings',
				meta: { id }
			});
			return fail(404, { error: 'Database not found' });
		}

		try {
			await pcdManager.unlink(id);

			await logger.info(`Unlinked database: ${instance.name}`, {
				source: 'databases/[id]/settings',
				meta: { id, name: instance.name, repositoryUrl: instance.repository_url }
			});

			redirect(303, '/databases');
		} catch (err) {
			if (err && typeof err === 'object' && 'status' in err && 'location' in err) {
				throw err;
			}

			await logger.error('Failed to unlink database', {
				source: 'databases/[id]/settings',
				meta: { error: err instanceof Error ? err.message : String(err) }
			});

			return fail(500, { error: 'Failed to unlink database' });
		}
	}
};
