import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import type {
	UpdateDatabaseInstanceInput,
	ConflictStrategy
} from '$db/queries/databaseInstances.ts';
import type { LinkOptions } from './types.ts';

type ValidatedLinkInput = Omit<LinkOptions, 'conflictStrategy' | 'syncStrategy'> & {
	syncStrategy: number;
	conflictStrategy: 'override' | 'align' | 'ask';
};

type ValidationResult = { ok: true; input: ValidatedLinkInput } | { ok: false; error: string };

type UpdateValidationResult =
	| { ok: true; input: UpdateDatabaseInstanceInput }
	| { ok: false; error: string };

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
 * Validate and coerce update input from either API JSON or form data.
 * All fields are optional. Unknown fields are silently ignored.
 * Returns camelCase fields matching UpdateDatabaseInstanceInput.
 */
export function validateUpdateInput(body: Record<string, unknown>): UpdateValidationResult {
	const input: UpdateDatabaseInstanceInput = {};

	if (typeof body.name === 'string') {
		const name = body.name.trim();
		if (!name) {
			return { ok: false, error: 'Name cannot be empty' };
		}
		input.name = name;
	}

	if (typeof body.personal_access_token === 'string') {
		input.personalAccessToken = body.personal_access_token.trim() || undefined;
	}

	if (typeof body.git_user_name === 'string') {
		input.gitUserName = body.git_user_name.trim() || null;
	}

	if (typeof body.git_user_email === 'string') {
		input.gitUserEmail = body.git_user_email.trim() || null;
	}

	if (body.sync_strategy !== undefined) {
		input.syncStrategy =
			typeof body.sync_strategy === 'number'
				? Math.floor(body.sync_strategy)
				: typeof body.sync_strategy === 'string'
					? parseInt(body.sync_strategy, 10) || 0
					: 0;
	}

	if (body.auto_pull !== undefined) {
		input.autoPull = body.auto_pull === true || body.auto_pull === 1;
	}

	if (body.local_ops_enabled !== undefined) {
		input.localOpsEnabled = body.local_ops_enabled === true || body.local_ops_enabled === 1;
	}

	if (typeof body.conflict_strategy === 'string') {
		const raw = body.conflict_strategy.trim();
		if (!VALID_CONFLICT_STRATEGIES.includes(raw as ConflictStrategy)) {
			return {
				ok: false,
				error: `conflict_strategy must be one of: ${VALID_CONFLICT_STRATEGIES.join(', ')}`
			};
		}
		input.conflictStrategy = raw as ConflictStrategy;
	}

	// Must have at least one updatable field
	if (Object.keys(input).length === 0) {
		return { ok: false, error: 'No updatable fields provided' };
	}

	// PAT requires git identity
	if (input.personalAccessToken && !input.gitUserName && !input.gitUserEmail) {
		return {
			ok: false,
			error: 'Git author name and email are required when a personal access token is set'
		};
	}

	// local_ops_enabled requires PAT
	if (input.localOpsEnabled && !input.personalAccessToken) {
		return { ok: false, error: 'local_ops_enabled requires a personal access token' };
	}

	// conflict_strategy is only valid without PAT, or with PAT + local_ops_enabled
	if (input.conflictStrategy && input.personalAccessToken && !input.localOpsEnabled) {
		return {
			ok: false,
			error: 'conflict_strategy cannot be set when using a PAT without local_ops_enabled'
		};
	}

	return { ok: true, input };
}

/**
 * Check if a database name is already taken.
 */
export function checkNameConflict(name: string, excludeId?: number): boolean {
	return databaseInstancesQueries.nameExists(name, excludeId);
}
