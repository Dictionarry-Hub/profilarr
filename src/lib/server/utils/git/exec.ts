/**
 * Git command execution helper
 */

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
	const command = new Deno.Command('git', {
		args,
		...(cwd && { cwd }),
		stdout: 'piped',
		stderr: 'piped',
		env: GIT_ENV
	});

	const process = command.spawn();

	const timer = setTimeout(() => {
		try {
			process.kill('SIGTERM');
		} catch {
			// Process may already be dead
		}
	}, timeoutMs);

	let status: Deno.CommandStatus;
	let stdout: Uint8Array;
	let stderr: Uint8Array;
	try {
		[status, stdout, stderr] = await Promise.all([
			process.status,
			new Response(process.stdout).arrayBuffer().then((b) => new Uint8Array(b)),
			new Response(process.stderr).arrayBuffer().then((b) => new Uint8Array(b))
		]);
	} finally {
		clearTimeout(timer);
	}

	if (!status.success) {
		const errorMessage = new TextDecoder().decode(stderr);
		if (status.signal === 'SIGTERM') {
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
