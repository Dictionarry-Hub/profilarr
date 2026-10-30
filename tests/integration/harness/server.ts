/**
 * ServerManager — spawns and manages server instances for integration tests.
 * Each instance gets a unique APP_BASE_PATH and PORT.
 *
 * Supports two modes:
 *   - 'dev' (default): spawns the Vite dev server on Node
 *   - 'preview': runs the production build on Bun (requires pnpm build first)
 */

import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { log } from './log.ts';

export type ServerMode = 'dev' | 'preview';

interface ExitStatus {
	code: number | null;
	signal: NodeJS.Signals | null;
}

interface ServerInstance {
	process: ChildProcess;
	port: number;
	basePath: string;
	url: string;
	stdoutBuf: string[];
	stderrBuf: string[];
	exitStatus: ExitStatus | null;
	exited: Promise<void>;
	startedAt: number;
}

const instances = new Map<number, ServerInstance>();
const DEBUG_VERBOSE = process.env.INTEGRATION_DEBUG === '1';

/**
 * Variables Vitest sets in its own process and workers. They are removed from
 * the server's env so the Vite dev server and SvelteKit plugins don't switch
 * into their test-runner behaviour.
 */
const VITEST_ENV_KEYS = [
	'TEST',
	'VITEST',
	'VITEST_MODE',
	'VITEST_POOL_ID',
	'VITEST_WORKER_ID',
	'FORCE_TTY',
	'BASE_URL',
	'MODE',
	'DEV',
	'PROD',
	'SSR'
];

function serverBaseEnv(): Record<string, string> {
	const env: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (value !== undefined) env[key] = value;
	}
	for (const key of VITEST_ENV_KEYS) delete env[key];
	if (env.NODE_ENV === 'test') delete env.NODE_ENV;
	return env;
}

/**
 * Spawn a server with the given port and env overrides.
 * Waits for the health endpoint to respond before returning.
 */
export async function startServer(
	port: number,
	envOverrides: Record<string, string> = {},
	mode: ServerMode = 'dev'
): Promise<string> {
	if (instances.has(port)) {
		log.server(port, 'Already running');
		return instances.get(port)!.url;
	}

	const basePath = `./dist/integration-${port}`;

	const envDesc = Object.entries(envOverrides)
		.map(([k, v]) => `${k}=${v}`)
		.join(', ');
	log.server(port, `Starting [${mode}]${envDesc ? ` (${envDesc})` : ''}`);

	// Ensure the base path directories exist
	await mkdir(`${basePath}/data`, { recursive: true });
	await mkdir(`${basePath}/logs`, { recursive: true });
	await mkdir(`${basePath}/backups`, { recursive: true });
	await mkdir(`${basePath}/data/databases`, { recursive: true });

	const env: Record<string, string> = {
		...serverBaseEnv(),
		PORT: String(port),
		HOST: '0.0.0.0',
		APP_BASE_PATH: basePath,
		PARSER_HOST: 'localhost',
		PARSER_PORT: '5000',
		...envOverrides
	};

	let command: string;
	let args: string[];

	if (mode === 'preview') {
		command = 'bun';
		args = ['dist/build/server.js'];
	} else {
		env.NODE_ENV = 'development';
		env.VITE_PLATFORM = 'linux-amd64';
		env.VITE_CHANNEL = 'test';
		command = process.execPath;
		args = ['node_modules/vite/bin/vite.js', 'dev', '--port', String(port)];
	}

	const startedAt = Date.now();
	const child = spawn(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });

	const stdoutBuf: string[] = [];
	const stderrBuf: string[] = [];
	const url = `http://localhost:${port}`;

	// Track exit so waitForReady can detect early death. A spawn failure
	// (e.g. Bun not installed) emits 'error' and may never emit 'exit'.
	let resolveExited: () => void = () => {};
	const exited = new Promise<void>((resolve) => {
		resolveExited = resolve;
	});

	const instance: ServerInstance = {
		process: child,
		port,
		basePath,
		url,
		stdoutBuf,
		stderrBuf,
		exitStatus: null,
		exited,
		startedAt
	};
	instances.set(port, instance);

	if (child.stdout) captureStream(child.stdout, stdoutBuf, port, 'stdout');
	if (child.stderr) captureStream(child.stderr, stderrBuf, port, 'stderr');

	const markExited = (status: ExitStatus): void => {
		if (instance.exitStatus) return;
		instance.exitStatus = status;
		const elapsed = Date.now() - startedAt;
		log.server(
			port,
			`Process exited (code=${status.code}, signal=${status.signal ?? 'none'}) after ${elapsed}ms`
		);
		resolveExited();
	};
	child.on('exit', (code, signal) => markExited({ code, signal }));
	child.on('error', (err) => {
		pushLine(stderrBuf, `spawn error: ${err.message}`);
		markExited({ code: null, signal: null });
	});

	log.server(port, `PID ${child.pid ?? 'n/a'} | Waiting for health check...`);
	try {
		await waitForReady(instance, 60_000);
		log.server(port, `Ready at ${url} (${Date.now() - startedAt}ms)`);
	} catch (err) {
		dumpDiagnostics(instance);
		throw err;
	}

	return url;
}

/**
 * Stop a specific server instance. Its data directory is removed unless
 * `keepData` is set, which lets a spec restart the server on the same database.
 */
export async function stopServer(
	port: number,
	options: { keepData?: boolean } = {}
): Promise<void> {
	const instance = instances.get(port);
	if (!instance) return;

	log.server(port, 'Stopping...');
	try {
		if (!instance.exitStatus) instance.process.kill('SIGTERM');
		await instance.exited;
	} catch {
		// Process may already be dead
	}

	if (!options.keepData) {
		log.server(port, `Cleaning up ${instance.basePath}`);
		try {
			await rm(instance.basePath, { recursive: true, force: true });
		} catch {
			// Removal errors don't block cleanup
		}
	}

	instances.delete(port);
	log.server(port, 'Stopped');
}

/**
 * Stop all running server instances.
 */
export async function stopAll(): Promise<void> {
	const ports = [...instances.keys()];
	await Promise.all(ports.map((port) => stopServer(port)));
}

/**
 * Get everything a server instance has printed so far (stdout then stderr).
 * Only the most recent 1000 lines per stream are kept.
 */
export function getServerOutput(port: number): string {
	const instance = instances.get(port);
	if (!instance) return '';
	return [...instance.stdoutBuf, ...instance.stderrBuf].join('\n');
}

/**
 * Get the SQLite database path for a server instance.
 */
export function getDbPath(port: number): string {
	return `./dist/integration-${port}/data/profilarr.db`;
}

/**
 * Poll the health endpoint until the server is ready. Logs the first probe
 * outcome we see and a heartbeat every 10s so a hung start is visible in the
 * test output, not just at the 60s timeout.
 */
async function waitForReady(instance: ServerInstance, timeoutMs: number): Promise<void> {
	const start = Date.now();
	const healthUrl = `${instance.url}/api/v1/health`;
	let lastFetchError: string | null = null;
	let lastHttpStatus: number | null = null;
	let lastLogAt = 0;

	while (Date.now() - start < timeoutMs) {
		// If the process already exited, no point polling further.
		if (instance.exitStatus) {
			throw new Error(
				`Server at ${instance.url} exited before health check ` +
					`(code=${instance.exitStatus.code}, signal=${instance.exitStatus.signal ?? 'none'}) ` +
					`after ${Date.now() - start}ms`
			);
		}

		try {
			const res = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) });
			lastHttpStatus = res.status;
			lastFetchError = null;
			if (res.ok) return;
		} catch (err) {
			lastFetchError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
		}

		const elapsed = Date.now() - start;
		if (elapsed - lastLogAt >= 10_000) {
			log.server(
				instance.port,
				`Still not ready after ${elapsed}ms ` +
					`(lastStatus=${lastHttpStatus ?? 'n/a'}, lastErr=${lastFetchError ?? 'n/a'}, ` +
					`stdoutLines=${instance.stdoutBuf.length}, stderrLines=${instance.stderrBuf.length})`
			);
			lastLogAt = elapsed;
		}

		await new Promise((r) => setTimeout(r, 500));
	}

	throw new Error(
		`Server at ${instance.url} did not become ready within ${timeoutMs}ms ` +
			`(lastStatus=${lastHttpStatus ?? 'n/a'}, lastErr=${lastFetchError ?? 'n/a'})`
	);
}

/**
 * Append a line to a capture buffer, dropping the oldest once it holds 1000.
 */
function pushLine(buf: string[], line: string): void {
	if (buf.length >= 1000) buf.shift();
	buf.push(line);
}

/**
 * Pipe a child stream into a buffer (so we can dump it on failure) and, if
 * INTEGRATION_DEBUG=1, mirror it live so we can see what the server is doing.
 * Buffer is bounded at 1000 lines per stream; oldest dropped first.
 */
function captureStream(
	stream: Readable,
	buf: string[],
	port: number,
	tag: 'stdout' | 'stderr'
): void {
	stream.setEncoding('utf8');
	let leftover = '';
	stream.on('data', (chunk: string) => {
		const lines = (leftover + chunk).split('\n');
		leftover = lines.pop() ?? '';
		for (const line of lines) {
			pushLine(buf, line);
			if (DEBUG_VERBOSE) {
				console.error(`[${port}:${tag}] ${line}`);
			}
		}
	});
	stream.on('end', () => {
		if (leftover) pushLine(buf, leftover);
		leftover = '';
	});
	stream.on('error', () => {
		// Stream closed
	});
}

/**
 * Print everything we captured for a server. Called from the catch in
 * startServer (reason="failed to become ready") and from harness setup/test
 * failure paths (reason="post-failure dump"). Never blocks cleanup.
 */
function dumpDiagnostics(
	instance: ServerInstance,
	reason: string = 'failed to become ready'
): void {
	const elapsed = Date.now() - instance.startedAt;
	console.error(
		`\n──── DIAG [:${instance.port}] ${reason} (${elapsed}ms since start) ─────────────────`
	);
	console.error(
		`  pid=${instance.process.pid ?? 'n/a'} ` +
			`exit=${instance.exitStatus ? `code=${instance.exitStatus.code} signal=${instance.exitStatus.signal ?? 'none'}` : 'still running'}`
	);
	console.error(`  basePath=${instance.basePath}`);
	console.error(`  --- stdout (${instance.stdoutBuf.length} lines) ---`);
	for (const line of instance.stdoutBuf.slice(-200)) console.error(`  | ${line}`);
	console.error(`  --- stderr (${instance.stderrBuf.length} lines) ---`);
	for (const line of instance.stderrBuf.slice(-200)) console.error(`  | ${line}`);
	console.error(`──── end DIAG [:${instance.port}] ─────────────────────────────────────────\n`);
}

/**
 * Dump diagnostics for every running server instance in this process. Called
 * from harness/vitest.setup.ts when a spec's beforeAll fails so the spec's stderr
 * captures whatever the server logged before it died (or what it's still
 * doing if it's still alive).
 */
export function dumpAllServerDiagnostics(reason: string = 'post-failure dump'): void {
	if (instances.size === 0) return;
	for (const instance of instances.values()) {
		dumpDiagnostics(instance, reason);
	}
}

/**
 * Dump diagnostics only for server instances that have already exited
 * (exit observed). Used after a test failure to surface a server
 * crash without spamming output when the server is still healthy and the
 * test failed for normal assertion reasons.
 *
 * Returns true if any server diagnostics were dumped.
 */
export function dumpDeadServerDiagnostics(reason: string = 'server crashed'): boolean {
	let dumped = false;
	for (const instance of instances.values()) {
		if (instance.exitStatus !== null) {
			dumpDiagnostics(instance, reason);
			dumped = true;
		}
	}
	return dumped;
}
