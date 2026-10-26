/**
 * Remove GitHub tokens that older versions saved in database clones.
 *
 * Older versions cloned with the token in the URL (`https://<token>@github.com/...`),
 * so git saved it as the clone's `origin` in `.git/config`. Tokens now reach
 * git as a header (utils/git/auth.ts), and the URL with the token makes newer
 * curl and git drop the credentials and fail. Startup resets each such
 * `origin` to the plain URL.
 */

import * as fs from 'node:fs/promises';
import { execGit, execGitSafe } from '$utils/git/exec.ts';

export interface RemovedTokens {
	/** Whether the database clone's own origin held a token */
	repository: boolean;
	/** Dependency clones under deps/ whose origin held a token, by folder name */
	dependencies: string[];
}

/** Whether an HTTP(S) URL holds a username or password */
export function hasUrlCredentials(rawUrl: string): boolean {
	try {
		const url = new URL(rawUrl);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
		return url.username !== '' || url.password !== '';
	} catch {
		return false;
	}
}

/** An HTTP(S) URL without its username and password */
function stripUrlCredentials(rawUrl: string): string {
	const url = new URL(rawUrl);
	url.username = '';
	url.password = '';
	return url.toString();
}

/** The origin URL as .git/config stores it, before any insteadOf rewrite */
async function readOrigin(repoPath: string): Promise<string | null> {
	return await execGitSafe(['config', '--local', '--get', 'remote.origin.url'], repoPath);
}

async function setOrigin(repoPath: string, url: string): Promise<void> {
	await execGit(['remote', 'set-url', 'origin', url], repoPath);
}

/**
 * Folders under deps/ that are clones of their own. A folder without .git is
 * skipped: git would run in the database clone around it instead.
 */
async function dependencyClones(pcdPath: string): Promise<string[]> {
	let entries;
	try {
		entries = await fs.readdir(`${pcdPath}/deps`, { withFileTypes: true });
	} catch {
		return [];
	}

	const clones: string[] = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		try {
			await fs.stat(`${pcdPath}/deps/${entry.name}/.git`);
			clones.push(entry.name);
		} catch {
			// Not a clone
		}
	}
	return clones;
}

/**
 * Reset a database clone's origin to its stored repository URL, and each
 * dependency clone's origin to its URL without credentials, wherever the
 * origin holds credentials. Clones without them are left alone.
 */
export async function removeSavedTokens(
	pcdPath: string,
	repositoryUrl: string
): Promise<RemovedTokens> {
	const removed: RemovedTokens = { repository: false, dependencies: [] };

	const origin = await readOrigin(pcdPath);
	if (origin && hasUrlCredentials(origin)) {
		await setOrigin(pcdPath, repositoryUrl);
		removed.repository = true;
	}

	for (const name of await dependencyClones(pcdPath)) {
		const depPath = `${pcdPath}/deps/${name}`;
		const depOrigin = await readOrigin(depPath);
		if (depOrigin && hasUrlCredentials(depOrigin)) {
			await setOrigin(depPath, stripUrlCredentials(depOrigin));
			removed.dependencies.push(name);
		}
	}

	return removed;
}
