/**
 * ZAP security scan -- runs OWASP ZAP against Profilarr instances.
 *
 * Modes:
 *   --baseline   Passive scan only (spider + check responses)
 *   --full       Passive + active attacks (SQLi, XSS, etc.)
 *   --api        API scan against OpenAPI spec (not yet implemented)
 *
 * Each mode runs two scans:
 *   1. Unauthenticated (AUTH=on, port 7090) -- tests the auth boundary
 *   2. Full crawl (AUTH=off, port 7091) -- all routes reachable
 *
 * Requires: compiled binary (deno task build), Docker
 *
 * Usage:
 *   deno task test zap --baseline
 *   deno task test zap --full
 */

const BINARY = './dist/build/profilarr';
const ZAP_IMAGE = 'zaproxy/zap-stable';

type ScanMode = 'baseline' | 'full' | 'api';

interface ServerHandle {
	process: Deno.ChildProcess;
	port: number;
	basePath: string;
}

const servers: ServerHandle[] = [];

function parseScanMode(): ScanMode {
	if (Deno.args.includes('--baseline')) return 'baseline';
	if (Deno.args.includes('--full')) return 'full';
	if (Deno.args.includes('--api')) return 'api';

	console.error('Usage: deno task test zap <mode>\n');
	console.error('Modes:');
	console.error('  --baseline   Passive scan only (spider + check responses)');
	console.error('  --full       Passive + active attacks (SQLi, XSS, etc.)');
	console.error('  --api        API scan against OpenAPI spec (not yet implemented)');
	Deno.exit(1);
}

async function checkPrereqs(): Promise<void> {
	try {
		await Deno.stat(BINARY);
	} catch {
		console.error(`Build not found at ${BINARY}. Run "deno task build" first.`);
		Deno.exit(1);
	}

	const docker = new Deno.Command('docker', {
		args: ['info'],
		stdout: 'null',
		stderr: 'null'
	});
	const { code } = await docker.output();
	if (code !== 0) {
		console.error('Docker is not running.');
		Deno.exit(1);
	}
}

async function startServer(port: number, envOverrides: Record<string, string>): Promise<void> {
	const basePath = `./dist/zap-${port}`;

	await Deno.mkdir(`${basePath}/data/databases`, { recursive: true });
	await Deno.mkdir(`${basePath}/logs`, { recursive: true });
	await Deno.mkdir(`${basePath}/backups`, { recursive: true });

	console.log(`Starting server on port ${port}...`);

	const cmd = new Deno.Command(BINARY, {
		env: {
			...Deno.env.toObject(),
			PORT: String(port),
			HOST: '0.0.0.0',
			APP_BASE_PATH: basePath,
			PARSER_HOST: 'localhost',
			PARSER_PORT: '5000',
			ORIGIN: `http://localhost:${port}`,
			...envOverrides
		},
		stdout: 'piped',
		stderr: 'piped'
	});

	const process = cmd.spawn();
	drainStream(process.stdout);
	drainStream(process.stderr);
	servers.push({ process, port, basePath });

	await waitForReady(`http://localhost:${port}`, 60_000);
	console.log(`Server ready on port ${port}`);
}

async function waitForReady(url: string, timeoutMs: number): Promise<void> {
	const start = Date.now();
	const healthUrl = `${url}/api/v1/health`;

	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) });
			if (res.ok) return;
		} catch {
			// Not ready yet
		}
		await new Promise((r) => setTimeout(r, 500));
	}

	throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

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

function getZapCommand(mode: ScanMode): string {
	switch (mode) {
		case 'baseline':
			return 'zap-baseline.py';
		case 'full':
			return 'zap-full-scan.py';
		case 'api':
			throw new Error('unreachable');
	}
}

async function runZap(target: string, label: string, mode: ScanMode): Promise<number> {
	console.log(`\n${'='.repeat(60)}`);
	console.log(` ZAP ${mode} scan: ${label}`);
	console.log(` Target: ${target}`);
	console.log(`${'='.repeat(60)}\n`);

	// ZAP runs as uid 1000 inside the container — needs a writable work dir
	const wrkDir = await Deno.makeTempDir({ prefix: 'zap-wrk-' });
	await Deno.chmod(wrkDir, 0o777);

	const cmd = new Deno.Command('docker', {
		args: [
			'run',
			'--rm',
			'--network',
			'host',
			'-v',
			`${wrkDir}:/zap/wrk:rw`,
			ZAP_IMAGE,
			getZapCommand(mode),
			'-t',
			target,
			'-I' // don't fail on warnings, only on errors
		],
		stdout: 'inherit',
		stderr: 'inherit'
	});

	const { code } = await cmd.output();
	try {
		await Deno.remove(wrkDir, { recursive: true });
	} catch {
		// Cleanup best-effort
	}
	return code;
}

async function cleanup(): Promise<void> {
	for (const server of servers) {
		console.log(`Stopping server on port ${server.port}...`);
		try {
			server.process.kill('SIGTERM');
			await server.process.status;
		} catch {
			// Already dead
		}
		try {
			await Deno.remove(server.basePath, { recursive: true });
		} catch {
			// May not exist
		}
	}
}

// --- Main ---

const mode = parseScanMode();

if (mode === 'api') {
	console.error('API scan is not yet implemented.');
	console.error('Requires the API overhaul (see docs/todo/api-overhaul.md).');
	Deno.exit(1);
}

await checkPrereqs();

let exitCode = 0;

try {
	// 1. Unauthenticated scan -- tests what an outsider sees
	await startServer(7090, { AUTH: 'on' });

	// 2. Full scan -- AUTH=off so ZAP can crawl everything
	await startServer(7091, { AUTH: 'off' });

	const code1 = await runZap('http://localhost:7090', 'Unauthenticated (AUTH=on)', mode);
	const code2 = await runZap('http://localhost:7091', 'Full crawl (AUTH=off)', mode);

	if (code1 !== 0 || code2 !== 0) exitCode = 1;
} catch (error) {
	console.error('ZAP scan error:', error);
	exitCode = 1;
} finally {
	await cleanup();
}

Deno.exit(exitCode);
