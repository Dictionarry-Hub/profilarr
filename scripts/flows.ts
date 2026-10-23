/**
 * Run the flow test suite (tests/flows) inside the official Playwright image,
 * so nobody needs browsers installed locally.
 *
 *   deno task flows                  run every scenario
 *   deno task flows --grep "score"   run matching scenarios (any Playwright flag works)
 *   deno task flows --ui             Playwright UI mode at http://localhost:8080
 *   deno task flows --build          rebuild the app first (otherwise only when missing)
 *
 * FLOWS_WORKERS overrides how many scenarios run at once.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';

const APP_BINARY = 'dist/build/profilarr';
const CONFIG = 'tests/flows/playwright.config.ts';
const UI_PORT = 8080;

function run(command: string, args: string[]): number {
	const result = spawnSync(command, args, { stdio: 'inherit' });
	if (result.error) throw result.error;
	return result.status ?? 1;
}

const args = process.argv.slice(2);
const ui = args.includes('--ui');
const rebuild = args.includes('--build');
const playwrightArgs = args.filter((arg) => arg !== '--ui' && arg !== '--build');

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
	'-v',
	`${process.cwd()}:/work`,
	'-v',
	`${PLUG_CACHE}:/tmp/.cache/deno/plug:ro`,
	'-w',
	'/work'
];
// No network, so nothing reaches GitHub or anything else outside. UI mode
// keeps it because the browser connects to the published port.
if (ui) docker.push('-p', `${UI_PORT}:${UI_PORT}`, '-e', 'FLOWS_UI=1');
else docker.push('--network', 'none');
if (process.stdout.isTTY) docker.push('-t');

const playwright = ['node', 'node_modules/playwright/cli.js', 'test', '-c', CONFIG];
if (ui) {
	playwright.push('--ui-host=0.0.0.0', `--ui-port=${UI_PORT}`);
	console.log(`UI mode: open http://localhost:${UI_PORT}`);
}

process.exit(run('docker', [...docker, image, ...playwright, ...playwrightArgs]));
