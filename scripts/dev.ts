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
		args: ['run', '-A', 'npm:vite', 'dev'],
		env: {
			...Deno.env.toObject(),
			DENO_ENV: 'development',
			PORT: '6969',
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

console.log(`${colors.parser}[parser]${colors.reset} Starting .NET parser service...`);
console.log(`${colors.server}[server]${colors.reset} Starting Vite dev server...`);
console.log('');

await Promise.all([runParser(), runServer()]);
