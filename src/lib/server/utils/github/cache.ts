/**
 * GitHub API caching utilities
 */

import { githubCacheQueries } from '$db/queries/githubCache.ts';
import { logger } from '$logger/logger.ts';
import type { RepoInfo } from '../git/types.ts';

/**
 * TTL Configuration (in minutes)
 */
const TTL = {
	REPO_INFO: 60, // 1 hour - stars/forks don't change often
	AVATAR: 1440, // 24 hours - avatars rarely change
	RELEASES: 30 // 30 minutes - releases are less frequent
};

/**
 * GitHub Release type
 */
export interface GitHubRelease {
	tag_name: string;
	name: string;
	published_at: string;
	html_url: string;
	prerelease: boolean;
}

/**
 * Standard GitHub API headers
 */
function getHeaders(pat?: string | null): Record<string, string> {
	const headers: Record<string, string> = {
		Accept: 'application/vnd.github+json',
		'X-GitHub-Api-Version': '2022-11-28',
		'User-Agent': 'Profilarr'
	};

	if (pat) {
		headers['Authorization'] = `Bearer ${pat}`;
	}

	return headers;
}

/**
 * Parse GitHub URL to extract owner and repo
 */
function parseGitHubUrl(repositoryUrl: string): { owner: string; repo: string } | null {
	const githubPattern = /^https:\/\/github\.com\/([\w-]+)\/([\w-]+)\/?$/;
	const normalizedUrl = repositoryUrl.replace(/\.git$/, '');
	const match = normalizedUrl.match(githubPattern);

	if (!match) {
		return null;
	}

	return { owner: match[1], repo: match[2] };
}

/**
 * Get cached repo info or fetch from GitHub API
 */
export async function getCachedRepoInfo(
	repositoryUrl: string,
	pat?: string | null
): Promise<RepoInfo | null> {
	const parsed = parseGitHubUrl(repositoryUrl);
	if (!parsed) {
		return null;
	}

	const { owner, repo } = parsed;
	const cacheKey = `repo:${owner}/${repo}`;

	// Check cache
	const cached = githubCacheQueries.get(cacheKey);
	if (cached) {
		return JSON.parse(cached.data) as RepoInfo;
	}

	await logger.debug('GitHub repo info cache miss', {
		source: 'GitHubCache',
		meta: { cacheKey }
	});

	// Fetch from API
	const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;
	const headers = getHeaders(pat);

	try {
		const response = await globalThis.fetch(apiUrl, { headers });

		if (!response.ok) {
			return null;
		}

		const data = await response.json();

		const repoInfo: RepoInfo = {
			owner: data.owner.login,
			repo: data.name,
			description: data.description,
			stars: data.stargazers_count,
			forks: data.forks_count,
			openIssues: data.open_issues_count,
			ownerAvatarUrl: data.owner.avatar_url,
			ownerType: data.owner.type,
			htmlUrl: data.html_url
		};

		// Cache the result
		githubCacheQueries.set(cacheKey, 'repo_info', JSON.stringify(repoInfo), TTL.REPO_INFO);

		return repoInfo;
	} catch (err) {
		await logger.error('Failed to fetch GitHub repo info', {
			source: 'GitHubCache',
			meta: { error: String(err), repositoryUrl }
		});
		return null;
	}
}

/**
 * Fetch avatar from GitHub and cache it
 */
async function fetchAndCacheAvatar(owner: string, cacheKey: string): Promise<string | null> {
	const avatarUrl = `https://github.com/${owner}.png?size=80`;

	try {
		const response = await globalThis.fetch(avatarUrl);

		if (!response.ok) {
			return null;
		}

		const buffer = await response.arrayBuffer();
		const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
		const contentType = response.headers.get('content-type') || 'image/png';
		const dataUrl = `data:${contentType};base64,${base64}`;

		// Cache the result
		githubCacheQueries.set(cacheKey, 'avatar', dataUrl, TTL.AVATAR);

		return dataUrl;
	} catch (err) {
		await logger.error('Failed to fetch GitHub avatar', {
			source: 'GitHubCache',
			meta: { error: String(err), owner }
		});
		return null;
	}
}

/**
 * Get cached avatar with stale-while-revalidate
 * Always returns cached data if available, refreshes in background when stale
 * Returns base64 encoded image data
 */
export async function getCachedAvatar(owner: string): Promise<string | null> {
	const cacheKey = `avatar:${owner}`;

	// Check for any cached data (even if expired)
	const cached = githubCacheQueries.getStale(cacheKey);

	if (cached) {
		// Check if data is expired
		const isExpired = githubCacheQueries.isExpired(cacheKey);

		if (isExpired) {
			await logger.debug('GitHub avatar cache stale, revalidating in background', {
				source: 'GitHubCache',
				meta: { owner }
			});
			// Trigger background refresh (don't await)
			fetchAndCacheAvatar(owner, cacheKey).catch(() => {
				// Silently ignore background refresh errors
			});
		}

		return cached.data;
	}

	await logger.debug('GitHub avatar cache miss', {
		source: 'GitHubCache',
		meta: { owner }
	});

	// No cached data at all - fetch synchronously
	return fetchAndCacheAvatar(owner, cacheKey);
}

/**
 * Get cached releases or fetch from GitHub API
 */
export async function getCachedReleases(owner: string, repo: string): Promise<GitHubRelease[]> {
	const cacheKey = `releases:${owner}/${repo}`;

	// Check cache
	const cached = githubCacheQueries.get(cacheKey);
	if (cached) {
		return JSON.parse(cached.data) as GitHubRelease[];
	}

	await logger.debug('GitHub releases cache miss', {
		source: 'GitHubCache',
		meta: { owner, repo }
	});

	// Fetch from API
	const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases`;
	const headers = getHeaders();

	try {
		const response = await globalThis.fetch(apiUrl, { headers });

		if (!response.ok) {
			return [];
		}

		const data = await response.json();
		const releases: GitHubRelease[] = data.map((release: Record<string, unknown>) => ({
			tag_name: release.tag_name,
			name: release.name,
			published_at: release.published_at,
			html_url: release.html_url,
			prerelease: release.prerelease
		}));

		// Cache the result
		githubCacheQueries.set(cacheKey, 'releases', JSON.stringify(releases), TTL.RELEASES);

		return releases;
	} catch (err) {
		await logger.error('Failed to fetch GitHub releases', {
			source: 'GitHubCache',
			meta: { error: String(err), owner, repo }
		});
		return [];
	}
}

/**
 * Invalidate all cache entries for a repository
 */
export function invalidateRepo(repositoryUrl: string): void {
	const parsed = parseGitHubUrl(repositoryUrl);
	if (!parsed) {
		return;
	}

	const { owner, repo } = parsed;

	// Delete repo info cache
	githubCacheQueries.delete(`repo:${owner}/${repo}`);

	// Delete avatar cache
	githubCacheQueries.delete(`avatar:${owner}`);

	// Delete releases cache
	githubCacheQueries.delete(`releases:${owner}/${repo}`);
}

/**
 * Clean up expired cache entries
 */
export function cleanupExpiredCache(): number {
	return githubCacheQueries.deleteExpired();
}
