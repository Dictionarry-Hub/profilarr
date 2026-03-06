/**
 * E2E OIDC test orchestrator.
 *
 * 1. Start Docker Compose (mock-oauth2-server + Caddy)
 * 2. Build app if needed
 * 3. Start two preview servers (direct + proxy)
 * 4. Run Playwright tests
 * 5. Tear down everything
 *
 * Usage:
 *   deno task test:e2e:oidc             # headless
 *   deno task test:e2e:oidc --headed    # headed
 */

const COMPOSE_FILE = 'src/tests/integration/docker-compose.yml';
const BINARY = './dist/build/profilarr';
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

// Forward --headed flag to Playwright
const playwrightArgs: string[] = [];
for (const arg of Deno.args) {
	if (arg === '--headed') {
		playwrightArgs.push('--headed');
	}
	if (arg === '--debug') {
		playwrightArgs.push('--debug');
	}
}

let exitCode = 1;

try {
	// 1. Ensure build exists
	try {
		await Deno.stat(BINARY);
	} catch {
		console.error(`Build not found at ${BINARY}. Run "deno task build" first.`);
		Deno.exit(1);
	}

	// 2. Start Docker infrastructure
	console.log('Starting Docker infrastructure...');
	await run('docker', ['compose', '-f', COMPOSE_FILE, 'up', '-d', '--wait']);
	console.log('Docker infrastructure ready.\n');

	// 3. Start servers
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
	const cmd = new Deno.Command('npx', {
		args: ['playwright', 'test', '--config', 'playwright.oidc.config.ts', ...playwrightArgs],
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
	console.error('E2E OIDC test error:', error);
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
	await run('docker', ['compose', '-f', COMPOSE_FILE, 'down']);
}

Deno.exit(exitCode);

async function startServer(port: number, envOverrides: Record<string, string>): Promise<void> {
	const basePath = `./dist/e2e-oidc-${port}`;

	console.log(`Starting server on port ${port}...`);

	// Create required directories
	await Deno.mkdir(`${basePath}/data/databases`, { recursive: true });
	await Deno.mkdir(`${basePath}/logs`, { recursive: true });
	await Deno.mkdir(`${basePath}/backups`, { recursive: true });

	const env: Record<string, string> = {
		...Deno.env.toObject(),
		PORT: String(port),
		HOST: '0.0.0.0',
		APP_BASE_PATH: basePath,
		PARSER_HOST: 'localhost',
		PARSER_PORT: '5000',
		...envOverrides
	};

	const cmd = new Deno.Command(BINARY, {
		env,
		stdout: 'piped',
		stderr: 'piped'
	});

	const process = cmd.spawn();

	// Drain streams to prevent backpressure
	drainStream(process.stdout);
	drainStream(process.stderr);

	servers.push({ process, port, basePath });

	// Wait for health
	await waitForReady(`http://localhost:${port}`, 60_000);
	console.log(`Server ready on port ${port}`);
}

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

async function run(cmd: string, args: string[]): Promise<void> {
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
