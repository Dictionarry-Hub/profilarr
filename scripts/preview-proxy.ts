/**
 * Preview script that runs caddy + parser + the compiled binary behind a local
 * reverse proxy. Lets us reproduce prod-side behaviour that doesn't run under
 * `vite dev` — most notably the adapter's URL rewrite which uses ORIGIN to
 * reconstruct request.url, and HTTPS-vs-HTTP scheme mismatches that trigger
 * SvelteKit's CSRF check.
 *
 * Accepts flags:
 *   --origin <value>   ORIGIN env passed to the binary (default: proxy origin).
 *   --no-origin        Start the binary without an ORIGIN env var.
 *   --base-url <path>  BASE_URL env passed to the binary, e.g. /profilarr. Caddy
 *                      forwards the prefix as-is, which is how it has to be
 *                      configured in production.
 *   --tls              Terminate TLS at caddy on :8443. Reproduces the
 *                      https-origin / http-upstream CSRF 403.
 *
 * Requires `deno task build` to have been run first.
 */

const CONTAINER_NAME = 'profilarr-dev-caddy';
const PROXY_HOST = 'profilarr.localhost';
const UPSTREAM_PORT = '6869';
const BINARY_PATH = './dist/build/profilarr';
const CADDY_DATA_DIR = new URL('proxy/.caddy-data', import.meta.url).pathname;

function parseArgs(argv: string[]): {
	origin: string | null;
	noOrigin: boolean;
	tls: boolean;
	baseUrl: string;
	help: boolean;
} {
	let origin: string | null = null;
	let noOrigin = false;
	let tls = false;
	let baseUrl = '';
	let help = false;
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--no-origin') noOrigin = true;
		else if (a === '--tls') tls = true;
		else if (a === '--origin') origin = argv[++i] ?? '';
		else if (a.startsWith('--origin=')) origin = a.slice('--origin='.length);
		else if (a === '--base-url') baseUrl = argv[++i] ?? '';
		else if (a.startsWith('--base-url=')) baseUrl = a.slice('--base-url='.length);
		else if (a === '-h' || a === '--help') help = true;
	}
	return { origin, noOrigin, tls, baseUrl, help };
}

const cliArgs = parseArgs(Deno.args);
const scheme = cliArgs.tls ? 'https' : 'http';
const proxyPort = cliArgs.tls ? '8443' : '8080';
const proxyOrigin = `${scheme}://${PROXY_HOST}:${proxyPort}`;

if (cliArgs.help) {
	console.log(`Usage: deno task preview:proxy [flags]

Flags:
  --origin <value>   ORIGIN env passed to the compiled binary.
                     Default: ${proxyOrigin}
                     Try "${proxyOrigin}/" to repro the trailing-slash 404 bug.
  --no-origin        Start the binary without an ORIGIN env var.
  --base-url <path>  BASE_URL env passed to the compiled binary, e.g. /profilarr.
                     Caddy forwards the prefix as-is; browse to
                     ${proxyOrigin}/profilarr to exercise it.
  --tls              Terminate TLS at caddy on :8443 with caddy's local CA.
                     Reproduces the https-origin / http-upstream CSRF 403 bug
                     when combined with --no-origin.
  -h, --help         Show this help.

Requires \`deno task build\` to have been run first.`);
	Deno.exit(0);
}

const effectiveOrigin: string | null = cliArgs.noOrigin ? null : (cliArgs.origin ?? proxyOrigin);

try {
	Deno.statSync(BINARY_PATH);
} catch {
	console.error(`error: ${BINARY_PATH} not found. Run \`deno task build\` first.`);
	Deno.exit(1);
}

const colors = {
	caddy: '\x1b[36m', // cyan
	parser: '\x1b[33m', // yellow
	server: '\x1b[34m', // blue
	reset: '\x1b[0m'
};

async function streamOutput(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	label: string,
	color: string
) {
	const decoder = new TextDecoder();
	let buffer = '';
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() ?? '';
		for (const line of lines) {
			if (line.trim()) {
				console.log(`${color}[${label}]${colors.reset} ${line}`);
			}
		}
	}
	if (buffer.trim()) {
		console.log(`${color}[${label}]${colors.reset} ${buffer}`);
	}
}

const running: Deno.ChildProcess[] = [];

function track(proc: Deno.ChildProcess): Deno.ChildProcess {
	running.push(proc);
	return proc;
}

async function stopCaddyContainer() {
	try {
		await new Deno.Command('docker', {
			args: ['stop', CONTAINER_NAME],
			stdout: 'null',
			stderr: 'null'
		}).output();
	} catch {
		// already gone
	}
}

let shuttingDown = false;
async function shutdown(code = 0) {
	if (shuttingDown) return;
	shuttingDown = true;
	for (const p of running) {
		try {
			p.kill('SIGTERM');
		} catch {
			// already exited
		}
	}
	await stopCaddyContainer();
	Deno.exit(code);
}

Deno.addSignalListener('SIGINT', () => {
	shutdown(130);
});
Deno.addSignalListener('SIGTERM', () => {
	shutdown(143);
});

async function runCaddy() {
	await new Deno.Command('docker', {
		args: ['rm', '-f', CONTAINER_NAME],
		stdout: 'null',
		stderr: 'null'
	})
		.output()
		.catch(() => {});

	const caddyfilePath = new URL('proxy/Caddyfile', import.meta.url).pathname;
	await Deno.mkdir(CADDY_DATA_DIR, { recursive: true });

	const args = [
		'run',
		'--rm',
		'--name',
		CONTAINER_NAME,
		'-p',
		'8080:8080',
		'-p',
		'8443:8443',
		'-v',
		`${caddyfilePath}:/etc/caddy/Caddyfile:ro`,
		'-v',
		`${CADDY_DATA_DIR}:/data`,
		'--add-host=host.docker.internal:host-gateway',
		'-e',
		`UPSTREAM_PORT=${UPSTREAM_PORT}`,
		'caddy:2-alpine'
	];

	const cmd = new Deno.Command('docker', { args, stdout: 'piped', stderr: 'piped' });
	const proc = track(cmd.spawn());

	await Promise.all([
		streamOutput(proc.stdout.getReader(), 'caddy', colors.caddy),
		streamOutput(proc.stderr.getReader(), 'caddy', colors.caddy)
	]);

	return proc.status;
}

async function runParser() {
	const cmd = new Deno.Command('dotnet', {
		args: ['watch', 'run', '--urls', 'http://localhost:5000'],
		cwd: 'src/services/parser',
		stdout: 'piped',
		stderr: 'piped'
	});

	const proc = track(cmd.spawn());

	await Promise.all([
		streamOutput(proc.stdout.getReader(), 'parser', colors.parser),
		streamOutput(proc.stderr.getReader(), 'parser', colors.parser)
	]);

	return proc.status;
}

async function runServer() {
	const env: Record<string, string> = {
		...Deno.env.toObject(),
		PORT: UPSTREAM_PORT,
		HOST: '0.0.0.0',
		APP_BASE_PATH: './dist/dev',
		PARSER_HOST: 'localhost',
		PARSER_PORT: '5000'
	};
	if (effectiveOrigin !== null) {
		env.ORIGIN = effectiveOrigin;
	} else {
		delete env.ORIGIN;
	}
	if (cliArgs.baseUrl) {
		env.BASE_URL = cliArgs.baseUrl;
	} else {
		delete env.BASE_URL;
	}

	const cmd = new Deno.Command(BINARY_PATH, {
		env,
		clearEnv: true,
		stdout: 'piped',
		stderr: 'piped'
	});

	const proc = track(cmd.spawn());

	await Promise.all([
		streamOutput(proc.stdout.getReader(), 'server', colors.server),
		streamOutput(proc.stderr.getReader(), 'server', colors.server)
	]);

	return proc.status;
}

console.log(
	`${colors.caddy}[caddy]${colors.reset}  Reverse proxy: ${proxyOrigin}${cliArgs.baseUrl}`
);
console.log(`${colors.parser}[parser]${colors.reset} Starting .NET parser service...`);
console.log(
	`${colors.server}[server]${colors.reset} Starting compiled binary on :${UPSTREAM_PORT} (ORIGIN=${effectiveOrigin ?? '(unset)'}, BASE_URL=${cliArgs.baseUrl || '(unset)'})...`
);
if (cliArgs.tls) {
	const certPath = `${CADDY_DATA_DIR}/caddy/pki/authorities/local/root.crt`;
	console.log('');
	console.log('  TLS mode: caddy is using a self-signed local CA.');
	console.log(`  Root cert (after first TLS connection): ${certPath}`);
	console.log('  Install it into Windows "Trusted Root Certification Authorities" to avoid');
	console.log(
		'  browser warnings. The cert persists across restarts via the bind-mounted data dir.'
	);
}
console.log('');

await Promise.all([runCaddy(), runParser(), runServer()]);
