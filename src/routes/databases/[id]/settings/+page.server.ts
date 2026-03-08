import { redirect, fail } from '@sveltejs/kit';
import type { Actions } from '@sveltejs/kit';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import type { ConflictStrategy } from '$db/queries/databaseInstances.ts';
import { pcdManager } from '$pcd/core/manager.ts';
import { logger } from '$logger/logger.ts';
import { schedulePcdSyncForDatabase } from '$lib/server/jobs/init.ts';

export const actions: Actions = {
	update: async ({ params, request }) => {
		const id = parseInt(params.id || '', 10);

		// Validate ID
		if (isNaN(id)) {
			await logger.warn('Update failed: Invalid database ID', {
				source: 'databases/[id]/settings',
				meta: { id: params.id }
			});
			return fail(400, { error: 'Invalid database ID' });
		}

		// Fetch the instance to verify it exists
		const instance = databaseInstancesQueries.getById(id);

		if (!instance) {
			await logger.warn('Update failed: Database not found', {
				source: 'databases/[id]/settings',
				meta: { id }
			});
			return fail(404, { error: 'Database not found' });
		}

		const formData = await request.formData();

		const name = formData.get('name')?.toString().trim();
		const syncStrategy = parseInt(formData.get('sync_strategy')?.toString() || '0', 10);
		const autoPull = formData.get('auto_pull') === '1';
		const localOpsEnabled = formData.get('local_ops_enabled') === '1';
		const personalAccessToken =
			formData.get('personal_access_token')?.toString().trim() || undefined;
		const gitUserName = formData.has('git_user_name')
			? formData.get('git_user_name')?.toString().trim() || null
			: undefined;
		const gitUserEmail = formData.has('git_user_email')
			? formData.get('git_user_email')?.toString().trim() || null
			: undefined;
		const conflictStrategyRaw = formData.get('conflict_strategy')?.toString().trim() || '';
		const validConflictStrategies: ConflictStrategy[] = ['override', 'align', 'ask'];
		const conflictStrategy = validConflictStrategies.includes(
			conflictStrategyRaw as ConflictStrategy
		)
			? (conflictStrategyRaw as ConflictStrategy)
			: instance.conflict_strategy;

		if (
			conflictStrategyRaw &&
			!validConflictStrategies.includes(conflictStrategyRaw as ConflictStrategy)
		) {
			await logger.warn('Attempted to update database with invalid conflict strategy', {
				source: 'databases/[id]/settings',
				meta: { id, conflictStrategy: conflictStrategyRaw }
			});
			return fail(400, { error: 'Invalid conflict strategy' });
		}

		// Validation
		if (!name) {
			await logger.warn('Attempted to update database with missing required fields', {
				source: 'databases/[id]/settings',
				meta: { id, name }
			});

			return fail(400, {
				error: 'Name is required',
				values: { name }
			});
		}
		if (personalAccessToken && (!gitUserName || !gitUserEmail)) {
			return fail(400, {
				error: 'Git author name and email are required when a personal access token is set',
				values: { name }
			});
		}

		// Check if name already exists (excluding current instance)
		if (databaseInstancesQueries.nameExists(name, id)) {
			await logger.warn('Attempted to update database with duplicate name', {
				source: 'databases/[id]/settings',
				meta: { id, name }
			});

			return fail(400, {
				error: 'A database with this name already exists',
				values: { name }
			});
		}

		try {
			// Update the database
			const updated = databaseInstancesQueries.update(id, {
				name,
				syncStrategy,
				autoPull,
				personalAccessToken,
				localOpsEnabled,
				gitUserName,
				gitUserEmail,
				conflictStrategy
			});

			if (!updated) {
				throw new Error('Update returned false');
			}

			await logger.info(`Updated database: ${name}`, {
				source: 'databases/[id]/settings',
				meta: { id, name }
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
				values: { name }
			});
		}
	},

	delete: async ({ params }) => {
		const id = parseInt(params.id || '', 10);

		// Validate ID
		if (isNaN(id)) {
			await logger.warn('Delete failed: Invalid database ID', {
				source: 'databases/[id]/settings',
				meta: { id: params.id }
			});
			return fail(400, { error: 'Invalid database ID' });
		}

		// Fetch the instance to verify it exists
		const instance = databaseInstancesQueries.getById(id);

		if (!instance) {
			await logger.warn('Delete failed: Database not found', {
				source: 'databases/[id]/settings',
				meta: { id }
			});
			return fail(404, { error: 'Database not found' });
		}

		try {
			// Unlink the database
			await pcdManager.unlink(id);

			await logger.info(`Unlinked database: ${instance.name}`, {
				source: 'databases/[id]/settings',
				meta: { id, name: instance.name, repositoryUrl: instance.repository_url }
			});

			// Redirect to databases list
			redirect(303, '/databases');
		} catch (err) {
			// Re-throw redirect errors (they're not actual errors)
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
