/**
 * Integration tests for Arr instance target duplicate detection.
 */

import { assert, assertEquals } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { openDb } from '$test-harness/db.ts';
import { PORTS } from '$test-harness/ports.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { getDbPath, startServer, stopServer } from '$test-harness/server.ts';

const PORT = PORTS.arr.instanceTargets;
const ORIGIN = `http://localhost:${PORT}`;

let client: TestClient;

async function createArrInstance(fields: {
	name: string;
	type: string;
	url: string;
	apiKey: string;
}): Promise<Response> {
	return client.postForm(
		'/arr/new',
		{
			name: fields.name,
			type: fields.type,
			url: fields.url,
			external_url: '',
			api_key: fields.apiKey,
			tags: '[]'
		},
		{ headers: { Origin: ORIGIN } }
	);
}

function countArrInstances(): number {
	const db = openDb(getDbPath(PORT));
	try {
		const row = db.prepare('SELECT COUNT(*) as count FROM arr_instances').get() as {
			count: number;
		};
		return row.count;
	} finally {
		db.close();
	}
}

function clearArrInstances(): void {
	const db = openDb(getDbPath(PORT));
	try {
		db.exec('DELETE FROM arr_instances');
	} finally {
		db.close();
	}
}

function disableDefaultDelayProfiles(): void {
	const db = openDb(getDbPath(PORT));
	try {
		db.exec('UPDATE general_settings SET apply_default_delay_profiles = 0 WHERE id = 1');
	} finally {
		db.close();
	}
}

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
	client = new TestClient(ORIGIN);
	disableDefaultDelayProfiles();
});

teardown(async () => {
	await stopServer(PORT);
});

test('same normalized target is blocked', async () => {
	clearArrInstances();

	const first = await createArrInstance({
		name: 'Main Radarr',
		type: 'radarr',
		url: 'http://localhost:7878',
		apiKey: 'shared-api-key'
	});
	assert(first.status < 400, `Expected first create to succeed, got ${first.status}`);
	await first.body?.cancel();

	const second = await createArrInstance({
		name: 'Duplicate Radarr',
		type: 'radarr',
		url: 'http://localhost:7878/',
		apiKey: 'different-api-key'
	});
	assertEquals(second.status, 200);
	const body = await second.text();
	assert(body.includes('"status":400'));
	assert(body.includes('This instance target is already configured'));

	assertEquals(countArrInstances(), 1);
});

test('same API key on different target is allowed', async () => {
	clearArrInstances();

	const first = await createArrInstance({
		name: 'Main Radarr',
		type: 'radarr',
		url: 'http://localhost:7878',
		apiKey: 'shared-api-key'
	});
	assert(first.status < 400, `Expected first create to succeed, got ${first.status}`);
	await first.body?.cancel();

	const second = await createArrInstance({
		name: '4K Radarr',
		type: 'radarr',
		url: 'http://localhost:7879',
		apiKey: 'shared-api-key'
	});
	assert(second.status < 400, `Expected second create to succeed, got ${second.status}`);
	await second.body?.cancel();

	assertEquals(countArrInstances(), 2);
});

test('same URL with different Arr type is allowed', async () => {
	clearArrInstances();

	const radarr = await createArrInstance({
		name: 'Main Radarr',
		type: 'radarr',
		url: 'http://localhost:7878',
		apiKey: 'radarr-key'
	});
	assert(radarr.status < 400, `Expected Radarr create to succeed, got ${radarr.status}`);
	await radarr.body?.cancel();

	const sonarr = await createArrInstance({
		name: 'Main Sonarr',
		type: 'sonarr',
		url: 'http://localhost:7878',
		apiKey: 'sonarr-key'
	});
	assert(sonarr.status < 400, `Expected Sonarr create to succeed, got ${sonarr.status}`);
	await sonarr.body?.cancel();

	assertEquals(countArrInstances(), 2);
});

await run();
