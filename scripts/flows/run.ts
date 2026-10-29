/**
 * Run the flow test suite (tests/flows) inside the official Playwright image,
 * so nobody needs browsers installed locally.
 *
 *   deno task test:flows                  run every scenario
 *   deno task test:flows --grep "score"   run matching scenarios (any Playwright flag works)
 *   deno task test:flows --ui             Playwright UI mode at http://localhost:8080
 *   deno task test:flows --build          rebuild the app first (otherwise only when missing)
 *   deno task test:flows --online         give the container network, so @online tests run too
 *   deno task test:flows --quiet          print only the end-of-run summary, no line per test
 *   deno task test:flows --deal=2/4       run the 2nd of 4 sets of spec files split by run time, as CI shard 2 does
 *
 * FLOWS_WORKERS overrides how many scenarios run at once. FLOWS_VIDEO=1 records
 * a full-size video of every test for the trace viewer to play.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import process from 'node:process';
import { SERVICE_IMAGES } from '#flows/harness/images.ts';
import { dealSpecFiles, listSpecFiles } from '#flows/harness/specFiles.ts';

const APP_BINARY = 'dist/build/profilarr';
const FLOWS_DIR = 'tests/flows';
const CONFIG = `${FLOWS_DIR}/playwright.config.ts`;
const TIMINGS = `${FLOWS_DIR}/harness/timings.json`;
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
const quiet = args.includes('--quiet');
const deal = args.find((arg) => arg.startsWith('--deal='));
const playwrightArgs = args.filter(
	(arg) => !['--ui', '--build', '--online', '--quiet'].includes(arg) && arg !== deal
);
// The reporter reads FLOWS_QUIET, forwarded into the container below
if (quiet) process.env.FLOWS_QUIET = '1';

// --deal=n/total runs the n-th of `total` sets of spec files, split by their
// recorded run times so every set takes about as long. Each CI shard takes
// one deal. Playwright's --shard cuts even blocks by count instead.
if (deal) {
	const match = deal.match(/^--deal=(\d+)\/(\d+)$/);
	const shard = Number(match?.[1]);
	const total = Number(match?.[2]);
	if (!match || shard < 1 || shard > total) {
		console.error(`Invalid ${deal}: use --deal=n/total, with n from 1 to total`);
		process.exit(2);
	}
	// Seconds per spec file, recorded by `deno task flows:timings`
	const timings = existsSync(TIMINGS)
		? (JSON.parse(readFileSync(TIMINGS, 'utf8')) as { files: Record<string, number> }).files
		: {};
	const files = dealSpecFiles(listSpecFiles(FLOWS_DIR), shard, total, timings);
	// Playwright given no file runs the whole suite, so an empty deal is an error
	if (files.length === 0) {
		console.error(`${deal} has no spec files`);
		process.exit(2);
	}
	console.log(`Deal ${shard}/${total}: ${files.length} spec files`);
	playwrightArgs.push(...files.map((file) => `${FLOWS_DIR}/${file}`));
}

if (rebuild || !existsSync(APP_BINARY)) {
	console.log(rebuild ? 'Rebuilding the app...' : `${APP_BINARY} not found, building...`);
	const code = run('deno', ['task', 'build']);
	if (code !== 0) process.exit(code);
}

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
	'-e',
	'FLOWS_QUIET',
	'-v',
	`${process.cwd()}:/work`,
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
