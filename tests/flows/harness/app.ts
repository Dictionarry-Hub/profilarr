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
import { gitConfigPath } from './git.ts';
import { APP_BINARY, goldenDir } from './paths.ts';
import { freePort } from './ports.ts';
import { relinkDatabases } from './seed.ts';

export interface App {
	url: string;
	/** The app's data folder (APP_BASE_PATH) */
	dir: string;
	/** Everything the app has printed so far */
	logs(): string;
	/** Stop the app. Deletes its data folder unless it was passed to startApp. */
	stop(): Promise<void>;
	/** Stop the app and start it again on the same folder and URL, e.g. to apply a restore */
	restart(): Promise<void>;
}

const HEALTH_TIMEOUT_MS = 30_000;
// freePort only finds a port that is free right now. Another worker, or any
// outgoing connection, can take it before the app listens, so a start that
// fails on a taken port tries a new one.
const START_ATTEMPTS = 3;

// No auto-link, no announcements fetch, no parser: nothing reaches the network.
const BASE_ENV = {
	AUTH: 'off',
	INTEGRATION_TEST: '1',
	PROFILARR_BULLETIN_URL: 'http://127.0.0.1:9',
	PARSER_HOST: '127.0.0.1',
	PARSER_PORT: '9',
	HOST: '127.0.0.1'
};

export interface StartOptions {
	/**
	 * Pull and publish against this upstream instead of the copy's own, e.g.
	 * another app's, so this app plays a second install of the same database.
	 */
	upstream?: string;
	/**
	 * Environment applied over the defaults, e.g. `AUTH: 'on'`, SSO settings,
	 * or an `ORIGIN` for a reverse proxy in front of the app. Kept on restart.
	 */
	env?: Record<string, string>;
}

/**
 * Start an app. Without `dataDir` it runs on a fresh copy of the golden
 * folder, deleted on stop. With `dataDir` it runs on that folder and leaves it
 * in place, which global setup uses to build the golden folder.
 */
export async function startApp(dataDir?: string, options: StartOptions = {}): Promise<App> {
	const ownsDir = !dataDir;
	const dir = dataDir ?? (await fs.mkdtemp(join(tmpdir(), 'profilarr-flow-')));
	if (ownsDir) {
		await fs.cp(goldenDir(), dir, { recursive: true });
		await relinkDatabases(dir, options.upstream);
	}

	let port = 0;
	let url = '';
	const output: string[] = [];
	const logs = () => output.join('');

	// Spawn the app on `port` and wait until it answers. Kills it if it never does.
	const launch = async (): Promise<ChildProcess> => {
		const child = spawn(APP_BINARY, [], {
			env: {
				...process.env,
				...BASE_ENV,
				PORT: String(port),
				APP_BASE_PATH: dir,
				ORIGIN: url,
				// Sends the fixtures GitHub URL to the local upstream (harness/seed.ts)
				GIT_CONFIG_GLOBAL: gitConfigPath(dir),
				...options.env
			},
			stdio: ['ignore', 'pipe', 'pipe']
		});
		const from = output.length;
		child.stdout?.on('data', (chunk) => output.push(String(chunk)));
		child.stderr?.on('data', (chunk) => output.push(String(chunk)));
		// Deno prints this once the app holds its port
		const listening = () => output.slice(from).join('').includes(`Listening on ${url}/`);
		try {
			await waitForHealth(url, child, logs, listening);
		} catch (error) {
			await kill(child);
			throw error;
		}
		return child;
	};

	const removeDir = async () => {
		if (ownsDir) await fs.rm(dir, { recursive: true, force: true });
	};

	// Launch on a free port, and on another one if that port gets taken first
	const start = async (): Promise<ChildProcess> => {
		for (let attempt = 1; ; attempt++) {
			port = await freePort();
			url = `http://127.0.0.1:${port}`;
			const from = output.length;
			try {
				return await launch();
			} catch (error) {
				const portTaken = output.slice(from).join('').includes('AddrInUse');
				if (!portTaken || attempt >= START_ATTEMPTS) throw error;
				output.push(`\n--- port ${port} was taken, trying another ---\n`);
			}
		}
	};

	let child: ChildProcess;
	try {
		child = await start();
	} catch (error) {
		await removeDir();
		throw error;
	}

	return {
		url,
		dir,
		logs,
		stop: async () => {
			await kill(child);
			await removeDir();
		},
		// Keeps the port, because the test's URL depends on it
		restart: async () => {
			await kill(child);
			output.push('\n--- restart ---\n');
			child = await launch();
		}
	};
}

async function waitForHealth(
	url: string,
	child: ChildProcess,
	logs: () => string,
	listening: () => boolean
): Promise<void> {
	const deadline = Date.now() + HEALTH_TIMEOUT_MS;
	while (Date.now() < deadline) {
		if (child.exitCode !== null) {
			throw new Error(`App exited with code ${child.exitCode} before it was ready:\n${logs()}`);
		}
		// Until the app says it's listening, whatever answers on the port is
		// something else that took it, so its answer means nothing
		if (listening()) {
			try {
				const response = await fetch(`${url}/api/v1/health`, {
					signal: AbortSignal.timeout(2_000)
				});
				if (response.ok) return;
			} catch {
				// Not answering yet
			}
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
