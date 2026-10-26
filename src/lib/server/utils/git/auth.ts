/**
 * GitHub authentication for git commands
 *
 * A personal access token reaches git as an HTTP `Authorization` header, set
 * through `GIT_CONFIG_*` environment variables for the one command that needs
 * it. The token is never put in a remote URL, so it is never saved to a
 * clone's `.git/config`, and never in an argument, so it never shows in a
 * process list.
 */

import { Buffer } from 'node:buffer';

/** The header is only sent to GitHub */
export const GITHUB_AUTH_SCOPE = 'https://github.com/';

/** The git config key that carries the header */
export const GITHUB_AUTH_KEY = `http.${GITHUB_AUTH_SCOPE}.extraHeader`;

/** The Authorization header GitHub accepts for a token over HTTPS */
export function githubAuthHeader(token: string): string {
	const credentials = Buffer.from(`x-access-token:${token}`, 'utf8').toString('base64');
	return `Authorization: Basic ${credentials}`;
}

/**
 * Add the token's header to a git environment. Entries already set through
 * `GIT_CONFIG_COUNT` are kept, and the header takes the next index. Without a
 * token the environment is returned unchanged.
 */
export function withGitAuth(
	env: Record<string, string>,
	token?: string | null
): Record<string, string> {
	if (!token) return env;

	const count = Number.parseInt(env.GIT_CONFIG_COUNT ?? '0', 10) || 0;
	return {
		...env,
		GIT_CONFIG_COUNT: String(count + 1),
		[`GIT_CONFIG_KEY_${count}`]: GITHUB_AUTH_KEY,
		[`GIT_CONFIG_VALUE_${count}`]: githubAuthHeader(token)
	};
}
