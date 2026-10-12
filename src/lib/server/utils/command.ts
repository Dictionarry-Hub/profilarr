/**
 * External command runner
 *
 * Runs a program to completion and collects its output. The child gets an
 * empty stdin, `env` is added to the parent environment rather than replacing
 * it, output is collected without a size limit, and a non-zero exit is
 * returned instead of thrown.
 */

import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import process from 'node:process';

export interface CommandOptions {
	cwd?: string;
	/** Added to the parent environment */
	env?: Record<string, string>;
	/** Send SIGTERM after this many milliseconds */
	timeoutMs?: number;
}

export interface CommandResult {
	/** Exit code, or null if the process was killed by a signal */
	code: number | null;
	signal: string | null;
	stdout: Uint8Array;
	stderr: Uint8Array;
}

/**
 * Run a command and wait for it to exit. Rejects only if the program could
 * not be started (e.g. it isn't installed).
 */
export function runCommand(
	command: string,
	args: string[],
	options: CommandOptions = {}
): Promise<CommandResult> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: options.cwd,
			env: { ...process.env, ...options.env },
			stdio: ['ignore', 'pipe', 'pipe'],
			timeout: options.timeoutMs
		});

		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];
		child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
		child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));

		child.on('error', reject);
		child.on('close', (code, signal) => {
			resolve({
				code,
				signal,
				stdout: Buffer.concat(stdout),
				stderr: Buffer.concat(stderr)
			});
		});
	});
}
