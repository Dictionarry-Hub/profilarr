/**
 * Git repository commands
 */

import { execGit, execGitSafe } from './exec.ts';
import type { RepoInfo } from './types.ts';
import { getCachedRepoInfo } from '../github/cache.ts';

type GitHubApiError = {
	message: string;
	rateLimited: boolean;
};

async function parseGitHubErrorResponse(response: Response): Promise<{
	message: string;
	rateLimited: boolean;
	retryAfterSeconds: number | null;
	resetAtEpoch: number | null;
}> {
	let apiMessage = '';
	try {
		const payload = await response.json();
		if (
			payload &&
			typeof payload === 'object' &&
			'message' in payload &&
			typeof payload.message === 'string'
		) {
			apiMessage = payload.message;
		}
	} catch {
		// Ignore JSON parse failures and rely on status/headers.
	}

	const messageLower = apiMessage.toLowerCase();
	const retryAfterRaw = response.headers.get('retry-after');
	const retryAfterSeconds = retryAfterRaw ? Number.parseInt(retryAfterRaw, 10) : null;
	const resetAtRaw = response.headers.get('x-ratelimit-reset');
	const resetAtEpoch = resetAtRaw ? Number.parseInt(resetAtRaw, 10) : null;
	const remaining = response.headers.get('x-ratelimit-remaining');

	const rateLimited =
		response.status === 429 ||
		remaining === '0' ||
		messageLower.includes('rate limit') ||
		messageLower.includes('secondary rate limit');

	return {
		message: apiMessage,
		rateLimited,
		retryAfterSeconds:
			retryAfterSeconds !== null && Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null,
		resetAtEpoch: resetAtEpoch !== null && Number.isFinite(resetAtEpoch) ? resetAtEpoch : null
	};
}

function formatRateLimitMessage(
	context: 'authenticated' | 'unauthenticated',
	retryAfterSeconds: number | null,
	resetAtEpoch: number | null
): string {
	let hint = '';
	if (retryAfterSeconds !== null && retryAfterSeconds > 0) {
		hint = ` Retry after ~${retryAfterSeconds} seconds.`;
	} else if (resetAtEpoch !== null && resetAtEpoch > 0) {
		hint = ` Rate limit resets around ${new Date(resetAtEpoch * 1000).toISOString()}.`;
	}

	if (context === 'authenticated') {
		return `GitHub API rate limit exceeded for the supplied Personal Access Token.${hint}`;
	}

	return `GitHub API rate limit exceeded for unauthenticated requests.${hint} Add a Personal Access Token to avoid this limit.`;
}

async function classifyGitHubResponseError(
	response: Response,
	context: 'authenticated' | 'unauthenticated'
): Promise<GitHubApiError> {
	const parsed = await parseGitHubErrorResponse(response);

	if (parsed.rateLimited) {
		return {
			message: formatRateLimitMessage(context, parsed.retryAfterSeconds, parsed.resetAtEpoch),
			rateLimited: true
		};
	}

	if (context === 'authenticated') {
		if (response.status === 401) {
			return {
				message: 'Unable to access repository. Please check your Personal Access Token.',
				rateLimited: false
			};
		}

		if (response.status === 404) {
			return {
				message:
					'Repository not found or inaccessible with this Personal Access Token. Verify the URL and token permissions.',
				rateLimited: false
			};
		}

		if (response.status === 403) {
			return {
				message:
					'GitHub denied access to this repository with the supplied Personal Access Token. Check token permissions.',
				rateLimited: false
			};
		}
	} else {
		if (response.status === 404) {
			return {
				message:
					'Repository not found. If this repository is private, provide a Personal Access Token.',
				rateLimited: false
			};
		}

		if (response.status === 403) {
			return {
				message:
					'GitHub denied unauthenticated access to this repository. It may be private or access-restricted. Provide a Personal Access Token.',
				rateLimited: false
			};
		}
	}

	const suffix = parsed.message ? ` (${parsed.message})` : '';
	return {
		message: `GitHub API error: ${response.status}${suffix}`,
		rateLimited: false
	};
}

/**
 * Validate that a repository URL is accessible and detect if it's private
 */
async function validateRepository(
	repositoryUrl: string,
	personalAccessToken?: string
): Promise<boolean> {
	const githubPattern = /^https:\/\/github\.com\/([\w-]+)\/([\w-]+)\/?$/;
	const normalizedUrl = repositoryUrl.replace(/\.git$/, '');
	const match = normalizedUrl.match(githubPattern);

	if (!match) {
		throw new Error(
			'Repository URL must be a valid GitHub repository (https://github.com/username/repo)'
		);
	}

	const [, owner, repo] = match;
	const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;

	const headers: Record<string, string> = {
		Accept: 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28',
		'User-Agent': 'Profilarr'
	};

	// If we have a PAT, use it directly to avoid burning unauthenticated rate limit
	if (personalAccessToken) {
		const authResponse = await globalThis.fetch(apiUrl, {
			headers: { ...headers, Authorization: `Bearer ${personalAccessToken}` }
		});

		if (authResponse.ok) {
			const data = await authResponse.json();
			return data.private === true;
		}

		const classified = await classifyGitHubResponseError(authResponse, 'authenticated');
		throw new Error(classified.message);
	}

	// No PAT — try unauthenticated
	const response = await globalThis.fetch(apiUrl, { headers });

	if (response.ok) {
		const data = await response.json();
		return data.private === true;
	}

	const classified = await classifyGitHubResponseError(response, 'unauthenticated');
	throw new Error(classified.message);
}

/**
 * Clone a git repository
 * Returns true if private, false if public
 */
export async function clone(
	repositoryUrl: string,
	targetPath: string,
	branch?: string,
	personalAccessToken?: string
): Promise<boolean> {
	const isPrivate = await validateRepository(repositoryUrl, personalAccessToken);

	const args = ['clone'];
	if (branch) args.push('--branch', branch);

	let authUrl = repositoryUrl;
	if (personalAccessToken) {
		authUrl = repositoryUrl.replace(
			'https://github.com',
			`https://${personalAccessToken}@github.com`
		);
	}

	args.push(authUrl, targetPath);

	await execGit(args);

	return isPrivate;
}

/**
 * Fetch from remote (silent)
 */
export async function fetch(repoPath: string): Promise<void> {
	await execGitSafe(['fetch', '--quiet'], repoPath);
}

/**
 * Fetch tags from remote
 */
export async function fetchTags(repoPath: string): Promise<void> {
	await execGitSafe(['fetch', '--tags', '--quiet'], repoPath);
}

/**
 * Pull from remote
 */
export async function pull(repoPath: string): Promise<void> {
	await execGit(['pull'], repoPath);
}

/**
 * Push to remote
 */
export async function push(repoPath: string): Promise<void> {
	await execGit(['push'], repoPath);
}

/**
 * Checkout a branch
 */
export async function checkout(repoPath: string, branch: string): Promise<void> {
	await execGit(['checkout', branch], repoPath);
}

/**
 * Reset repository to match remote (discards local changes)
 */
/**
 * Stage files
 */
export async function stage(repoPath: string, filepaths: string[]): Promise<void> {
	for (const filepath of filepaths) {
		// Convert to relative path if it starts with the repo path
		const relativePath = filepath.startsWith(repoPath + '/')
			? filepath.slice(repoPath.length + 1)
			: filepath;
		await execGit(['add', relativePath], repoPath);
	}
}

/**
 * Commit staged changes
 */
export async function commit(repoPath: string, message: string): Promise<void> {
	await execGit(['commit', '-m', message], repoPath);
}

/**
 * Configure local git author identity for the repository
 */
export async function configureIdentity(
	repoPath: string,
	name: string,
	email: string
): Promise<void> {
	const trimmedName = name.trim();
	const trimmedEmail = email.trim();

	if (!trimmedName || !trimmedEmail) {
		throw new Error('Git author name and email are required');
	}

	await execGit(['config', 'user.name', trimmedName], repoPath);
	await execGit(['config', 'user.email', trimmedEmail], repoPath);
}

/**
 * Get repository info from GitHub API (cached)
 */
export async function getRepoInfo(
	repositoryUrl: string,
	personalAccessToken?: string | null
): Promise<RepoInfo | null> {
	return getCachedRepoInfo(repositoryUrl, personalAccessToken);
}
