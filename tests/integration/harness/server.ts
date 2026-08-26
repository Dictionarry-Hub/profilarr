/**
 * ServerManager — spawns and manages server instances for integration tests.
 * Each instance gets a unique APP_BASE_PATH and PORT.
 *
 * Supports two modes:
 *   - 'dev' (default): spawns Vite dev server
 *   - 'preview': runs the compiled production binary (requires deno task build first)
 */

import { log } from './log.ts';

export type ServerMode = 'dev' | 'preview';

interface ServerInstance {
	process: Deno.ChildProcess;
	port: number;
	basePath: string;
	url: string;
	baseUrl: string;
	stdoutBuf: string[];
	stderrBuf: string[];
	exitStatus: Deno.CommandStatus | null;
	startedAt: number;
}

const instances = new Map<number, ServerInstance>();
const DEBUG_VERBOSE = Deno.env.get('INTEGRATION_DEBUG') === '1';

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
	await Deno.mkdir(`${basePath}/data`, { recursive: true });
	await Deno.mkdir(`${basePath}/logs`, { recursive: true });
	await Deno.mkdir(`${basePath}/backups`, { recursive: true });
	await Deno.mkdir(`${basePath}/data/databases`, { recursive: true });

	const env: Record<string, string> = {
		...Deno.env.toObject(),
		PORT: String(port),
		HOST: '0.0.0.0',
		APP_BASE_PATH: basePath,
		PARSER_HOST: 'localhost',
		PARSER_PORT: '5000',
		...envOverrides
	};

	let cmd: Deno.Command;

	if (mode === 'preview') {
		cmd = new Deno.Command('./dist/build/profilarr', {
			env,
			stdout: 'piped',
			stderr: 'piped'
		});
	} else {
		env.DENO_ENV = 'development';
		env.VITE_PLATFORM = 'linux-amd64';
		env.VITE_CHANNEL = 'test';
		cmd = new Deno.Command('deno', {
			args: ['run', '-A', 'vite', 'dev', '--port', String(port)],
			env,
			stdout: 'piped',
			stderr: 'piped'
		});
	}

	const startedAt = Date.now();
	const process = cmd.spawn();

	const stdoutBuf: string[] = [];
	const stderrBuf: string[] = [];
	const url = `http://localhost:${port}`;
	// The app is served only from BASE_URL when it is set, so the health probe has
	// to carry the prefix too.
	const baseUrl = env.BASE_URL ?? '';

	const instance: ServerInstance = {
		process,
		port,
		basePath,
		url,
		baseUrl,
		stdoutBuf,
		stderrBuf,
		exitStatus: null,
		startedAt
	};
	instances.set(port, instance);

	captureStream(process.stdout, stdoutBuf, port, 'stdout');
	captureStream(process.stderr, stderrBuf, port, 'stderr');

	// Track exit so waitForReady can detect early death.
	process.status.then((status) => {
		instance.exitStatus = status;
		const elapsed = Date.now() - startedAt;
		log.server(
			port,
			`Process exited (code=${status.code}, signal=${status.signal ?? 'none'}) after ${elapsed}ms`
		);
	});

	log.server(port, `PID ${process.pid} | Waiting for health check...`);
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
 * Stop a specific server instance.
 */
export async function stopServer(port: number): Promise<void> {
	const instance = instances.get(port);
	if (!instance) return;

	log.server(port, 'Stopping...');
	try {
		instance.process.kill('SIGTERM');
		await instance.process.status;
	} catch {
		// Process may already be dead
	}

	log.server(port, `Cleaning up ${instance.basePath}`);
	try {
		await Deno.remove(instance.basePath, { recursive: true });
	} catch {
		// Directory may not exist
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
	const healthUrl = `${instance.url}${instance.baseUrl}/api/v1/health`;
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
 * Pipe a child stream into a buffer (so we can dump it on failure) and, if
 * INTEGRATION_DEBUG=1, mirror it live so we can see what the server is doing.
 * Buffer is bounded at 1000 lines per stream; oldest dropped first.
 */
function captureStream(
	stream: ReadableStream<Uint8Array>,
	buf: string[],
	port: number,
	tag: 'stdout' | 'stderr'
): void {
	const decoder = new TextDecoder();
	const reader = stream.getReader();
	let leftover = '';
	(async () => {
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				const text = leftover + decoder.decode(value, { stream: true });
				const lines = text.split('\n');
				leftover = lines.pop() ?? '';
				for (const line of lines) {
					if (buf.length >= 1000) buf.shift();
					buf.push(line);
					if (DEBUG_VERBOSE) {
						console.error(`[${port}:${tag}] ${line}`);
					}
				}
			}
			if (leftover) {
				if (buf.length >= 1000) buf.shift();
				buf.push(leftover);
			}
		} catch {
			// Stream closed
		}
	})();
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
		`  pid=${instance.process.pid} ` +
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
 * from harness/runner.ts when a setup or test fails so the spec's stderr
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
 * (process.status resolved). Used after a test failure to surface a server
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
