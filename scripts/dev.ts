/**
 * Dev script that runs parser and server concurrently with labeled output
 */

// Auto-detect platform from Deno.build
function getPlatform(): string {
	const os = Deno.build.os === 'darwin' ? 'darwin' : Deno.build.os;
	const arch =
		Deno.build.arch === 'x86_64'
			? 'amd64'
			: Deno.build.arch === 'aarch64'
				? 'arm64'
				: Deno.build.arch;
	return `${os}/${arch}`;
}

const colors = {
	parser: '\x1b[33m', // yellow
	server: '\x1b[34m', // blue
	reset: '\x1b[0m'
};

const SERVER_PORT = 6969;
const WARM_UP_TIMEOUT_MS = 5 * 60_000;

async function streamOutput(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	label: string,
	color: string
) {
	const decoder = new TextDecoder();
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		const text = decoder.decode(value);
		for (const line of text.split('\n')) {
			if (line.trim()) {
				console.log(`${color}[${label}]${colors.reset} ${line}`);
			}
		}
	}
}

async function runParser() {
	const cmd = new Deno.Command('dotnet', {
		args: ['watch', 'run', '--urls', 'http://localhost:5000'],
		cwd: 'src/services/parser',
		stdout: 'piped',
		stderr: 'piped'
	});

	const process = cmd.spawn();

	await Promise.all([
		streamOutput(process.stdout.getReader(), 'parser', colors.parser),
		streamOutput(process.stderr.getReader(), 'parser', colors.parser)
	]);

	return process.status;
}

async function runServer() {
	const cmd = new Deno.Command('deno', {
		args: ['run', '-A', 'vite', 'dev'],
		env: {
			...Deno.env.toObject(),
			DENO_ENV: 'development',
			PORT: String(SERVER_PORT),
			HOST: '0.0.0.0',
			APP_BASE_PATH: './dist/dev',
			PARSER_HOST: 'localhost',
			PARSER_PORT: '5000',
			VITE_PLATFORM: getPlatform(),
			VITE_CHANNEL: 'dev'
		},
		stdout: 'piped',
		stderr: 'piped'
	});

	const process = cmd.spawn();

	await Promise.all([
		streamOutput(process.stdout.getReader(), 'server', colors.server),
		streamOutput(process.stderr.getReader(), 'server', colors.server)
	]);

	return process.status;
}

/**
 * SvelteKit only runs hooks.server.ts (migrations, PCD caches, job queue) on
 * the first request, so request the app as soon as Vite is listening. The
 * redirect to the login or setup page is followed so that page is compiled too.
 */
async function warmUp() {
	const start = performance.now();
	const label = `${colors.server}[server]${colors.reset}`;

	while (performance.now() - start < WARM_UP_TIMEOUT_MS) {
		try {
			const response = await fetch(`http://localhost:${SERVER_PORT}/`);
			await response.body?.cancel();
			const seconds = ((performance.now() - start) / 1000).toFixed(1);
			const path = new URL(response.url).pathname;
			console.log(`${label} Warmed up in ${seconds}s (${response.status} ${path})`);
			return;
		} catch {
			// Vite isn't listening yet
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}

	console.log(`${label} Warm-up timed out; the app will start on the first page load`);
}

console.log(`${colors.parser}[parser]${colors.reset} Starting .NET parser service...`);
console.log(`${colors.server}[server]${colors.reset} Starting Vite dev server...`);
console.log('');

await Promise.all([runParser(), runServer(), warmUp()]);
