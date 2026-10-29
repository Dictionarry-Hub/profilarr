/**
 * Vitest globalSetup for the integration suite. Starts the auth Docker stack
 * (mock-oauth2-server, Caddy, nginx) before any spec runs, and on teardown
 * stops it and removes every dist/integration-* server directory.
 *
 * Set INTEGRATION_DOCKER=0 to skip Docker, e.g. when running specs that
 * don't need it. Vitest gives globalSetup no view of the CLI file filters, so
 * Docker otherwise starts for every run.
 */

import { execFile } from 'node:child_process';
import { readdir, rm } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const COMPOSE_FILE = 'tests/integration/specs/auth/docker-compose.yml';

/**
 * Run a command with its output captured. On failure the output is printed
 * and an error is thrown; on success it is discarded.
 */
async function execQuiet(cmd: string, args: string[]): Promise<void> {
	try {
		await execFileAsync(cmd, args, { maxBuffer: 64 * 1024 * 1024 });
	} catch (err) {
		const { stdout, stderr } = err as { stdout?: string; stderr?: string };
		if (stdout) console.error(stdout);
		if (stderr) console.error(stderr);
		throw new Error(`Command failed: ${cmd} ${args.join(' ')}`, { cause: err });
	}
}

async function removeIntegrationDirs(): Promise<void> {
	const entries = await readdir('./dist', { withFileTypes: true }).catch(() => []);
	await Promise.all(
		entries
			.filter((entry) => entry.isDirectory() && entry.name.startsWith('integration-'))
			.map((entry) => rm(`./dist/${entry.name}`, { recursive: true, force: true }).catch(() => {}))
	);
}

async function stopDocker(): Promise<void> {
	console.log('Stopping Docker infrastructure...');
	try {
		await execQuiet('docker', ['compose', '-f', COMPOSE_FILE, 'down']);
	} catch (err) {
		console.error(err);
	}
}

export default async function setup(): Promise<() => Promise<void>> {
	const useDocker = process.env.INTEGRATION_DOCKER !== '0';

	if (useDocker) {
		console.log('Starting Docker infrastructure...');
		try {
			await execQuiet('docker', ['compose', '-f', COMPOSE_FILE, 'up', '-d', '--wait']);
		} catch (err) {
			// Vitest skips teardown when setup throws, so stop what did start
			await stopDocker();
			throw err;
		}
	}

	return async () => {
		if (useDocker) await stopDocker();
		console.log('Cleaning up temp directories...');
		await removeIntegrationDirs();
	};
}
