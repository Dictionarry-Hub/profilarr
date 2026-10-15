/**
 * Integration tests for Arr version detection.
 *
 * A fake Arr answers system/status and the unversioned /api route. Creating
 * an instance that points at it records what it reported; an instance that
 * points at nothing is still created, with nothing recorded; the Test button
 * updates the stored result for an existing instance.
 */

import { assertEquals } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { openDb } from '$test-harness/db.ts';
import { PORTS } from '$test-harness/ports.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { getDbPath, startServer, stopServer } from '$test-harness/server.ts';

const PORT = PORTS.arr.versionDetection;
const ORIGIN = `http://localhost:${PORT}`;
const FAKE_PORT = PORTS.arr.versionDetectionFakeArr;
const FAKE_URL = `http://localhost:${FAKE_PORT}`;
const FAKE_KEY = 'fake-sonarr-key';

let client: TestClient;
let fakeArr: Deno.HttpServer;

/** What the fake Arr claims to be; tests switch it between v5 and v4. */
let fake = { version: '5.0.0.2569', current: 'v5', deprecated: ['v3'] };

function startFakeArr(): Deno.HttpServer {
	return Deno.serve({ port: FAKE_PORT, onListen: () => {} }, (req) => {
		const path = new URL(req.url).pathname;
		if (req.headers.get('x-api-key') !== FAKE_KEY) {
			return new Response(null, { status: 401 });
		}
		if (path === '/api/v3/system/status') {
			return Response.json({ appName: 'Sonarr', version: fake.version, osName: 'alpine' });
		}
		if (path === '/api') {
			return Response.json({ current: fake.current, deprecated: fake.deprecated });
		}
		return new Response(null, { status: 404 });
	});
}

async function createArrInstance(name: string, url: string, apiKey: string): Promise<Response> {
	return client.postForm(
		'/arr/new',
		{ name, type: 'sonarr', url, external_url: '', api_key: apiKey, tags: '[]' },
		{ headers: { Origin: ORIGIN } }
	);
}

function readInstance(name: string) {
	const db = openDb(getDbPath(PORT));
	try {
		return db
			.prepare(
				'SELECT id, detected_version, detected_api, detected_at FROM arr_instances WHERE name = ?'
			)
			.get(name) as
			| { id: number; detected_version: string | null; detected_api: string | null; detected_at: string | null }
			| undefined;
	} finally {
		db.close();
	}
}

setup(async () => {
	fakeArr = startFakeArr();
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
	client = new TestClient(ORIGIN);
	const db = openDb(getDbPath(PORT));
	try {
		db.exec('UPDATE general_settings SET apply_default_delay_profiles = 0');
	} finally {
		db.close();
	}
});

teardown(async () => {
	await stopServer(PORT);
	await fakeArr.shutdown();
});

test('creating an instance records what it reports', async () => {
	const res = await createArrInstance('Sonarr v5', FAKE_URL, FAKE_KEY);
	assertEquals(res.status, 200);

	const row = readInstance('Sonarr v5');
	assertEquals(row?.detected_version, '5.0.0.2569');
	assertEquals(row?.detected_api, 'v5');
	assertEquals(typeof row?.detected_at, 'string');
});

test('an unreachable instance is still created with nothing recorded', async () => {
	const res = await createArrInstance('Sonarr offline', 'http://localhost:7999', 'any-key');
	assertEquals(res.status, 200);

	const row = readInstance('Sonarr offline');
	assertEquals(row?.detected_version, null);
	assertEquals(row?.detected_api, null);
	assertEquals(row?.detected_at, null);
});

test('the Test button updates the stored result for an existing instance', async () => {
	const before = readInstance('Sonarr v5')!;
	fake = { version: '4.0.20.3014', current: 'v3', deprecated: [] };

	const res = await client.post(
		'/arr/validate',
		{ type: 'sonarr', url: FAKE_URL, apiKey: FAKE_KEY, instanceId: before.id },
		{ headers: { Origin: ORIGIN } }
	);
	assertEquals(res.status, 200);
	const body = await res.json();
	assertEquals(body.success, true);
	assertEquals(body.appName, 'Sonarr');
	assertEquals(body.version, '4.0.20.3014');
	assertEquals(body.api, 'v3');

	const after = readInstance('Sonarr v5');
	assertEquals(after?.detected_version, '4.0.20.3014');
	assertEquals(after?.detected_api, 'v3');
});

test('the Test button without an instance id stores nothing', async () => {
	fake = { version: '5.0.0.2569', current: 'v5', deprecated: ['v3'] };
	const res = await client.post(
		'/arr/validate',
		{ type: 'sonarr', url: FAKE_URL, apiKey: FAKE_KEY },
		{ headers: { Origin: ORIGIN } }
	);
	assertEquals(res.status, 200);
	assertEquals((await res.json()).version, '5.0.0.2569');

	const row = readInstance('Sonarr v5');
	assertEquals(row?.detected_version, '4.0.20.3014');
});

await run();
