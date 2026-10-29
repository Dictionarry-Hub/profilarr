/**
 * Dev script that runs parser and server concurrently with labeled output.
 *
 * Flags set environment variables for the app server: `--name value` or
 * `--name=value` sets NAME, with dashes as underscores.
 *
 *   deno task dev --auth off
 *   deno task dev --origin http://192.168.1.10:6969
 *   deno task dev --profilarr-bulletin-url http://localhost:6970
 */

import { spawn } from 'node:child_process';
import process from 'node:process';
import type { Readable } from 'node:stream';

// Auto-detect platform, in the os/arch form the app's VITE_PLATFORM uses
function getPlatform(): string {
	const os = process.platform === 'win32' ? 'windows' : process.platform;
	const arch = process.arch === 'x64' ? 'amd64' : process.arch;
	return `${os}/${arch}`;
}

const colors = {
	parser: '\x1b[33m', // yellow
	server: '\x1b[34m', // blue
	reset: '\x1b[0m'
};

const WARM_UP_TIMEOUT_MS = 5 * 60_000;

/** `--auth off` and `--auth=off` both become { AUTH: 'off' }. */
function parseEnvFlags(argv: string[]): Record<string, string> {
	const env: Record<string, string> = {};
	for (let i = 0; i < argv.length; i++) {
		const match = /^--([a-z][a-z0-9-]*)(?:=(.*))?$/i.exec(argv[i]);
		const value = match?.[2] ?? argv[i + 1];
		if (!match || value === undefined || (match[2] === undefined && value.startsWith('--'))) {
			console.error(`Expected --name value or --name=value, got: ${argv[i]}`);
			process.exit(1);
		}
		if (match[2] === undefined) i++;
		env[match[1].toUpperCase().replaceAll('-', '_')] = value;
	}
	return env;
}

const overrides = parseEnvFlags(process.argv.slice(2));
const serverEnv: NodeJS.ProcessEnv = {
	...process.env,
	DENO_ENV: 'development',
	PORT: '6969',
	HOST: '0.0.0.0',
	APP_BASE_PATH: './dist/dev',
	PARSER_HOST: 'localhost',
	PARSER_PORT: '5000',
	VITE_PLATFORM: getPlatform(),
	VITE_CHANNEL: 'dev',
	...overrides
};
const SERVER_PORT = Number(serverEnv.PORT);

async function streamOutput(stream: Readable, label: string, color: string) {
	const decoder = new TextDecoder();
	for await (const chunk of stream) {
		const text = decoder.decode(chunk, { stream: true });
		for (const line of text.split('\n')) {
			if (line.trim()) {
				console.log(`${color}[${label}]${colors.reset} ${line}`);
			}
		}
	}
}

/** Starts a child with stdin from this terminal and labelled output; resolves with its exit code. */
async function runLabelled(
	command: string,
	args: string[],
	label: 'parser' | 'server',
	options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
) {
	const child = spawn(command, args, { ...options, stdio: ['inherit', 'pipe', 'pipe'] });
	const exit = new Promise<number | null>((resolve) => child.on('close', resolve));

	await Promise.all([
		streamOutput(child.stdout, label, colors[label]),
		streamOutput(child.stderr, label, colors[label])
	]);

	return exit;
}

function runParser() {
	return runLabelled('dotnet', ['watch', 'run', '--urls', 'http://localhost:5000'], 'parser', {
		cwd: 'src/services/parser'
	});
}

function runServer() {
	return runLabelled('deno', ['run', '-A', 'vite', 'dev'], 'server', { env: serverEnv });
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
for (const [name, value] of Object.entries(overrides)) {
	console.log(`${colors.server}[server]${colors.reset} ${name}=${value}`);
}
console.log('');

await Promise.all([runParser(), runServer(), warmUp()]);
