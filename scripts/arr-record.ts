/**
 * Record a fresh Radarr and Sonarr's API responses for the flow suite's fake
 * Arrs (tests/flows/helpers/fakeArr.ts).
 *
 * Starts each app's LinuxServer image in Docker, reads the API key the
 * container generates, saves the GET responses the fake serves as its
 * starting state to tests/flows/data/arr/<app>/, then removes the container.
 * Nothing here touches a real Arr instance. Rerun after Radarr or Sonarr
 * change their API:
 *
 *   deno task fixtures:arr
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const OUT_DIR = 'tests/flows/data/arr';
const READY_TIMEOUT_MS = 120_000;

interface App {
	name: 'radarr' | 'sonarr';
	image: string;
	port: number;
	/** API paths to record, relative to /api/v3 unless they start with / */
	endpoints: string[];
}

const SHARED = [
	'system/status',
	'qualityprofile',
	'qualityprofile/schema',
	'customformat',
	'delayprofile',
	'qualitydefinition',
	'config/naming',
	'config/mediamanagement',
	'tag',
	'health',
	'/api'
];

const APPS: App[] = [
	{ name: 'radarr', image: 'lscr.io/linuxserver/radarr:latest', port: 7878, endpoints: SHARED },
	{ name: 'sonarr', image: 'lscr.io/linuxserver/sonarr:latest', port: 8989, endpoints: SHARED }
];

function docker(args: string[]): string {
	const result = spawnSync('docker', args, { encoding: 'utf8' });
	if (result.status !== 0) throw new Error(`docker ${args.join(' ')} failed:\n${result.stderr}`);
	return result.stdout.trim();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The API key a fresh container writes to its config.xml on first start */
async function readApiKey(container: string): Promise<string> {
	const deadline = Date.now() + READY_TIMEOUT_MS;
	while (Date.now() < deadline) {
		const result = spawnSync('docker', ['exec', container, 'cat', '/config/config.xml'], {
			encoding: 'utf8'
		});
		const key = result.stdout?.match(/<ApiKey>([^<]+)<\/ApiKey>/)?.[1];
		if (key) return key;
		await sleep(1000);
	}
	throw new Error(`${container} never wrote an API key`);
}

async function waitForApi(baseUrl: string, apiKey: string): Promise<void> {
	const deadline = Date.now() + READY_TIMEOUT_MS;
	while (Date.now() < deadline) {
		try {
			const response = await fetch(`${baseUrl}/api/v3/system/status`, {
				headers: { 'X-Api-Key': apiKey }
			});
			if (response.ok) return;
		} catch {
			// Not listening yet
		}
		await sleep(1000);
	}
	throw new Error(`${baseUrl} never answered`);
}

/** File name for an endpoint: qualityprofile/schema -> qualityprofile.schema.json */
function fileName(endpoint: string): string {
	const trimmed = endpoint.replace(/^\//, '');
	return `${trimmed.replaceAll('/', '.') || 'root'}.json`;
}

async function record(app: App): Promise<{ image: string; version: string }> {
	console.log(`${app.name}: starting ${app.image}`);
	const container = docker([
		'run',
		'--detach',
		'--rm',
		'--publish',
		`127.0.0.1::${app.port}`,
		'--env',
		'PUID=1000',
		'--env',
		'PGID=1000',
		'--env',
		'TZ=Etc/UTC',
		app.image
	]);

	try {
		const hostPort = docker(['port', container, String(app.port)])
			.split(':')
			.pop();
		const baseUrl = `http://127.0.0.1:${hostPort}`;
		const apiKey = await readApiKey(container);
		await waitForApi(baseUrl, apiKey);

		const dir = join(OUT_DIR, app.name);
		await fs.rm(dir, { recursive: true, force: true });
		await fs.mkdir(dir, { recursive: true });

		let version = 'unknown';
		for (const endpoint of app.endpoints) {
			const path = endpoint.startsWith('/') ? endpoint : `/api/v3/${endpoint}`;
			const response = await fetch(`${baseUrl}${path}`, { headers: { 'X-Api-Key': apiKey } });
			if (!response.ok) {
				console.log(`${app.name}: skipped ${path} (${response.status})`);
				continue;
			}
			const body = await response.json();
			if (endpoint === 'system/status') version = body.version;
			await fs.writeFile(join(dir, fileName(endpoint)), `${JSON.stringify(body, null, '\t')}\n`);
			console.log(`${app.name}: saved ${path}`);
		}

		const digest = docker(['inspect', '--format', '{{.Image}}', container]);
		return { image: `${app.image}@${digest}`, version };
	} finally {
		spawnSync('docker', ['stop', container], { stdio: 'ignore' });
	}
}

const source: Record<string, { image: string; version: string; recordedAt: string }> = {};
for (const app of APPS) {
	const result = await record(app);
	source[app.name] = { ...result, recordedAt: new Date().toISOString() };
}
await fs.writeFile(join(OUT_DIR, 'source.json'), `${JSON.stringify(source, null, '\t')}\n`);

const status = spawnSync('git', ['status', '--short', '--', OUT_DIR], { encoding: 'utf8' });
console.log(status.stdout.trim() || 'No changes.');
process.exit(0);
