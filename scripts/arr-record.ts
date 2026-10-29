/**
 * Record fresh API responses for the flow suite's fake targets
 * (tests/flows/helpers/sync/targets.ts and fakeArr.ts).
 *
 * For each target, starts its image in Docker, reads the API key the
 * container generates, saves the GET responses the fake serves as its
 * starting state to tests/flows/data/arr/<target id>/, then removes the
 * container. Nothing here touches a real Arr instance. Rerun after an app
 * changes its API, or to add a new target:
 *
 *   deno task fixtures:arr              every target
 *   deno task fixtures:arr sonarr-5     only the targets named
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import {
	TARGETS,
	recordingName,
	target as findTarget,
	type Target
} from '#flows/helpers/sync/targets.ts';

const OUT_DIR = 'tests/flows/data/arr';
const SOURCE_FILE = join(OUT_DIR, 'source.json');
const READY_TIMEOUT_MS = 120_000;

function docker(args: string[]): string {
	const result = spawnSync('docker', args, { encoding: 'utf8' });
	if (result.status !== 0) throw new Error(`docker ${args.join(' ')} failed:\n${result.stderr}`);
	return result.stdout.trim();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A path relative to the target's API base, unless it starts with / */
function apiPath(entry: Target, path: string): string {
	return path.startsWith('/') ? path : `${entry.apiBase}/${path}`;
}

/** The API key a fresh container writes on first start */
async function readApiKey(entry: Target, container: string): Promise<string> {
	const deadline = Date.now() + READY_TIMEOUT_MS;
	while (Date.now() < deadline) {
		const result = spawnSync('docker', ['exec', container, 'cat', entry.apiKeyFrom.file], {
			encoding: 'utf8'
		});
		const key = result.stdout?.match(entry.apiKeyFrom.pattern)?.[1];
		if (key) return key;
		await sleep(1000);
	}
	throw new Error(`${container} never wrote an API key`);
}

async function waitForApi(entry: Target, baseUrl: string, apiKey: string): Promise<void> {
	const deadline = Date.now() + READY_TIMEOUT_MS;
	while (Date.now() < deadline) {
		try {
			const response = await fetch(`${baseUrl}${apiPath(entry, entry.ready)}`, {
				headers: { [entry.auth.header]: apiKey }
			});
			if (response.ok) return;
		} catch {
			// Not listening yet
		}
		await sleep(1000);
	}
	throw new Error(`${baseUrl} never answered`);
}

async function record(entry: Target): Promise<{ image: string; version: string }> {
	console.log(`${entry.id}: starting ${entry.image}`);
	const container = docker([
		'run',
		'--detach',
		'--rm',
		'--publish',
		`127.0.0.1::${entry.port}`,
		'--env',
		'PUID=1000',
		'--env',
		'PGID=1000',
		'--env',
		'TZ=Etc/UTC',
		entry.image
	]);

	try {
		const hostPort = docker(['port', container, String(entry.port)])
			.split(':')
			.pop();
		const baseUrl = `http://127.0.0.1:${hostPort}`;
		const apiKey = await readApiKey(entry, container);
		await waitForApi(entry, baseUrl, apiKey);

		const dir = join(OUT_DIR, entry.id);
		await fs.rm(dir, { recursive: true, force: true });
		await fs.mkdir(dir, { recursive: true });

		let version = 'unknown';
		for (const endpoint of entry.record) {
			const path = apiPath(entry, endpoint);
			const response = await fetch(`${baseUrl}${path}`, {
				headers: { [entry.auth.header]: apiKey }
			});
			if (!response.ok) {
				console.log(`${entry.id}: skipped ${path} (${response.status})`);
				continue;
			}
			const body = await response.json();
			if (endpoint === entry.ready && typeof body?.version === 'string') version = body.version;
			await fs.writeFile(
				join(dir, recordingName(endpoint)),
				`${JSON.stringify(body, null, '\t')}\n`
			);
			console.log(`${entry.id}: saved ${path}`);
		}

		// The id promises a major version; a moving image tag could have moved past it
		if (!version.startsWith(`${entry.major}.`)) {
			throw new Error(
				`${entry.id} expects version ${entry.major}.x, but ${entry.image} reports ${version}`
			);
		}

		const digest = docker(['inspect', '--format', '{{.Image}}', container]);
		return { image: `${entry.image}@${digest}`, version };
	} finally {
		spawnSync('docker', ['stop', container], { stdio: 'ignore' });
	}
}

if (import.meta.main) {
	const ids = process.argv.slice(2);
	const targets = ids.length > 0 ? ids.map(findTarget) : TARGETS;

	// Keep the entries of targets this run doesn't record
	let source: Record<string, { image: string; version: string; recordedAt: string }> = {};
	try {
		source = JSON.parse(await fs.readFile(SOURCE_FILE, 'utf8'));
	} catch {
		// First recording
	}
	for (const entry of targets) {
		const result = await record(entry);
		source[entry.id] = { ...result, recordedAt: new Date().toISOString() };
	}
	const sorted = Object.fromEntries(Object.entries(source).sort(([a], [b]) => a.localeCompare(b)));
	await fs.writeFile(SOURCE_FILE, `${JSON.stringify(sorted, null, '\t')}\n`);

	const status = spawnSync('git', ['status', '--short', '--', OUT_DIR], { encoding: 'utf8' });
	console.log(status.stdout.trim() || 'No changes.');
	process.exit(0);
}
