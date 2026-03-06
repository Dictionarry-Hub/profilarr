/**
 * Parser auto-spawn for standalone binary distribution.
 *
 * When running outside Docker and no explicit PARSER_HOST is set,
 * this module finds the parser binary next to the main executable,
 * spawns it on a free port, and sets PARSER_HOST/PARSER_PORT env vars
 * before the Config singleton reads them.
 *
 * This file is imported dynamically as the first thing in hooks.server.ts.
 */

export {};

// — Detection helpers ————————————————————————————————————————————

function isDocker(): boolean {
	try {
		Deno.statSync('/.dockerenv');
		return true;
	} catch {
		try {
			const cgroup = Deno.readTextFileSync('/proc/1/cgroup');
			return cgroup.includes('docker');
		} catch {
			return false;
		}
	}
}

function findParserBinary(): string | null {
	const execPath = Deno.execPath();
	const lastSlash = Math.max(execPath.lastIndexOf('/'), execPath.lastIndexOf('\\'));
	const dir = lastSlash > 0 ? execPath.substring(0, lastSlash) : '.';

	const candidates = [`${dir}/profilarr-parser`, `${dir}/profilarr-parser.exe`];

	for (const path of candidates) {
		try {
			Deno.statSync(path);
			return path;
		} catch {
			continue;
		}
	}
	return null;
}

// — Port + health ————————————————————————————————————————————————

async function findFreePort(): Promise<number> {
	const listener = Deno.listen({ port: 0 });
	const port = (listener.addr as Deno.NetAddr).port;
	listener.close();
	return port;
}

async function waitForHealth(port: number, timeoutMs: number): Promise<void> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const resp = await fetch(`http://localhost:${port}/health`, {
				signal: AbortSignal.timeout(2000)
			});
			if (resp.ok) return;
		} catch {
			// Not ready yet
		}
		await new Promise((r) => setTimeout(r, 250));
	}
	throw new Error(`Parser failed to start within ${timeoutMs}ms`);
}

// — Output streaming —————————————————————————————————————————————

async function streamOutput(reader: ReadableStreamDefaultReader<Uint8Array>) {
	const decoder = new TextDecoder();
	const color = '\x1b[33m'; // yellow, same as dev.ts
	const reset = '\x1b[0m';
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			const text = decoder.decode(value);
			for (const line of text.split('\n')) {
				if (line.trim()) {
					console.log(`${color}[parser]${reset} ${line}`);
				}
			}
		}
	} catch {
		// Stream closed
	}
}

// — Main ————————————————————————————————————————————————————————

const shouldSpawn = !isDocker() && !Deno.env.get('PARSER_HOST') && findParserBinary() !== null;

if (shouldSpawn) {
	const binaryPath = findParserBinary()!;
	const port = await findFreePort();

	const cmd = new Deno.Command(binaryPath, {
		env: {
			ASPNETCORE_URLS: `http://localhost:${port}`,
			ASPNETCORE_ENVIRONMENT: 'Production'
		},
		stdout: 'piped',
		stderr: 'piped'
	});

	const process = cmd.spawn();

	// Stream output in background
	streamOutput(process.stdout.getReader());
	streamOutput(process.stderr.getReader());

	// Set env vars before Config reads them
	Deno.env.set('PARSER_HOST', 'localhost');
	Deno.env.set('PARSER_PORT', String(port));

	// Wait for parser to be ready
	try {
		await waitForHealth(port, 10_000);
		console.log(`\x1b[33m[parser]\x1b[0m Ready on port ${port}`);
	} catch (err) {
		console.error(`\x1b[31m[parser]\x1b[0m Failed to start: ${err}`);
		// Continue anyway — the app degrades gracefully without the parser
	}

	// Shutdown handlers
	const cleanup = () => {
		try {
			process.kill('SIGTERM');
		} catch {
			// Already dead
		}
	};

	Deno.addSignalListener('SIGINT', () => {
		cleanup();
		Deno.exit(0);
	});

	// SIGTERM is not supported on Windows
	if (Deno.build.os !== 'windows') {
		Deno.addSignalListener('SIGTERM', () => {
			cleanup();
			Deno.exit(0);
		});
	}

	// Watch for unexpected death
	process.status.then((status) => {
		if (status.code !== 0) {
			console.error(`\x1b[31m[parser]\x1b[0m Process exited unexpectedly (code ${status.code})`);
		}
	});
}
