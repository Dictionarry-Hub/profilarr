/**
 * Integration tests for Arr instances behind a Basic Auth reverse proxy.
 *
 * A fake Sonarr stands in for a proxy and the Arr behind it: it rejects any
 * request without the expected Basic Auth header, then checks the API key.
 * Every path that talks to the instance has to send both.
 */

import { assertEquals } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { openDb } from '$test-harness/db.ts';
import { PORTS } from '$test-harness/ports.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { getDbPath, startServer, stopServer } from '$test-harness/server.ts';
import { formResult } from '$test-harness/setup.ts';

const PORT = PORTS.arr.basicAuth;
const ORIGIN = `http://localhost:${PORT}`;
const FAKE_PORT = PORTS.arr.basicAuthFakeArr;
const FAKE_URL = `http://localhost:${FAKE_PORT}`;
const FAKE_KEY = 'fake-sonarr-key';
const PROXY_USER = 'proxy-user';
const PROXY_PASSWORD = 'proxy-password';
const FAKE_VERSION = '4.0.20.3014';

let client: TestClient;
let fakeArr: Deno.HttpServer;

function startFakeArr(): Deno.HttpServer {
	const expected = `Basic ${btoa(`${PROXY_USER}:${PROXY_PASSWORD}`)}`;
	return Deno.serve({ port: FAKE_PORT, onListen: () => {} }, (req) => {
		if (req.headers.get('authorization') !== expected) {
			return new Response(null, {
				status: 401,
				headers: { 'WWW-Authenticate': 'Basic realm="proxy"' }
			});
		}
		if (req.headers.get('x-api-key') !== FAKE_KEY) {
			return new Response(null, { status: 401 });
		}
		const path = new URL(req.url).pathname;
		if (path === '/api/v3/system/status') {
			return Response.json({
				appName: 'Sonarr',
				version: FAKE_VERSION,
				osName: 'alpine'
			});
		}
		if (path === '/api') {
			return Response.json({ current: 'v3', deprecated: [] });
		}
		if (path === '/api/v3/log') {
			return Response.json({
				page: 1,
				pageSize: 50,
				totalRecords: 1,
				records: [
					{
						id: 1,
						time: '2026-10-18T00:00:00Z',
						level: 'info',
						logger: 'Test',
						message: 'hello'
					}
				]
			});
		}
		return new Response(null, { status: 404 });
	});
}

async function createInstance(name: string, fields: Record<string, string>) {
	const res = await client.postForm(
		'/arr/new',
		{
			name,
			type: 'sonarr',
			url: FAKE_URL,
			external_url: '',
			api_key: FAKE_KEY,
			tags: '[]',
			...fields
		},
		{ headers: { Origin: ORIGIN } }
	);
	return await formResult(res);
}

async function updateInstance(id: number, name: string, fields: Record<string, string>) {
	const res = await client.postForm(
		`/arr/${id}/settings?/update`,
		{
			name,
			type: 'sonarr',
			url: FAKE_URL,
			external_url: '',
			api_key: '',
			tags: '[]',
			library_refresh_interval: '0',
			basic_auth_username: '',
			basic_auth_password: '',
			basic_auth_username_touched: '0',
			basic_auth_password_touched: '0',
			...fields
		},
		{ headers: { Origin: ORIGIN } }
	);
	return await formResult(res);
}

function readInstance(name: string) {
	const db = openDb(getDbPath(PORT));
	try {
		return db
			.prepare(
				'SELECT id, detected_version, basic_auth_username, basic_auth_password FROM arr_instances WHERE name = ?'
			)
			.get(name) as
			| {
					id: number;
					detected_version: string | null;
					basic_auth_username: string | null;
					basic_auth_password: string | null;
			  }
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

test('Test Connection succeeds with Basic Auth', async () => {
	const res = await client.post(
		'/arr/validate',
		{
			type: 'sonarr',
			url: FAKE_URL,
			apiKey: FAKE_KEY,
			basicAuthUsername: PROXY_USER,
			basicAuthPassword: PROXY_PASSWORD
		},
		{ headers: { Origin: ORIGIN } }
	);
	assertEquals(res.status, 200);
	assertEquals((await res.json()).version, FAKE_VERSION);
});

test('Test Connection fails without Basic Auth', async () => {
	const res = await client.post(
		'/arr/validate',
		{ type: 'sonarr', url: FAKE_URL, apiKey: FAKE_KEY },
		{ headers: { Origin: ORIGIN } }
	);
	assertEquals(res.status, 400);
	assertEquals((await res.json()).success, false);
});

test('creating an instance stores the credentials and records its version', async () => {
	const res = await client.postForm(
		'/arr/new',
		{
			name: 'Proxied Sonarr',
			type: 'sonarr',
			url: FAKE_URL,
			external_url: '',
			api_key: FAKE_KEY,
			basic_auth_username: PROXY_USER,
			basic_auth_password: PROXY_PASSWORD,
			tags: '[]'
		},
		{ headers: { Origin: ORIGIN } }
	);
	assertEquals(res.status, 200);

	const row = readInstance('Proxied Sonarr');
	assertEquals(row?.basic_auth_username, PROXY_USER);
	assertEquals(row?.basic_auth_password, PROXY_PASSWORD);
	assertEquals(row?.detected_version, FAKE_VERSION);
});

test('logs load through Basic Auth', async () => {
	const row = readInstance('Proxied Sonarr')!;
	const res = await client.get(`/arr/${row.id}/logs`);
	assertEquals(res.status, 200);
	const body = await res.json();
	assertEquals(body.records[0].message, 'hello');
});

test('creating an instance rejects a password without a username', async () => {
	const result = await createInstance('Password Only', {
		url: 'http://password-only.invalid',
		basic_auth_password: PROXY_PASSWORD
	});
	assertEquals(result.status, 400);
	assertEquals(readInstance('Password Only'), undefined);
});

test('creating an instance rejects a username without a password', async () => {
	const result = await createInstance('Username Only', {
		url: 'http://username-only.invalid',
		basic_auth_username: PROXY_USER
	});
	assertEquals(result.status, 400);
	assertEquals(readInstance('Username Only'), undefined);
});

test('editing rejects clearing only the username', async () => {
	const row = readInstance('Proxied Sonarr')!;
	const result = await updateInstance(row.id, 'Proxied Sonarr', {
		basic_auth_username_touched: '1'
	});
	assertEquals(result.status, 400);

	const after = readInstance('Proxied Sonarr');
	assertEquals(after?.basic_auth_username, PROXY_USER);
	assertEquals(after?.basic_auth_password, PROXY_PASSWORD);
});

test('editing only the password keeps the saved username', async () => {
	const row = readInstance('Proxied Sonarr')!;
	const result = await updateInstance(row.id, 'Proxied Sonarr', {
		basic_auth_password: 'new-proxy-password',
		basic_auth_password_touched: '1'
	});
	assertEquals(result.status, 200);

	const after = readInstance('Proxied Sonarr');
	assertEquals(after?.basic_auth_username, PROXY_USER);
	assertEquals(after?.basic_auth_password, 'new-proxy-password');
});

/** Create an instance with saved Basic Auth at a URL nothing answers on */
async function createSavedInstance(name: string, host: string): Promise<number> {
	const result = await createInstance(name, {
		url: `http://${host}.invalid`,
		basic_auth_username: PROXY_USER,
		basic_auth_password: PROXY_PASSWORD
	});
	// A successful create redirects to the instance list
	assertEquals(result.status, 303);
	return readInstance(name)!.id;
}

test('changing the URL clears saved credentials left blank', async () => {
	const id = await createSavedInstance('Moved Blank', 'moved-blank');
	const result = await updateInstance(id, 'Moved Blank', {
		url: 'http://moved-blank-new.invalid',
		api_key: FAKE_KEY
	});
	assertEquals(result.status, 200);

	const after = readInstance('Moved Blank');
	assertEquals(after?.basic_auth_username, null);
	assertEquals(after?.basic_auth_password, null);
});

test('changing the URL saves re-entered credentials', async () => {
	const id = await createSavedInstance('Moved Reentered', 'moved-reentered');
	const result = await updateInstance(id, 'Moved Reentered', {
		url: 'http://moved-reentered-new.invalid',
		api_key: FAKE_KEY,
		basic_auth_username: 'new-user',
		basic_auth_password: 'new-password',
		basic_auth_username_touched: '1',
		basic_auth_password_touched: '1'
	});
	assertEquals(result.status, 200);

	const after = readInstance('Moved Reentered');
	assertEquals(after?.basic_auth_username, 'new-user');
	assertEquals(after?.basic_auth_password, 'new-password');
});

test('changing the URL rejects re-entering only the username', async () => {
	const id = await createSavedInstance('Moved Partial', 'moved-partial');
	const result = await updateInstance(id, 'Moved Partial', {
		url: 'http://moved-partial-new.invalid',
		api_key: FAKE_KEY,
		basic_auth_username: PROXY_USER,
		basic_auth_username_touched: '1'
	});
	assertEquals(result.status, 400);

	const after = readInstance('Moved Partial');
	assertEquals(after?.basic_auth_username, PROXY_USER);
	assertEquals(after?.basic_auth_password, PROXY_PASSWORD);
});

await run();
