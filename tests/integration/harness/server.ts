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
}

const instances = new Map<number, ServerInstance>();

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
			args: ['run', '-A', 'npm:vite', 'dev', '--port', String(port)],
			env,
			stdout: 'piped',
			stderr: 'piped'
		});
	}

	const process = cmd.spawn();

	// Drain stdout/stderr to prevent backpressure
	drainStream(process.stdout);
	drainStream(process.stderr);

	const url = `http://localhost:${port}`;

	instances.set(port, { process, port, basePath, url });

	log.server(port, 'Waiting for health check...');
	await waitForReady(url, 60_000);
	log.server(port, `Ready at ${url}`);

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
 * Poll the health endpoint until the server is ready.
 */
async function waitForReady(url: string, timeoutMs: number): Promise<void> {
	const start = Date.now();
	const healthUrl = `${url}/api/v1/health`;

	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(healthUrl, {
				signal: AbortSignal.timeout(2000)
			});
			if (res.ok) return;
		} catch {
			// Server not ready yet
		}
		await new Promise((r) => setTimeout(r, 500));
	}

	throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

/**
 * Drain a readable stream to prevent backpressure from blocking the process.
 */
function drainStream(stream: ReadableStream<Uint8Array>): void {
	const reader = stream.getReader();
	(async () => {
		try {
			while (true) {
				const { done } = await reader.read();
				if (done) break;
			}
		} catch {
			// Stream closed
		}
	})();
}
