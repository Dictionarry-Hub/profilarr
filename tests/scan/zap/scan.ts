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
 * Requires: a production build (pnpm build), Bun, Docker
 *
 * Usage:
 *   pnpm scan:zap --baseline
 *   pnpm scan:zap --full
 */

import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ENTRY = './dist/build/server.js';
const ZAP_IMAGE = 'zaproxy/zap-stable';

type ScanMode = 'baseline' | 'full' | 'api';

interface ServerHandle {
	child: ChildProcess;
	exited: Promise<void>;
	port: number;
	basePath: string;
}

const servers: ServerHandle[] = [];

/**
 * Run a command to completion and resolve with its exit code. A process killed
 * by a signal resolves as 1. Rejects if the command cannot be spawned.
 */
function run(command: string, args: string[], stdio: 'ignore' | 'inherit'): Promise<number> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { stdio });
		child.on('error', reject);
		child.on('close', (code) => resolve(code ?? 1));
	});
}

function parseScanMode(): ScanMode {
	const args = process.argv.slice(2);
	if (args.includes('--baseline')) return 'baseline';
	if (args.includes('--full')) return 'full';
	if (args.includes('--api')) return 'api';

	console.error('Usage: pnpm scan:zap <mode>\n');
	console.error('Modes:');
	console.error('  --baseline   Passive scan only (spider + check responses)');
	console.error('  --full       Passive + active attacks (SQLi, XSS, etc.)');
	console.error('  --api        API scan against OpenAPI spec (not yet implemented)');
	process.exit(1);
}

async function checkPrereqs(): Promise<void> {
	try {
		await stat(ENTRY);
	} catch {
		console.error(`Build not found at ${ENTRY}. Run "pnpm build" first.`);
		process.exit(1);
	}

	const code = await run('docker', ['info'], 'ignore').catch(() => 1);
	if (code !== 0) {
		console.error('Docker is not running.');
		process.exit(1);
	}
}

async function startServer(port: number, envOverrides: Record<string, string>): Promise<void> {
	const basePath = `./dist/zap-${port}`;

	await mkdir(`${basePath}/data/databases`, { recursive: true });
	await mkdir(`${basePath}/logs`, { recursive: true });
	await mkdir(`${basePath}/backups`, { recursive: true });

	console.log(`Starting server on port ${port}...`);

	// Server output is discarded
	const child = spawn('bun', [ENTRY], {
		env: {
			...process.env,
			PORT: String(port),
			HOST: '0.0.0.0',
			APP_BASE_PATH: basePath,
			PARSER_HOST: 'localhost',
			PARSER_PORT: '5000',
			ORIGIN: `http://localhost:${port}`,
			...envOverrides
		},
		stdio: 'ignore'
	});

	// A spawn failure emits 'error' and may never emit 'exit'
	const exited = new Promise<void>((resolve) => {
		child.on('exit', () => resolve());
		child.on('error', () => resolve());
	});
	servers.push({ child, exited, port, basePath });

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

	// ZAP runs as uid 1000 inside the container, so it needs a writable work dir
	const wrkDir = await mkdtemp(join(tmpdir(), 'zap-wrk-'));
	await chmod(wrkDir, 0o777);

	const code = await run(
		'docker',
		[
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
		'inherit'
	);
	try {
		await rm(wrkDir, { recursive: true, force: true });
	} catch {
		// Cleanup best-effort
	}
	return code;
}

async function cleanup(): Promise<void> {
	for (const server of servers) {
		console.log(`Stopping server on port ${server.port}...`);
		try {
			server.child.kill('SIGTERM');
			await server.exited;
		} catch {
			// Already dead
		}
		try {
			await rm(server.basePath, { recursive: true, force: true });
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
	process.exit(1);
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

process.exit(exitCode);
