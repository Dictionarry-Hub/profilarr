/**
 * Git command execution helper
 */

import { runCommand } from '../command.ts';

const DEFAULT_TIMEOUT_MS = 60_000;

export const GIT_ENV = {
	GIT_TERMINAL_PROMPT: '0',
	GIT_ASKPASS: 'echo',
	GIT_SSH_COMMAND: 'ssh -o BatchMode=yes',
	GIT_CONFIG_COUNT: '1',
	GIT_CONFIG_KEY_0: 'credential.helper',
	GIT_CONFIG_VALUE_0: ''
};

/**
 * Execute a git command with sandboxed environment and timeout.
 */
export async function execGit(
	args: string[],
	cwd?: string,
	timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<string> {
	const { code, signal, stdout, stderr } = await runCommand('git', args, {
		cwd,
		env: GIT_ENV,
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
export async function execGitSafe(args: string[], cwd: string): Promise<string | null> {
	try {
		return await execGit(args, cwd);
	} catch {
		return null;
	}
}
