/**
 * Integration tests for Arr instance target duplicate detection.
 */

import { afterAll, beforeAll, expect, test } from 'vitest';
import { TestClient } from '#integration/harness/client.ts';
import { openDb } from '#integration/harness/db.ts';
import { PORTS } from '#integration/harness/ports.ts';
import { getDbPath, startServer, stopServer } from '#integration/harness/server.ts';

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

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
	client = new TestClient(ORIGIN);
	disableDefaultDelayProfiles();
});

afterAll(async () => {
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
	expect(first.status < 400, `Expected first create to succeed, got ${first.status}`).toBeTruthy();
	await first.body?.cancel();

	const second = await createArrInstance({
		name: 'Duplicate Radarr',
		type: 'radarr',
		url: 'http://localhost:7878/',
		apiKey: 'different-api-key'
	});
	expect(second.status).toStrictEqual(400);
	const body = await second.text();
	expect(body.includes('"status":400')).toBeTruthy();
	expect(body.includes('This instance target is already configured')).toBeTruthy();

	expect(countArrInstances()).toStrictEqual(1);
});

test('same API key on different target is allowed', async () => {
	clearArrInstances();

	const first = await createArrInstance({
		name: 'Main Radarr',
		type: 'radarr',
		url: 'http://localhost:7878',
		apiKey: 'shared-api-key'
	});
	expect(first.status < 400, `Expected first create to succeed, got ${first.status}`).toBeTruthy();
	await first.body?.cancel();

	const second = await createArrInstance({
		name: '4K Radarr',
		type: 'radarr',
		url: 'http://localhost:7879',
		apiKey: 'shared-api-key'
	});
	expect(
		second.status < 400,
		`Expected second create to succeed, got ${second.status}`
	).toBeTruthy();
	await second.body?.cancel();

	expect(countArrInstances()).toStrictEqual(2);
});

test('same URL with different Arr type is allowed', async () => {
	clearArrInstances();

	const radarr = await createArrInstance({
		name: 'Main Radarr',
		type: 'radarr',
		url: 'http://localhost:7878',
		apiKey: 'radarr-key'
	});
	expect(
		radarr.status < 400,
		`Expected Radarr create to succeed, got ${radarr.status}`
	).toBeTruthy();
	await radarr.body?.cancel();

	const sonarr = await createArrInstance({
		name: 'Main Sonarr',
		type: 'sonarr',
		url: 'http://localhost:7878',
		apiKey: 'sonarr-key'
	});
	expect(
		sonarr.status < 400,
		`Expected Sonarr create to succeed, got ${sonarr.status}`
	).toBeTruthy();
	await sonarr.body?.cancel();

	expect(countArrInstances()).toStrictEqual(2);
});
