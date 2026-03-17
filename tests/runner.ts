/**
 * Unified test runner for Profilarr.
 *
 * Usage:
 *   deno task test [command] [target] [flags]
 *
 * Commands:
 *   unit            Run Deno unit tests (default when no command given)
 *   integration     Run auth integration specs (Docker + isolated servers)
 *   e2e             Run Playwright E2E tests
 *   zap             Run OWASP ZAP security scan (requires build + Docker)
 *   semgrep         Run Semgrep static analysis scan
 *
 * ─── Unit Tests ──────────────────────────────────────────────────────────
 *
 *   deno task test                     All unit tests
 *   deno task test unit                All unit tests (explicit)
 *   deno task test unit auth           tests/unit/auth/ only
 *   deno task test unit upgrades       tests/unit/upgrades/ only
 *   deno task test unit filters        Single file (tests/unit/upgrades/filters.test.ts)
 *
 *   Directory aliases:  auth, upgrades, jobs, logger, rename, sanitize
 *   File aliases:       filters, normalize, selectors, backup, cleanup, processor
 *
 * ─── Integration Tests ───────────────────────────────────────────────────
 *
 *   deno task test integration              All specs (parallel, Docker auto-managed)
 *   deno task test integration health       Single spec
 *   deno task test integration csrf         Single spec
 *
 *   Specs that need Docker (mock-oauth2-server + Caddy + nginx): oidc, cookie, proxy, reverseProxy502, reverseProxy502-manual
 *   Docker starts automatically when needed and tears down after.
 *
 * ─── E2E Tests ───────────────────────────────────────────────────────────
 *
 *   PCD conflict tests (Playwright against running dev server):
 *
 *   deno task test e2e                      All PCD specs (headless)
 *   deno task test e2e 1                    All CF specs (major group 1)
 *   deno task test e2e 2                    All QP specs (major group 2)
 *   deno task test e2e 3                    All regex specs (major group 3)
 *   deno task test e2e 1.12                 Single spec (1.12-cf-...)
 *   deno task test e2e 1-2                  Range (CF + QP)
 *   deno task test e2e 1.12,1.15            Comma-separated
 *   deno task test e2e --headed             Headed mode (browser visible)
 *   deno task test e2e 1.5 --debug          Debug mode (Playwright inspector)
 *
 *   Auth OIDC tests (Docker + preview servers, auto-managed):
 *
 *   deno task test e2e auth                 OIDC flow tests (headless)
 *   deno task test e2e auth --headed        Headed
 *   deno task test e2e auth --debug         Debug
 *
 * ─── Scans ──────────────────────────────────────────────────────────────
 *
 *   deno task test zap --baseline          OWASP ZAP passive scan (build + Docker)
 *   deno task test zap --full             OWASP ZAP passive + active scan
 *   deno task test zap --api              API scan against OpenAPI spec (not yet implemented)
 *   deno task test semgrep                Full semgrep scan (local + community rules)
 *   deno task test semgrep --quick        Local rules only (tests/scan/semgrep/)
 *
 * ─── Flags ───────────────────────────────────────────────────────────────
 *
 *   --headed        E2E only. Show browser window.
 *   --debug         E2E only. Open Playwright inspector.
 *   --help, -h      Show this help text.
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const INTEGRATION_COMPOSE = 'tests/integration/auth/docker-compose.yml';
const INTEGRATION_AUTH_SPEC_DIR = 'tests/integration/auth/specs';
const INTEGRATION_CONFLICT_SPEC_DIR = 'tests/integration/conflicts/specs';
const INTEGRATION_NOTIFICATION_SPEC_DIR = 'tests/integration/notifications/specs';
const INTEGRATION_SPEC_DIR = INTEGRATION_AUTH_SPEC_DIR; // backward compat
const INTEGRATION_SUITES = new Set(['auth', 'conflicts', 'notifications']);

const E2E_PCD_CONFIG = 'tests/e2e/pcd/playwright.config.ts';
const E2E_PCD_SPEC_DIR = 'tests/e2e/pcd/specs';
const E2E_AUTH_CONFIG = 'tests/e2e/auth/playwright.config.ts';
const E2E_AUTH_COMPOSE = 'tests/integration/auth/docker-compose.yml';
const E2E_AUTH_BINARY = './dist/build/profilarr';
const PLAYWRIGHT_CLI = './node_modules/playwright/cli.js';

// Integration specs that require Docker infrastructure
const INTEGRATION_NEEDS_DOCKER = new Set([
	'oidc',
	'cookie',
	'proxy',
	'reverseProxy502',
	'reverseProxy502-manual'
]);
// Integration specs that connect to Caddy's self-signed TLS
const INTEGRATION_NEEDS_TLS_INSECURE = new Set(['cookie', 'proxy', 'oidc']);

// Unit test aliases: name -> path relative to repo root
const UNIT_ALIASES: Record<string, string> = {
	// Directories
	auth: 'tests/unit/auth',
	upgrades: 'tests/unit/upgrades',
	jobs: 'tests/unit/jobs',
	logger: 'tests/unit/logger',
	rename: 'tests/unit/rename',
	sanitize: 'tests/unit/sanitize',
	// Individual files
	filters: 'tests/unit/upgrades/filters.test.ts',
	normalize: 'tests/unit/upgrades/normalize.test.ts',
	selectors: 'tests/unit/upgrades/selectors.test.ts',
	backup: 'tests/unit/jobs/createBackup.test.ts',
	cleanup: 'tests/unit/logger/cleanupLogs.test.ts',
	processor: 'tests/unit/rename/processor.test.ts'
};

// ─── Arg Parsing ─────────────────────────────────────────────────────────────

const COMMANDS = new Set(['unit', 'integration', 'e2e', 'zap', 'semgrep']);
const args = [...Deno.args];

// Check for help flag anywhere
if (args.includes('--help') || args.includes('-h')) {
	printHelp();
	Deno.exit(0);
}

// Determine command and remaining args
let command = 'unit';
const remaining: string[] = [];
const flags: string[] = [];

let commandParsed = false;
for (const arg of args) {
	if (!commandParsed && COMMANDS.has(arg)) {
		command = arg;
		commandParsed = true;
		continue;
	}
	if (arg.startsWith('--')) {
		flags.push(arg);
	} else {
		remaining.push(arg);
	}
}

// If the first arg wasn't a command but matches a unit alias, treat as `unit <alias>`
if (!commandParsed && args.length > 0 && !args[0].startsWith('--')) {
	const firstArg = args[0];
	if (UNIT_ALIASES[firstArg]) {
		command = 'unit';
		// remaining already has it from the loop above
	}
}

// ─── Dispatch ────────────────────────────────────────────────────────────────

switch (command) {
	case 'unit':
		Deno.exit(await runUnit(remaining[0]));
	case 'integration':
		Deno.exit(await runIntegration(remaining.length > 0 ? remaining.join(' ') : undefined));
	case 'e2e':
		Deno.exit(await runE2E(remaining, flags));
	case 'zap':
		Deno.exit(await runScan('tests/scan/zap/scan.ts', flags));
	case 'semgrep':
		Deno.exit(await runScan('tests/scan/semgrep/scan.ts', flags));
}

// ─── Unit Tests ──────────────────────────────────────────────────────────────

async function runUnit(target?: string): Promise<number> {
	const testPath = target ? (UNIT_ALIASES[target] ?? target) : 'tests/unit';

	// Validate path exists
	if (target && !UNIT_ALIASES[target]) {
		try {
			await Deno.stat(target);
		} catch {
			console.error(`Unknown test target: "${target}"`);
			console.error('\nAvailable aliases:');
			for (const [alias, path] of Object.entries(UNIT_ALIASES)) {
				console.error(`  ${alias.padEnd(12)} -> ${path}`);
			}
			return 1;
		}
	}

	console.log(`Running unit tests: ${testPath}\n`);

	const cmd = new Deno.Command('deno', {
		args: [
			'test',
			testPath,
			'--allow-read',
			'--allow-write',
			'--allow-env',
			'--allow-run',
			'--allow-ffi',
			'--allow-net'
		],
		env: { ...Deno.env.toObject(), APP_BASE_PATH: './dist/test' },
		stdout: 'inherit',
		stderr: 'inherit'
	});

	const { code } = await cmd.output();
	return code;
}

// ─── Integration Tests ──────────────────────────────────────────────────────

async function runIntegration(target?: string): Promise<number> {
	// Parse suite/spec from target: "conflicts", "conflicts detection", "health", etc.
	let suite: string | undefined;
	let specName: string | undefined;

	if (target && INTEGRATION_SUITES.has(target)) {
		// "deno task test integration conflicts"
		suite = target;
	} else if (target) {
		// Could be "conflicts detection" (suite + spec) or "health" (legacy auth spec)
		const parts = target.split(/\s+/);
		if (parts.length >= 2 && INTEGRATION_SUITES.has(parts[0])) {
			suite = parts[0];
			specName = parts[1];
		} else {
			// Legacy: treat as auth spec name
			suite = 'auth';
			specName = target;
		}
	}

	// Resolve spec dirs and files
	function getSpecDir(s: string): string {
		if (s === 'conflicts') return INTEGRATION_CONFLICT_SPEC_DIR;
		if (s === 'notifications') return INTEGRATION_NOTIFICATION_SPEC_DIR;
		return INTEGRATION_AUTH_SPEC_DIR;
	}

	// Determine which suites to run
	const suitesToRun = suite ? [suite] : ['auth', 'conflicts', 'notifications'];

	// Docker is needed when running auth specs (all or specific ones that need it)
	const runningAuthSpecs = suitesToRun.includes('auth');
	const dockerRequired =
		runningAuthSpecs && (!specName || !suite || INTEGRATION_NEEDS_DOCKER.has(specName));
	let exitCode = 1;

	try {
		if (dockerRequired) {
			console.log('Starting Docker infrastructure...');
			await exec('docker', ['compose', '-f', INTEGRATION_COMPOSE, 'up', '-d', '--wait']);
			console.log('Docker infrastructure ready.\n');
		}

		// Collect spec files from all suites
		// Recursively collect .test.ts files from a directory
		async function collectSpecs(dir: string): Promise<string[]> {
			const files: string[] = [];
			try {
				for await (const entry of Deno.readDir(dir)) {
					if (entry.isDirectory) {
						files.push(...(await collectSpecs(`${dir}/${entry.name}`)));
					} else if (
						entry.isFile &&
						entry.name.endsWith('.test.ts') &&
						!entry.name.endsWith('-manual.test.ts')
					) {
						files.push(`${dir}/${entry.name}`);
					}
				}
			} catch {
				// Directory may not exist yet
			}
			return files;
		}

		const specFiles: string[] = [];
		for (const s of suitesToRun) {
			const dir = getSpecDir(s);
			if (specName && s === suite) {
				// Try direct path first, then search subdirectories
				const directPath = `${dir}/${specName}.test.ts`;
				try {
					await Deno.stat(directPath);
					specFiles.push(directPath);
				} catch {
					// Search subdirectories for the spec
					const allSpecs = await collectSpecs(dir);
					const match = allSpecs.find((f) => f.endsWith(`/${specName}.test.ts`));
					if (match) {
						specFiles.push(match);
					} else {
						console.error(`Unknown integration spec: "${specName}" in suite "${s}"`);
						return 1;
					}
				}
			} else {
				specFiles.push(...(await collectSpecs(dir)));
			}
		}
		specFiles.sort();

		if (specFiles.length === 0) {
			console.error('No integration specs found.');
			return 1;
		}

		if (specFiles.length === 1) {
			// Single spec - run with inherited output
			console.log(`Running: ${specFiles[0]}\n`);
			const result = await runIntegrationSpec(specFiles[0], 'inherit');
			exitCode = result.code;
		} else {
			// Multiple specs - run in parallel, collect output
			console.log(`Running ${specFiles.length} specs in parallel...\n`);
			const results = await Promise.all(specFiles.map((f) => runIntegrationSpec(f, 'piped')));

			exitCode = 0;
			for (let i = 0; i < specFiles.length; i++) {
				// Extract suite/spec name for display
				const name = specFiles[i]
					.replace('tests/integration/', '')
					.replace('/specs/', '/')
					.replace('.test.ts', '');
				const result = results[i];
				console.log(`\n${'='.repeat(60)}`);
				console.log(` ${name}`);
				console.log(`${'='.repeat(60)}`);
				console.log(result.stdout);
				if (result.stderr) console.error(result.stderr);
				if (result.code !== 0) exitCode = 1;
			}
		}
	} catch (error) {
		console.error('Integration test error:', error);
	} finally {
		if (dockerRequired) {
			console.log('\nStopping Docker infrastructure...');
			await exec('docker', ['compose', '-f', INTEGRATION_COMPOSE, 'down']);
		}

		// Clean up temp directories
		console.log('Cleaning up temp directories...');
		try {
			for await (const entry of Deno.readDir('./dist')) {
				if (entry.isDirectory && entry.name.startsWith('integration-')) {
					try {
						await Deno.remove(`./dist/${entry.name}`, { recursive: true });
					} catch {
						// Ignore cleanup errors
					}
				}
			}
		} catch {
			// dist/ may not exist
		}
	}

	return exitCode;
}

async function runIntegrationSpec(
	specFile: string,
	output: 'inherit' | 'piped'
): Promise<{ code: number; stdout: string; stderr: string }> {
	const specName = specFile
		.replace(`${INTEGRATION_AUTH_SPEC_DIR}/`, '')
		.replace(`${INTEGRATION_CONFLICT_SPEC_DIR}/`, '')
		.replace(`${INTEGRATION_NOTIFICATION_SPEC_DIR}/`, '')
		.replace('.test.ts', '');
	const args = ['run', '--allow-all', '--no-check'];
	if (INTEGRATION_NEEDS_TLS_INSECURE.has(specName)) {
		args.push('--unsafely-ignore-certificate-errors=localhost');
	}
	args.push(specFile);

	const cmd = new Deno.Command('deno', {
		args,
		env: { ...Deno.env.toObject(), INTEGRATION_TEST: '1' },
		stdin: output === 'inherit' ? 'inherit' : 'null',
		stdout: output,
		stderr: output
	});

	const result = await cmd.output();
	const decoder = new TextDecoder();
	return {
		code: result.code,
		stdout: output === 'piped' ? decoder.decode(result.stdout) : '',
		stderr: output === 'piped' ? decoder.decode(result.stderr) : ''
	};
}

// ─── E2E Tests ───────────────────────────────────────────────────────────────

async function runE2E(targets: string[], flags: string[]): Promise<number> {
	// Forward --headed and --debug to Playwright
	const playwrightFlags: string[] = [];
	for (const flag of flags) {
		if (flag === '--headed' || flag === '--debug') {
			playwrightFlags.push(flag);
		}
	}

	// Check if this is an auth E2E run
	if (targets.length === 1 && targets[0] === 'auth') {
		return runE2EAuth(playwrightFlags);
	}

	// PCD E2E - resolve numeric selectors to spec files
	return runE2EPCD(targets, playwrightFlags);
}

async function runE2EPCD(selectors: string[], playwrightFlags: string[]): Promise<number> {
	const specFiles = await listSpecFiles(E2E_PCD_SPEC_DIR);
	const testTargets: string[] = [];
	const seen = new Set<string>();

	function addTarget(target: string) {
		if (seen.has(target)) return;
		seen.add(target);
		testTargets.push(target);
	}

	if (selectors.length === 0) {
		// No selectors - run all PCD specs
		addTarget(E2E_PCD_SPEC_DIR);
	} else {
		for (const selector of selectors) {
			// Expand comma-separated values
			for (const part of selector.split(',')) {
				const trimmed = part.trim();
				if (!trimmed) continue;

				// Direct file path
				if (trimmed.includes('/') || trimmed.includes('*') || trimmed.endsWith('.spec.ts')) {
					addTarget(trimmed);
					continue;
				}

				// Range: 1-2
				const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
				if (rangeMatch) {
					const start = parseInt(rangeMatch[1], 10);
					const end = parseInt(rangeMatch[2], 10);
					if (isNaN(start) || isNaN(end) || start > end) {
						console.error(`Invalid range "${trimmed}".`);
						return 1;
					}
					for (let major = start; major <= end; major++) {
						const matches = specFiles.filter((f) => fileStartsWith(f, `${major}.`));
						if (matches.length === 0) {
							console.error(`No specs matched major group "${major}".`);
							return 1;
						}
						matches.forEach(addTarget);
					}
					continue;
				}

				// Major group: 1, 2, 3
				if (/^\d+$/.test(trimmed)) {
					const matches = specFiles.filter((f) => fileStartsWith(f, `${trimmed}.`));
					if (matches.length === 0) {
						console.error(`No specs matched major group "${trimmed}".`);
						printAvailableSpecs(specFiles);
						return 1;
					}
					matches.forEach(addTarget);
					continue;
				}

				// Exact spec: 1.12
				if (/^\d+\.\d+$/.test(trimmed)) {
					const matches = specFiles.filter((f) => fileStartsWith(f, `${trimmed}-`));
					if (matches.length === 0) {
						console.error(`No specs matched "${trimmed}".`);
						printAvailableSpecs(specFiles);
						return 1;
					}
					matches.forEach(addTarget);
					continue;
				}

				console.error(`Unknown selector "${trimmed}".`);
				printAvailableSpecs(specFiles);
				return 1;
			}
		}
	}

	const nodeBinary = await resolvePlaywrightNodeBinary();
	if (!nodeBinary) {
		return 1;
	}

	const cmd = new Deno.Command(nodeBinary, {
		args: [PLAYWRIGHT_CLI, 'test', '--config', E2E_PCD_CONFIG, ...playwrightFlags, ...testTargets],
		stdout: 'inherit',
		stderr: 'inherit'
	});

	const { code } = await cmd.output();
	return code;
}

async function runE2EAuth(playwrightFlags: string[]): Promise<number> {
	const MOCK_OIDC_URL = 'http://localhost:9090/default/.well-known/openid-configuration';
	const DIRECT_PORT = 7006;
	const PROXY_PORT = 7009;
	const PROXY_ORIGIN = 'https://localhost:7445';

	const OIDC_ENV = {
		AUTH: 'oidc',
		OIDC_DISCOVERY_URL: MOCK_OIDC_URL,
		OIDC_CLIENT_ID: 'profilarr',
		OIDC_CLIENT_SECRET: 'secret'
	};

	interface ServerHandle {
		process: Deno.ChildProcess;
		port: number;
		basePath: string;
	}

	const servers: ServerHandle[] = [];
	let exitCode = 1;

	try {
		// 1. Check build exists
		try {
			await Deno.stat(E2E_AUTH_BINARY);
		} catch {
			console.error(`Build not found at ${E2E_AUTH_BINARY}. Run "deno task build" first.`);
			return 1;
		}

		// 2. Start Docker
		console.log('Starting Docker infrastructure...');
		await exec('docker', ['compose', '-f', E2E_AUTH_COMPOSE, 'up', '-d', '--wait']);
		console.log('Docker infrastructure ready.\n');

		// 3. Start preview servers
		async function startServer(port: number, envOverrides: Record<string, string>): Promise<void> {
			const basePath = `./dist/e2e-oidc-${port}`;
			console.log(`Starting server on port ${port}...`);

			await Deno.mkdir(`${basePath}/data/databases`, { recursive: true });
			await Deno.mkdir(`${basePath}/logs`, { recursive: true });
			await Deno.mkdir(`${basePath}/backups`, { recursive: true });

			const cmd = new Deno.Command(E2E_AUTH_BINARY, {
				env: {
					...Deno.env.toObject(),
					PORT: String(port),
					HOST: '0.0.0.0',
					APP_BASE_PATH: basePath,
					PARSER_HOST: 'localhost',
					PARSER_PORT: '5000',
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

		await startServer(DIRECT_PORT, {
			ORIGIN: `http://localhost:${DIRECT_PORT}`,
			...OIDC_ENV
		});
		await startServer(PROXY_PORT, {
			ORIGIN: PROXY_ORIGIN,
			...OIDC_ENV
		});

		// 4. Run Playwright
		console.log('\nRunning Playwright tests...\n');
		const nodeBinary = await resolvePlaywrightNodeBinary();
		if (!nodeBinary) {
			return 1;
		}

		const cmd = new Deno.Command(nodeBinary, {
			args: [PLAYWRIGHT_CLI, 'test', '--config', E2E_AUTH_CONFIG, ...playwrightFlags],
			env: {
				...Deno.env.toObject(),
				OIDC_DIRECT_URL: `http://localhost:${DIRECT_PORT}`,
				OIDC_PROXY_URL: PROXY_ORIGIN
			},
			stdout: 'inherit',
			stderr: 'inherit'
		});

		const result = await cmd.output();
		exitCode = result.code;
	} catch (error) {
		console.error('E2E auth test error:', error);
	} finally {
		// 5. Stop servers
		for (const server of servers) {
			console.log(`Stopping server on port ${server.port}...`);
			try {
				server.process.kill('SIGTERM');
				await server.process.status;
			} catch {
				// Process may already be dead
			}
			try {
				await Deno.remove(server.basePath, { recursive: true });
			} catch {
				// Directory may not exist
			}
		}

		// 6. Stop Docker
		console.log('\nStopping Docker infrastructure...');
		await exec('docker', ['compose', '-f', E2E_AUTH_COMPOSE, 'down']);
	}

	return exitCode;
}

// ─── Scans ───────────────────────────────────────────────────────────────────

async function runScan(script: string, passFlags: string[] = []): Promise<number> {
	const cmd = new Deno.Command('deno', {
		args: ['run', '--allow-all', '--no-check', script, ...passFlags],
		stdout: 'inherit',
		stderr: 'inherit'
	});

	const { code } = await cmd.output();
	return code;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function exec(cmd: string, args: string[]): Promise<void> {
	const command = new Deno.Command(cmd, {
		args,
		stdout: 'inherit',
		stderr: 'inherit'
	});
	const { code } = await command.output();
	if (code !== 0) {
		throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
	}
}

async function resolvePlaywrightNodeBinary(): Promise<string | null> {
	const envOverride = Deno.env.get('PLAYWRIGHT_NODE_BINARY');
	const candidates = [
		...(envOverride ? [envOverride] : []),
		'node',
		...(await listNvmNodeCandidates())
	];

	const seen = new Set<string>();
	for (const candidate of candidates) {
		if (seen.has(candidate)) continue;
		seen.add(candidate);

		const major = await getNodeMajorVersion(candidate);
		if (major !== null && major >= 18 && major <= 24) {
			return candidate;
		}
	}

	const currentVersion = await getNodeMajorVersion('node');
	const currentLabel = currentVersion === null ? 'unknown' : `v${currentVersion}`;
	console.error(
		`Playwright E2E requires a supported Node runtime (18-24). Current runner node is ${currentLabel}.`
	);
	console.error(
		'Install Node 20/22/24 and either make it the active `node` or set `PLAYWRIGHT_NODE_BINARY`.'
	);
	return null;
}

async function listNvmNodeCandidates(): Promise<string[]> {
	const home = Deno.env.get('HOME');
	if (!home) return [];

	const versionsDir = `${home}/.nvm/versions/node`;
	const candidates: string[] = [];

	try {
		const entries: string[] = [];
		for await (const entry of Deno.readDir(versionsDir)) {
			if (entry.isDirectory) {
				entries.push(entry.name);
			}
		}

		entries.sort().reverse();
		for (const entry of entries) {
			candidates.push(`${versionsDir}/${entry}/bin/node`);
		}
	} catch {
		// nvm not installed or unreadable
	}

	return candidates;
}

async function getNodeMajorVersion(nodeBinary: string): Promise<number | null> {
	try {
		const result = await new Deno.Command(nodeBinary, {
			args: ['-p', 'process.versions.node.split(".")[0]'],
			stdout: 'piped',
			stderr: 'null'
		}).output();
		if (result.code !== 0) return null;
		const raw = new TextDecoder().decode(result.stdout).trim();
		const major = parseInt(raw, 10);
		return Number.isNaN(major) ? null : major;
	} catch {
		return null;
	}
}

async function listSpecFiles(dir: string): Promise<string[]> {
	const files: string[] = [];
	try {
		for await (const entry of Deno.readDir(dir)) {
			if (entry.isFile && entry.name.endsWith('.spec.ts')) {
				files.push(`${dir}/${entry.name}`);
			}
		}
	} catch (error) {
		console.error(`Failed to read spec directory "${dir}".`);
		console.error(error instanceof Error ? error.message : String(error));
		Deno.exit(1);
	}
	return files.sort();
}

function fileStartsWith(filePath: string, prefix: string): boolean {
	const name = filePath.split('/').pop() ?? filePath;
	return name.startsWith(prefix);
}

function printAvailableSpecs(files: string[]): void {
	console.error('\nAvailable specs:');
	for (const file of files) {
		console.error(`  ${file.split('/').pop()}`);
	}
}

async function waitForReady(url: string, timeoutMs: number): Promise<void> {
	const start = Date.now();
	const healthUrl = `${url}/api/v1/health`;

	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) });
			if (res.ok) return;
		} catch {
			// Server not ready yet
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

function printHelp(): void {
	// Read the JSDoc at the top of this file
	const lines = [
		'Profilarr Test Runner',
		'',
		'Usage: deno task test [command] [target] [flags]',
		'',
		'Commands:',
		'  unit            Deno unit tests (default)',
		'  integration     Auth integration specs',
		'  e2e             Playwright E2E tests',
		'  zap             OWASP ZAP security scan (build + Docker)',
		'  semgrep         Semgrep static analysis scan',
		'',
		'Unit targets:',
		'  (none)          All unit tests',
		'  auth            tests/unit/auth/',
		'  upgrades        tests/unit/upgrades/',
		'  jobs            tests/unit/jobs/',
		'  logger          tests/unit/logger/',
		'  rename          tests/unit/rename/',
		'  sanitize        tests/unit/sanitize/',
		'  filters         tests/unit/upgrades/filters.test.ts',
		'  normalize       tests/unit/upgrades/normalize.test.ts',
		'  selectors       tests/unit/upgrades/selectors.test.ts',
		'  backup          tests/unit/jobs/createBackup.test.ts',
		'  cleanup         tests/unit/logger/cleanupLogs.test.ts',
		'  processor       tests/unit/rename/processor.test.ts',
		'',
		'Integration targets:',
		'  (none)          All suites (auth + conflicts, parallel)',
		'  auth            Auth specs only (Docker auto-managed)',
		'  auth <name>     Single auth spec: health, csrf, cookie, apiKey,',
		'                  session, oidc, rateLimit, proxy, xForwardedFor,',
		'                  secretExposure, backupSecrets, pathTraversal',
		'  conflicts       Conflict specs only',
		'  conflicts <n>   Single conflict spec: detection, grouping,',
		'                  align, override',
		'  <name>          Legacy: treated as auth spec name',
		'',
		'E2E targets:',
		'  (none)          All PCD specs (headless)',
		'  auth            OIDC auth tests (Docker + preview servers)',
		'  1               All CF specs (major group)',
		'  1.12            Single spec',
		'  1-2             Range of major groups',
		'  1.12,1.15       Comma-separated',
		'',
		'Scans:',
		'  zap --baseline  Passive scan (spider + check responses)',
		'  zap --full      Passive + active attacks (SQLi, XSS, etc.)',
		'  zap --api       API scan against OpenAPI spec (not yet implemented)',
		'  semgrep         Full scan with community rules (semgrep CLI required)',
		'  semgrep --quick Local rules only (tests/scan/semgrep/)',
		'',
		'E2E flags:',
		'  --headed        Show browser window',
		'  --debug         Open Playwright inspector',
		'',
		'Examples:',
		'  deno task test                       All unit tests',
		'  deno task test unit auth             Auth unit tests only',
		'  deno task test integration health    Single integration spec',
		'  deno task test e2e 1.5 --headed      Single PCD spec, headed',
		'  deno task test e2e auth --debug      OIDC auth, debug mode'
	];
	console.log(lines.join('\n'));
}
