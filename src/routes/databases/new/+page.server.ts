import { fail, redirect } from '@sveltejs/kit';
import type { Actions, ServerLoad } from '@sveltejs/kit';
import { pcdManager } from '$pcd/core/manager.ts';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { logger } from '$logger/logger.ts';
import { schedulePcdSyncForDatabase } from '$lib/server/jobs/init.ts';

function getFirstNonEmptyFormValue(formData: FormData, key: string): string | undefined {
	const values = formData
		.getAll(key)
		.map((value) => value.toString().trim())
		.filter((value) => value.length > 0);
	return values.length > 0 ? values[0] : undefined;
}

export const load: ServerLoad = ({ url }) => {
	const name = url.searchParams.get('name') || '';
	const branch = url.searchParams.get('branch') || '';
	const syncStrategy = url.searchParams.get('sync_strategy') || '';
	const autoPull = url.searchParams.get('auto_pull') || '';
	const localOpsEnabled = url.searchParams.get('local_ops_enabled') || '';
	const gitUserName = url.searchParams.get('git_user_name') || '';
	const gitUserEmail = url.searchParams.get('git_user_email') || '';

	return {
		formData: {
			name,
			branch,
			syncStrategy,
			autoPull,
			localOpsEnabled,
			gitUserName,
			gitUserEmail
		}
	};
};

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData();

		const name = getFirstNonEmptyFormValue(formData, 'name');
		const repositoryUrl = getFirstNonEmptyFormValue(formData, 'repository_url');
		const branch = getFirstNonEmptyFormValue(formData, 'branch');
		const syncStrategy = parseInt(formData.get('sync_strategy')?.toString() || '0', 10);
		const autoPull = formData.get('auto_pull') === '1';
		const localOpsEnabled = formData.get('local_ops_enabled') === '1';
		const personalAccessToken = getFirstNonEmptyFormValue(formData, 'personal_access_token');
		const gitUserName = getFirstNonEmptyFormValue(formData, 'git_user_name');
		const gitUserEmail = getFirstNonEmptyFormValue(formData, 'git_user_email');
		const conflictStrategy = formData.get('conflict_strategy')?.toString().trim() || 'override';

		// Validation
		if (!name || !repositoryUrl) {
			await logger.warn('Attempted to link database with missing required fields', {
				source: 'databases/new',
				meta: { name, repositoryUrl }
			});

			return fail(400, {
				error: 'Name and repository URL are required',
				values: { name, repository_url: repositoryUrl }
			});
		}
		if (personalAccessToken && (!gitUserName || !gitUserEmail)) {
			return fail(400, {
				error: 'Git author name and email are required when a personal access token is set',
				values: {
					name,
					repository_url: repositoryUrl,
					branch: branch ?? '',
					git_user_name: gitUserName ?? '',
					git_user_email: gitUserEmail ?? ''
				}
			});
		}

		// Check for common non-GitHub URLs and redirect to bruh page
		const bruhParams = new URLSearchParams({
			name: name,
			branch: branch || '',
			sync_strategy: syncStrategy.toString(),
			auto_pull: autoPull ? '1' : '0',
			local_ops_enabled: localOpsEnabled ? '1' : '0',
			git_user_name: gitUserName || '',
			git_user_email: gitUserEmail || ''
		});

		if (repositoryUrl.includes('youtube.com') || repositoryUrl.includes('youtu.be')) {
			redirect(
				303,
				`/databases/bruh?url=${encodeURIComponent(repositoryUrl)}&type=youtube&${bruhParams.toString()}`
			);
		}
		if (repositoryUrl.includes('twitter.com') || repositoryUrl.includes('x.com')) {
			redirect(
				303,
				`/databases/bruh?url=${encodeURIComponent(repositoryUrl)}&type=twitter&${bruhParams.toString()}`
			);
		}
		if (repositoryUrl.includes('reddit.com')) {
			redirect(
				303,
				`/databases/bruh?url=${encodeURIComponent(repositoryUrl)}&type=reddit&${bruhParams.toString()}`
			);
		}

		// Check if name already exists
		if (databaseInstancesQueries.nameExists(name)) {
			await logger.warn('Attempted to link database with duplicate name', {
				source: 'databases/new',
				meta: { name }
			});

			return fail(400, {
				error: 'A database with this name already exists',
				values: { name, repository_url: repositoryUrl }
			});
		}

		try {
			await logger.debug('Link database request parsed', {
				source: 'databases/new',
				meta: {
					name,
					repositoryUrl,
					hasPersonalAccessToken: !!personalAccessToken,
					patValueCount: formData.getAll('personal_access_token').length
				}
			});

			// Link the database
			const instance = await pcdManager.link({
				name,
				repositoryUrl,
				branch,
				syncStrategy,
				autoPull,
				personalAccessToken,
				localOpsEnabled,
				gitUserName,
				gitUserEmail,
				conflictStrategy
			});

			await logger.info(`Linked new database: ${name}`, {
				source: 'databases/new',
				meta: { id: instance.id, name, repositoryUrl }
			});

			schedulePcdSyncForDatabase(instance.id);

			// Redirect to databases list
			redirect(303, '/databases');
		} catch (error) {
			// Re-throw redirect errors (they're not actual errors)
			if (error && typeof error === 'object' && 'status' in error && 'location' in error) {
				throw error;
			}

			await logger.error('Failed to link database', {
				source: 'databases/new',
				meta: {
					error: error instanceof Error ? error.message : String(error),
					name,
					repositoryUrl,
					hasPersonalAccessToken: !!personalAccessToken
				}
			});

			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to link database',
				values: { name, repository_url: repositoryUrl }
			});
		}
	}
} satisfies Actions;
