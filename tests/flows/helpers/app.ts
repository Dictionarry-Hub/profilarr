/**
 * Start and stop one Profilarr instance for a flow test.
 *
 * Every test gets its own app: a copy of the golden data folder (fixtures
 * already seeded and compiled), its own port, and its own process. Nothing is
 * shared between tests, so any of them can run in parallel.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { APP_BINARY, GOLDEN_DIR } from './paths.ts';
import { freePort } from './ports.ts';

export interface App {
	url: string;
	/** The app's data folder (APP_BASE_PATH) */
	dir: string;
	/** Everything the app has printed so far */
	logs(): string;
	/** Stop the app. Deletes its data folder unless it was passed to startApp. */
	stop(): Promise<void>;
}

const HEALTH_TIMEOUT_MS = 30_000;

// No auto-link, no announcements fetch, no parser: nothing reaches the network.
const BASE_ENV = {
	AUTH: 'off',
	INTEGRATION_TEST: '1',
	PROFILARR_BULLETIN_URL: 'http://127.0.0.1:9',
	PARSER_HOST: '127.0.0.1',
	PARSER_PORT: '9',
	HOST: '127.0.0.1'
};

/**
 * Start an app. Without `dataDir` it runs on a fresh copy of the golden
 * folder, deleted on stop. With `dataDir` it runs on that folder and leaves it
 * in place, which global setup uses to build the golden folder.
 */
export async function startApp(dataDir?: string): Promise<App> {
	const ownsDir = !dataDir;
	const dir = dataDir ?? (await fs.mkdtemp(join(tmpdir(), 'profilarr-flow-')));
	if (ownsDir) await fs.cp(GOLDEN_DIR, dir, { recursive: true });

	const port = await freePort();
	const url = `http://127.0.0.1:${port}`;
	const output: string[] = [];

	const child = spawn(APP_BINARY, [], {
		env: { ...process.env, ...BASE_ENV, PORT: String(port), APP_BASE_PATH: dir, ORIGIN: url },
		stdio: ['ignore', 'pipe', 'pipe']
	});
	child.stdout?.on('data', (chunk) => output.push(String(chunk)));
	child.stderr?.on('data', (chunk) => output.push(String(chunk)));

	const stop = async () => {
		await kill(child);
		if (ownsDir) await fs.rm(dir, { recursive: true, force: true });
	};

	try {
		await waitForHealth(url, child, () => output.join(''));
	} catch (error) {
		await stop();
		throw error;
	}

	return { url, dir, logs: () => output.join(''), stop };
}

async function waitForHealth(url: string, child: ChildProcess, logs: () => string): Promise<void> {
	const deadline = Date.now() + HEALTH_TIMEOUT_MS;
	while (Date.now() < deadline) {
		if (child.exitCode !== null) {
			throw new Error(`App exited with code ${child.exitCode} before it was ready:\n${logs()}`);
		}
		try {
			const response = await fetch(`${url}/api/v1/health`);
			if (response.ok) return;
		} catch {
			// Not listening yet
		}
		await new Promise((r) => setTimeout(r, 100));
	}
	throw new Error(`App at ${url} wasn't healthy after ${HEALTH_TIMEOUT_MS}ms:\n${logs()}`);
}

function kill(child: ChildProcess): Promise<void> {
	if (child.exitCode !== null) return Promise.resolve();
	return new Promise((resolveKill) => {
		child.once('exit', () => resolveKill());
		child.kill('SIGTERM');
	});
}
