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
 *   Directory aliases:  auth, upgrades, drift, jobs, logger, rename, sanitize
 *   File aliases:       filters, normalize, selectors, backup, cleanup, processor
 *
 * ─── Integration Tests ───────────────────────────────────────────────────
 *
 *   deno task test integration              All specs (parallel, Docker auto-managed)
 *   deno task test integration health       Single spec
 *   deno task test integration csrf         Single spec
 *   deno task test integration pcd          PCD integration specs
 *   deno task test integration pcd regex    Single PCD spec
 *
 *   Specs that need Docker (mock-oauth2-server + Caddy + nginx): oidc, cookie, proxy, reverseProxy502, reverseProxy502-manual
 *   Docker starts automatically when needed and tears down after.
 *
 * ─── E2E Tests ───────────────────────────────────────────────────────────
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

import { PORTS } from './integration/harness/ports.ts';

// ─── Constants ───────────────────────────────────────────────────────────────

const INTEGRATION_COMPOSE = 'tests/integration/auth/docker-compose.yml';
const INTEGRATION_AUTH_SPEC_DIR = 'tests/integration/auth/specs';
const INTEGRATION_API_SPEC_DIR = 'tests/integration/api/specs';
const INTEGRATION_PCD_SPEC_DIR = 'tests/integration/pcd';
const INTEGRATION_NOTIFICATION_SPEC_DIR = 'tests/integration/notifications/specs';
const INTEGRATION_BACKUP_SPEC_DIR = 'tests/integration/backups/specs';
const INTEGRATION_ANNOUNCEMENTS_SPEC_DIR = 'tests/integration/announcements/specs';
const INTEGRATION_SPEC_DIR = INTEGRATION_AUTH_SPEC_DIR; // backward compat
const INTEGRATION_SUITES = new Set([
	'auth',
	'pcd',
	'api',
	'notifications',
	'backups',
	'announcements'
]);

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
	drift: 'tests/unit/drift',
	jobs: 'tests/unit/jobs',
	logger: 'tests/unit/logger',
	rename: 'tests/unit/rename',
	sanitize: 'tests/unit/sanitize',
	backups: 'tests/unit/backups',
	announcements: 'tests/unit/announcements',
	pcd: 'tests/unit/pcd',
	// Individual files
	filters: 'tests/unit/upgrades/filters.test.ts',
	normalize: 'tests/unit/upgrades/normalize.test.ts',
	selectors: 'tests/unit/upgrades/selectors.test.ts',
	backup: 'tests/unit/backups/createBackup.test.ts',
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
	// Parse suite/spec from target: "pcd", "pcd write regex", "health", etc.
	let suite: string | undefined;
	let specName: string | undefined;

	if (target && INTEGRATION_SUITES.has(target)) {
		// "deno task test integration pcd"
		suite = target;
	} else if (target) {
		// Could be "pcd write regex" (suite + spec) or "health" (legacy auth spec)
		const parts = target.split(/\s+/);
		if (parts.length >= 2 && INTEGRATION_SUITES.has(parts[0])) {
			suite = parts[0];
			// Join remaining segments with '/' so callers can scope by nested
			// directory: `pcd write regex` -> 'write/regex'
			specName = parts.slice(1).join('/');
		} else {
			// Legacy: treat as auth spec name
			suite = 'auth';
			specName = target;
		}
	}

	// Resolve spec dirs and files
	function getSpecDir(s: string): string {
		if (s === 'api') return INTEGRATION_API_SPEC_DIR;
		if (s === 'pcd') return INTEGRATION_PCD_SPEC_DIR;
		if (s === 'notifications') return INTEGRATION_NOTIFICATION_SPEC_DIR;
		if (s === 'backups') return INTEGRATION_BACKUP_SPEC_DIR;
		if (s === 'announcements') return INTEGRATION_ANNOUNCEMENTS_SPEC_DIR;
		return INTEGRATION_AUTH_SPEC_DIR;
	}

	// Determine which suites to run
	const suitesToRun = suite
		? [suite]
		: ['auth', 'api', 'notifications', 'announcements', 'backups', 'pcd'];

	// Docker is needed when running auth specs (all or specific ones that need it)
	const runningAuthSpecs = suitesToRun.includes('auth');
	const dockerSpecKey = specName?.split('/').pop();
	const dockerRequired =
		runningAuthSpecs && (!dockerSpecKey || !suite || INTEGRATION_NEEDS_DOCKER.has(dockerSpecKey));
	let exitCode = 1;

	// Docker is brought up in parallel with non-Docker specs. Specs that need
	// Docker (see INTEGRATION_NEEDS_DOCKER) will await this promise before
	// running; everything else proceeds immediately.
	let dockerReady: Promise<void> | undefined;

	try {
		if (dockerRequired) {
			dockerReady = execQuiet('docker', [
				'compose',
				'-f',
				INTEGRATION_COMPOSE,
				'up',
				'-d',
				'--wait'
			]);
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
				// Resolution order:
				//   1. <dir>/<specName>.test.ts                   exact file
				//   2. <dir>/<specName>/                          directory, run all
				//   3. recursive search by last segment           e.g. `pcd create`
				const fileCandidate = `${dir}/${specName}.test.ts`;
				const dirCandidate = `${dir}/${specName}`;
				let resolved = false;

				try {
					const stat = await Deno.stat(fileCandidate);
					if (stat.isFile) {
						specFiles.push(fileCandidate);
						resolved = true;
					}
				} catch {
					// not a file
				}

				if (!resolved) {
					try {
						const stat = await Deno.stat(dirCandidate);
						if (stat.isDirectory) {
							specFiles.push(...(await collectSpecs(dirCandidate)));
							resolved = true;
						}
					} catch {
						// not a directory
					}
				}

				if (!resolved) {
					const lastSegment = specName.split('/').pop() ?? specName;
					const allSpecs = await collectSpecs(dir);
					const match = allSpecs.find((f) => f.endsWith(`/${lastSegment}.test.ts`));
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
			// Multiple specs - run with rolling concurrency. Keep CONCURRENCY
			// specs running at once; as soon as any finishes, the next queued
			// spec takes its slot. Print a live one-liner per spec as it
			// completes, then a consolidated FAILURES section dumping full
			// stdout+stderr only for failed specs.
			//
			// Concurrency is capped because each spec spawns its own profilarr
			// server; without a cap, parallel boots saturate memory on smaller
			// runners (CI 2 vCPU / 7 GB, WSL allocations) and the OS OOM-kills
			// the slowest-starting servers.
			const CONCURRENCY = 10;
			const startMs = Date.now();
			console.log(`Running ${specFiles.length} specs (up to ${CONCURRENCY} in parallel)...\n`);

			type SpecResult = {
				name: string;
				code: number;
				stdout: string;
				stderr: string;
				durationMs: number;
			};

			const formatSpecName = (f: string): string =>
				f.replace('tests/integration/', '').replace('/specs/', '/').replace('.test.ts', '');
			const specBasename = (f: string): string => f.split('/').pop()!.replace('.test.ts', '');
			const needsDocker = (f: string): boolean => INTEGRATION_NEEDS_DOCKER.has(specBasename(f));

			const RESET = '\x1b[0m';
			const GREEN = '\x1b[32m';
			const RED = '\x1b[31m';
			const NAME_WIDTH = Math.max(...specFiles.map((f) => formatSpecName(f).length), 20);

			const runSpec = async (f: string): Promise<SpecResult> => {
				const name = formatSpecName(f);
				if (needsDocker(f) && dockerReady) {
					try {
						await dockerReady;
					} catch (err) {
						const msg = err instanceof Error ? err.message : String(err);
						console.log(`  ${RED}✗${RESET} ${name.padEnd(NAME_WIDTH)}  (docker)`);
						return {
							name,
							code: 1,
							stdout: '',
							stderr: `Docker infrastructure failed to start: ${msg}`,
							durationMs: 0
						};
					}
				}
				const specStart = Date.now();
				const result = await runIntegrationSpec(f, 'piped');
				const durationMs = Date.now() - specStart;
				const sym = result.code === 0 ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
				const dur = `${(durationMs / 1000).toFixed(1)}s`;
				console.log(`  ${sym} ${name.padEnd(NAME_WIDTH)}  ${dur.padStart(7)}`);
				return {
					name,
					code: result.code,
					stdout: result.stdout,
					stderr: result.stderr,
					durationMs
				};
			};

			// Run non-Docker specs first so they fill the pool while Docker is
			// still starting; Docker-needing specs await dockerReady inside runSpec.
			const queue = [...specFiles].sort((a, b) => {
				const ad = needsDocker(a);
				const bd = needsDocker(b);
				if (ad === bd) return 0;
				return ad ? 1 : -1;
			});
			const results: SpecResult[] = [];
			const workerCount = Math.min(CONCURRENCY, queue.length);
			const workers = Array.from({ length: workerCount }, async () => {
				while (queue.length > 0) {
					const f = queue.shift();
					if (f === undefined) break;
					results.push(await runSpec(f));
				}
			});
			await Promise.all(workers);

			const failures = results.filter((r) => r.code !== 0);
			exitCode = failures.length > 0 ? 1 : 0;

			if (failures.length > 0) {
				console.log('');
				console.log('='.repeat(60));
				console.log(` FAILURES (${failures.length})`);
				console.log('='.repeat(60));
				for (const f of failures) {
					console.log('');
					console.log(`${RED}✗ ${f.name}${RESET}`);
					console.log('');
					// If the spec ran tests and produced a "Failures:" summary block,
					// print only that block (the actual failures + final counts).
					// Otherwise the spec died in setup; print stdout as-is. Those
					// dumps are already short (server start logs + diagnostic).
					// Note: the spec's harness wraps "Failures:" in ANSI codes, so
					// we search for the bare token then walk back to the line start.
					const idx = f.stdout.lastIndexOf('Failures:');
					if (idx >= 0) {
						const lineStart = f.stdout.lastIndexOf('\n', idx) + 1;
						console.log('  --- spec failures ---');
						console.log(f.stdout.slice(lineStart));
					} else {
						console.log('  --- spec stdout ---');
						console.log(f.stdout || '  (empty)');
					}
					if (f.stderr) {
						console.log('  --- spec stderr ---');
						console.log(f.stderr);
					}
				}
			}

			const totalSec = ((Date.now() - startMs) / 1000).toFixed(1);
			console.log('');
			console.log('='.repeat(60));
			if (failures.length > 0) {
				console.log(
					` ${RED}${results.length} specs, ${failures.length} failed in ${totalSec}s${RESET}`
				);
				console.log(' Failed:');
				for (const f of failures) console.log(`   ${f.name}`);
			} else {
				console.log(` ${GREEN}${results.length} specs passed in ${totalSec}s${RESET}`);
			}
			console.log('='.repeat(60));
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
		.replace(`${INTEGRATION_API_SPEC_DIR}/`, '')
		.replace(`${INTEGRATION_PCD_SPEC_DIR}/`, '')
		.replace(`${INTEGRATION_NOTIFICATION_SPEC_DIR}/`, '')
		.replace(`${INTEGRATION_BACKUP_SPEC_DIR}/`, '')
		.replace(`${INTEGRATION_ANNOUNCEMENTS_SPEC_DIR}/`, '')
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

	console.error('Unknown E2E target. Available target: auth');
	return 1;
}

async function runE2EAuth(playwrightFlags: string[]): Promise<number> {
	const MOCK_OIDC_URL = 'http://localhost:9090/default/.well-known/openid-configuration';
	const DIRECT_PORT = PORTS.auth.oidc;
	const PROXY_PORT = PORTS.auth.oidcProxy;
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

/**
 * Run a command with stdout/stderr captured. On non-zero exit, the captured
 * output is printed and an error is thrown. On success, output is silently
 * discarded. Use for noisy commands whose output is only interesting on failure
 * (e.g. docker compose up/down).
 */
async function execQuiet(cmd: string, args: string[]): Promise<void> {
	const command = new Deno.Command(cmd, {
		args,
		stdout: 'piped',
		stderr: 'piped'
	});
	const result = await command.output();
	if (result.code !== 0) {
		const decoder = new TextDecoder();
		const stdout = decoder.decode(result.stdout);
		const stderr = decoder.decode(result.stderr);
		if (stdout) console.error(stdout);
		if (stderr) console.error(stderr);
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
		'  backups         tests/unit/backups/',
		'  filters         tests/unit/upgrades/filters.test.ts',
		'  normalize       tests/unit/upgrades/normalize.test.ts',
		'  selectors       tests/unit/upgrades/selectors.test.ts',
		'  backup          tests/unit/backups/createBackup.test.ts',
		'  cleanup         tests/unit/logger/cleanupLogs.test.ts',
		'  processor       tests/unit/rename/processor.test.ts',
		'',
		'Integration targets:',
		'  (none)          All integration suites, parallel',
		'  auth            Auth specs only (Docker auto-managed)',
		'  auth <name>     Single auth spec: health, csrf, cookie, apiKey,',
		'                  session, oidc, rateLimit, proxy, xForwardedFor,',
		'                  secretExposure, backupSecrets, pathTraversal',
		'  pcd             PCD specs only',
		'  pcd <name>      Single PCD spec (recursive search by basename)',
		'  pcd <a> <b>...  Scope by nested directory, e.g. pcd write regex',
		'  backups         Backup specs only',
		'  backups <name>  Single backup spec',
		'  <name>          Legacy: treated as auth spec name',
		'',
		'E2E targets:',
		'  auth            OIDC auth tests (Docker + preview servers)',
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
		'  deno task test e2e auth --debug      OIDC auth, debug mode'
	];
	console.log(lines.join('\n'));
}
