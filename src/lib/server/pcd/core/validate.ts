import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import type { LinkOptions } from './types.ts';

type ValidatedLinkInput = Omit<LinkOptions, 'conflictStrategy' | 'syncStrategy'> & {
	syncStrategy: number;
	conflictStrategy: 'override' | 'align' | 'ask';
};

type ValidationResult = { ok: true; input: ValidatedLinkInput } | { ok: false; error: string };

const VALID_CONFLICT_STRATEGIES = ['override', 'align', 'ask'] as const;

/**
 * Validate and coerce link input from either API JSON or form data.
 * Returns camelCase fields matching LinkOptions for direct use with pcdManager.link().
 */
export function validateLinkInput(body: Record<string, unknown>): ValidationResult {
	const name = typeof body.name === 'string' ? body.name.trim() : '';
	const repositoryUrl = typeof body.repository_url === 'string' ? body.repository_url.trim() : '';

	if (!name || !repositoryUrl) {
		return { ok: false, error: 'Name and repository URL are required' };
	}

	const branch =
		typeof body.branch === 'string' && body.branch.trim() ? body.branch.trim() : undefined;
	const personalAccessToken =
		typeof body.personal_access_token === 'string' && body.personal_access_token.trim()
			? body.personal_access_token.trim()
			: undefined;
	const gitUserName =
		typeof body.git_user_name === 'string' && body.git_user_name.trim()
			? body.git_user_name.trim()
			: undefined;
	const gitUserEmail =
		typeof body.git_user_email === 'string' && body.git_user_email.trim()
			? body.git_user_email.trim()
			: undefined;

	// PAT requires git identity
	if (personalAccessToken && (!gitUserName || !gitUserEmail)) {
		return {
			ok: false,
			error: 'Git author name and email are required when a personal access token is set'
		};
	}

	const localOpsEnabled = body.local_ops_enabled === true || body.local_ops_enabled === 1;
	const autoPull = body.auto_pull === true || body.auto_pull === 1;

	// local_ops_enabled requires PAT
	if (localOpsEnabled && !personalAccessToken) {
		return { ok: false, error: 'local_ops_enabled requires a personal access token' };
	}

	// conflict_strategy validation
	const rawConflictStrategy =
		typeof body.conflict_strategy === 'string' ? body.conflict_strategy.trim() : undefined;

	let conflictStrategy: 'override' | 'align' | 'ask' = 'override';
	if (rawConflictStrategy) {
		if (
			!VALID_CONFLICT_STRATEGIES.includes(
				rawConflictStrategy as (typeof VALID_CONFLICT_STRATEGIES)[number]
			)
		) {
			return {
				ok: false,
				error: `conflict_strategy must be one of: ${VALID_CONFLICT_STRATEGIES.join(', ')}`
			};
		}
		conflictStrategy = rawConflictStrategy as 'override' | 'align' | 'ask';

		// conflict_strategy is only valid without PAT, or with PAT + local_ops_enabled
		if (personalAccessToken && !localOpsEnabled) {
			return {
				ok: false,
				error: 'conflict_strategy cannot be set when using a PAT without local_ops_enabled'
			};
		}
	}

	const syncStrategy =
		typeof body.sync_strategy === 'number'
			? Math.floor(body.sync_strategy)
			: typeof body.sync_strategy === 'string'
				? parseInt(body.sync_strategy, 10) || 0
				: 0;

	return {
		ok: true,
		input: {
			name,
			repositoryUrl,
			branch,
			personalAccessToken,
			gitUserName,
			gitUserEmail,
			syncStrategy,
			autoPull,
			localOpsEnabled,
			conflictStrategy
		}
	};
}

/**
 * Check if a database name is already taken.
 */
export function checkNameConflict(name: string, excludeId?: number): boolean {
	return databaseInstancesQueries.nameExists(name, excludeId);
}
