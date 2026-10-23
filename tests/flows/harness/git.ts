/**
 * Run git for the harness and the helpers.
 *
 * Commits use a fixed test identity. Passing a data folder adds its
 * `gitconfig`, the same one its app gets, so the fixtures database's GitHub
 * URL leads to that folder's local upstream (see harness/seed.ts).
 */

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

/** The git config a data folder's app and harness git calls share */
export function gitConfigPath(dataDir: string): string {
	return join(dataDir, 'gitconfig');
}

/** Run git in `cwd` and return its trimmed output. Throws with git's message on failure. */
export function git(args: string[], cwd: string, dataDir?: string): string {
	const env = dataDir ? { ...process.env, GIT_CONFIG_GLOBAL: gitConfigPath(dataDir) } : process.env;
	const result = spawnSync(
		'git',
		['-c', 'user.name=flows', '-c', 'user.email=flows@localhost', ...args],
		{ cwd, encoding: 'utf8', env }
	);
	if (result.status !== 0) {
		throw new Error(`git ${args.join(' ')} failed in ${cwd}:\n${result.stderr ?? result.error}`);
	}
	return result.stdout.trim();
}
