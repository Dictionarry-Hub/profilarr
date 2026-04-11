import { fail, redirect } from '@sveltejs/kit';
import type { Actions, ServerLoad } from '@sveltejs/kit';
import { pcdManager } from '$pcd/core/manager.ts';
import { logger } from '$logger/logger.ts';
import { schedulePcdSyncForDatabase } from '$lib/server/jobs/init.ts';
import { validateLinkInput, checkNameConflict } from '$pcd/core/validate.ts';

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

		const raw: Record<string, unknown> = {
			name: getFirstNonEmptyFormValue(formData, 'name'),
			repository_url: getFirstNonEmptyFormValue(formData, 'repository_url'),
			branch: getFirstNonEmptyFormValue(formData, 'branch'),
			personal_access_token: getFirstNonEmptyFormValue(formData, 'personal_access_token'),
			git_user_name: getFirstNonEmptyFormValue(formData, 'git_user_name'),
			git_user_email: getFirstNonEmptyFormValue(formData, 'git_user_email'),
			sync_strategy: formData.get('sync_strategy')?.toString() || '0',
			auto_pull: formData.get('auto_pull') === '1',
			local_ops_enabled: formData.get('local_ops_enabled') === '1'
		};
		const cs = formData.get('conflict_strategy')?.toString().trim();
		if (cs) raw.conflict_strategy = cs;

		const result = validateLinkInput(raw);
		if (!result.ok) {
			return fail(400, {
				error: result.error,
				values: { name: raw.name, repository_url: raw.repository_url }
			});
		}

		const { input } = result;

		// Check for common non-GitHub URLs and redirect to bruh page
		const bruhParams = new URLSearchParams({
			name: input.name,
			branch: input.branch || '',
			sync_strategy: input.syncStrategy.toString(),
			auto_pull: input.autoPull ? '1' : '0',
			local_ops_enabled: input.localOpsEnabled ? '1' : '0',
			git_user_name: input.gitUserName || '',
			git_user_email: input.gitUserEmail || ''
		});

		if (input.repositoryUrl.includes('youtube.com') || input.repositoryUrl.includes('youtu.be')) {
			redirect(
				303,
				`/databases/bruh?url=${encodeURIComponent(input.repositoryUrl)}&type=youtube&${bruhParams.toString()}`
			);
		}
		if (input.repositoryUrl.includes('twitter.com') || input.repositoryUrl.includes('x.com')) {
			redirect(
				303,
				`/databases/bruh?url=${encodeURIComponent(input.repositoryUrl)}&type=twitter&${bruhParams.toString()}`
			);
		}
		if (input.repositoryUrl.includes('reddit.com')) {
			redirect(
				303,
				`/databases/bruh?url=${encodeURIComponent(input.repositoryUrl)}&type=reddit&${bruhParams.toString()}`
			);
		}

		// Check if name already exists
		if (checkNameConflict(input.name)) {
			return fail(400, {
				error: 'A database with this name already exists',
				values: { name: input.name, repository_url: input.repositoryUrl }
			});
		}

		try {
			const instance = await pcdManager.link(input);

			await logger.info(`Linked new database: ${input.name}`, {
				source: 'databases/new',
				meta: { id: instance.id, name: input.name, repositoryUrl: input.repositoryUrl }
			});

			schedulePcdSyncForDatabase(instance.id);

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
					name: input.name,
					repositoryUrl: input.repositoryUrl,
					hasPersonalAccessToken: !!input.personalAccessToken
				}
			});

			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to link database',
				values: { name: input.name, repository_url: input.repositoryUrl }
			});
		}
	}
} satisfies Actions;
