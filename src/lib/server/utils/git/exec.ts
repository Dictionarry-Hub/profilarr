/**
 * Git command execution helper
 */

import { runCommand } from '#utils/command.ts';
import { withGitAuth } from './auth.ts';

const DEFAULT_TIMEOUT_MS = 60_000;

export const GIT_ENV = {
	GIT_TERMINAL_PROMPT: '0',
	GIT_ASKPASS: 'echo',
	GIT_SSH_COMMAND: 'ssh -o BatchMode=yes',
	GIT_CONFIG_COUNT: '1',
	GIT_CONFIG_KEY_0: 'credential.helper',
	GIT_CONFIG_VALUE_0: ''
};

export interface ExecGitOptions {
	/** Send SIGTERM after this many milliseconds */
	timeoutMs?: number;
	/** GitHub personal access token, sent to GitHub as an HTTP header (see auth.ts) */
	token?: string | null;
}

/**
 * Execute a git command with sandboxed environment and timeout.
 */
export async function execGit(
	args: string[],
	cwd?: string,
	options: ExecGitOptions = {}
): Promise<string> {
	const { timeoutMs = DEFAULT_TIMEOUT_MS, token } = options;
	const { code, signal, stdout, stderr } = await runCommand('git', args, {
		cwd,
		env: withGitAuth(GIT_ENV, token),
		timeoutMs
	});

	if (code !== 0) {
		const errorMessage = new TextDecoder().decode(stderr);
		if (signal === 'SIGTERM') {
			throw new Error(`Git command timed out after ${timeoutMs}ms: git ${args.join(' ')}`);
		}
		throw new Error(`Git command failed: ${errorMessage}`);
	}

	return new TextDecoder().decode(stdout).trim();
}

/**
 * Execute a git command, returning null on failure instead of throwing
 */
export async function execGitSafe(
	args: string[],
	cwd: string,
	options: ExecGitOptions = {}
): Promise<string | null> {
	try {
		return await execGit(args, cwd, options);
	} catch {
		return null;
	}
}
