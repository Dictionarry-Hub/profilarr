/**
 * Run the flow test suite (tests/flows) inside the official Playwright image,
 * so nobody needs browsers installed locally.
 *
 *   deno task flows                  run every scenario
 *   deno task flows --grep "score"   run matching scenarios (any Playwright flag works)
 *   deno task flows --ui             Playwright UI mode at http://localhost:8080
 *   deno task flows --build          rebuild the app first (otherwise only when missing)
 *   deno task flows --online         give the container network, so @online tests run too
 *
 * FLOWS_WORKERS overrides how many scenarios run at once. FLOWS_VIDEO=1 records
 * a full-size video of every test for the trace viewer to play.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import process from 'node:process';
import { SERVICE_IMAGES } from '$flows/harness/images.ts';

const APP_BINARY = 'dist/build/profilarr';
const CONFIG = 'tests/flows/playwright.config.ts';
const UI_PORT = 8080;
const DOCKER_SOCKET = '/var/run/docker.sock';

function run(command: string, args: string[]): number {
	const result = spawnSync(command, args, { stdio: 'inherit' });
	if (result.error) throw result.error;
	return result.status ?? 1;
}

const args = process.argv.slice(2);
const ui = args.includes('--ui');
const rebuild = args.includes('--build');
const online = args.includes('--online');
const playwrightArgs = args.filter((arg) => !['--ui', '--build', '--online'].includes(arg));

if (rebuild || !existsSync(APP_BINARY)) {
	console.log(rebuild ? 'Rebuilding the app...' : `${APP_BINARY} not found, building...`);
	const code = run('deno', ['task', 'build']);
	if (code !== 0) process.exit(code);
}

// The app loads SQLite and bcrypt from libraries it downloads on first use.
// Tests run offline, so fetch them here into Deno's cache (a no-op once
// cached) and mount that cache into the container. CI does the same.
const PLUG_CACHE = `${process.env.HOME}/.cache/deno/plug`;
const warmup = run('deno', [
	'eval',
	'--ext=ts',
	`import { hash } from '@felix/bcrypt';
	import { Database } from '@db/sqlite';
	await hash('warmup');
	new Database(':memory:').close();`
]);
if (warmup !== 0) process.exit(warmup);

// The image's browsers must match the installed Playwright exactly
const { version } = JSON.parse(readFileSync('node_modules/@playwright/test/package.json', 'utf8'));
const image = `mcr.microsoft.com/playwright:v${version}-noble`;

const docker = [
	'run',
	'--rm',
	'--init',
	'--ipc=host',
	// Run as the host user so test-results/ isn't owned by root
	'--user',
	`${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
	'-e',
	'HOME=/tmp',
	'-e',
	'CI',
	'-e',
	'FLOWS_WORKERS',
	'-e',
	'FLOWS_UI',
	'-e',
	'FLOWS_VIDEO',
	'-v',
	`${process.cwd()}:/work`,
	'-v',
	`${PLUG_CACHE}:/tmp/.cache/deno/plug:ro`,
	'-w',
	'/work'
];
// No network, so nothing reaches GitHub or anything else outside. UI mode
// keeps it because the browser connects to the published port. `--online`
// keeps it too, and tells the tests tagged @online, which reach GitHub, to
// run instead of skipping. Every other test stays local either way: the app's
// gitconfig rewrites the fixtures GitHub URL (tests/flows/harness/seed.ts).
// Real services, such as Traefik, run as sibling containers in this
// container's network namespace (tests/flows/harness/docker.ts). They need the
// Docker socket, and their images up front, since the test container has no
// network. Images already present aren't pulled again, so offline runs work.
if (existsSync(DOCKER_SOCKET)) {
	for (const serviceImage of Object.values(SERVICE_IMAGES)) {
		const present = spawnSync('docker', ['image', 'inspect', serviceImage], { stdio: 'ignore' });
		if (present.status === 0) continue;
		const code = run('docker', ['pull', '--quiet', serviceImage]);
		if (code !== 0) process.exit(code);
	}
	docker.push(
		'-v',
		`${DOCKER_SOCKET}:${DOCKER_SOCKET}`,
		'--group-add',
		String(statSync(DOCKER_SOCKET).gid),
		'-e',
		'FLOWS_DOCKER=1',
		'-e',
		`FLOWS_HOST_ROOT=${process.cwd()}`
	);
} else {
	console.log(`No Docker socket at ${DOCKER_SOCKET}; tests tagged @docker will be skipped`);
}
if (ui) docker.push('-p', `${UI_PORT}:${UI_PORT}`, '-e', 'FLOWS_UI=1');
if (online) docker.push('-e', 'FLOWS_ONLINE=1');
else if (!ui) docker.push('--network', 'none');
if (process.stdout.isTTY) docker.push('-t');

const playwright = ['node', 'node_modules/playwright/cli.js', 'test', '-c', CONFIG];
if (ui) {
	playwright.push('--ui-host=0.0.0.0', `--ui-port=${UI_PORT}`);
	console.log(`UI mode: open http://localhost:${UI_PORT}`);
}

process.exit(run('docker', [...docker, image, ...playwright, ...playwrightArgs]));
