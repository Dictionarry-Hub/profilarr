/**
 * Integration tests: /api/v1/databases
 *
 * GET:
 * 1. Returns 401 without auth
 * 2. Returns 200 with empty array when no databases linked
 * 3. Returns populated array after seeding a database instance
 * 4. Response does not contain personal_access_token or local_path
 *
 * POST:
 * 5. Returns 401 without auth
 * 6. Returns 400 when name is missing
 * 7. Returns 400 when repository_url is missing
 * 8. Returns 400 when PAT is set without git identity
 * 9. Returns 400 when local_ops_enabled is set without PAT
 * 10. Returns 400 when conflict_strategy is set with PAT but without local_ops_enabled
 * 11. Returns 409 when name already exists
 * 12. Returns 201 and links a real database
 */

import { assertEquals, assertExists } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { createUserDirect, setApiKey } from '$test-harness/setup.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { Database } from '@db/sqlite';

const PORT = 7020;
const ORIGIN = `http://localhost:${PORT}`;
const API_KEY = 'databases-test-key-abc123';

let client: TestClient;

function seedDatabase(dbPath: string): void {
	const db = new Database(dbPath);
	try {
		db.exec(
			`INSERT INTO database_instances (uuid, name, repository_url, local_path, personal_access_token, enabled)
			 VALUES (?, 'Test DB', 'https://github.com/test/repo', '/tmp/test-repo', 'secret-pat-value', 1)`,
			[crypto.randomUUID()]
		);
	} finally {
		db.close();
	}
}

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN, INTEGRATION_TEST: '1' }, 'preview');
	const dbPath = getDbPath(PORT);
	await createUserDirect(dbPath, 'admin', 'password123');
	await setApiKey(dbPath, API_KEY);
	client = new TestClient(ORIGIN);
});

teardown(async () => {
	await stopServer(PORT);
});

test('GET /api/v1/databases returns 401 without auth', async () => {
	const unauthClient = new TestClient(ORIGIN);
	const res = await unauthClient.get('/api/v1/databases');
	assertEquals(res.status, 401);
});

test('GET /api/v1/databases returns 200 with empty array', async () => {
	const res = await client.get('/api/v1/databases', {
		headers: { 'X-Api-Key': API_KEY }
	});
	assertEquals(res.status, 200);
	const body = await res.json();
	assertEquals(Array.isArray(body), true);
	assertEquals(body.length, 0);
});

test('GET /api/v1/databases returns seeded database', async () => {
	seedDatabase(getDbPath(PORT));
	const res = await client.get('/api/v1/databases', {
		headers: { 'X-Api-Key': API_KEY }
	});
	assertEquals(res.status, 200);
	const body = await res.json();
	assertEquals(body.length, 1);
	assertEquals(body[0].name, 'Test DB');
	assertEquals(body[0].repository_url, 'https://github.com/test/repo');
	assertExists(body[0].hasPat);
	assertEquals(body[0].hasPat, true);
});

test('response does not contain secrets or internal fields', async () => {
	const res = await client.get('/api/v1/databases', {
		headers: { 'X-Api-Key': API_KEY }
	});
	const body = await res.json();
	assertEquals(body.length, 1);
	assertEquals(body[0].personal_access_token, undefined);
	assertEquals(body[0].local_path, undefined);
});

// --- POST /api/v1/databases ---

const AUTH_HEADERS = { 'X-Api-Key': API_KEY };
const TEST_REPO = 'https://github.com/Dictionarry-Hub/database';

test('POST /api/v1/databases returns 401 without auth', async () => {
	const unauthClient = new TestClient(ORIGIN);
	const res = await unauthClient.post('/api/v1/databases', {
		name: 'No Auth DB',
		repository_url: TEST_REPO
	});
	assertEquals(res.status, 401);
});

test('POST /api/v1/databases returns 400 when name is missing', async () => {
	const res = await client.post(
		'/api/v1/databases',
		{ repository_url: TEST_REPO },
		{ headers: AUTH_HEADERS }
	);
	assertEquals(res.status, 400);
	const body = await res.json();
	assertExists(body.error);
});

test('POST /api/v1/databases returns 400 when repository_url is missing', async () => {
	const res = await client.post(
		'/api/v1/databases',
		{ name: 'Missing URL DB' },
		{ headers: AUTH_HEADERS }
	);
	assertEquals(res.status, 400);
	const body = await res.json();
	assertExists(body.error);
});

test('POST /api/v1/databases returns 400 when PAT set without git identity', async () => {
	const res = await client.post(
		'/api/v1/databases',
		{
			name: 'PAT No Identity DB',
			repository_url: TEST_REPO,
			personal_access_token: 'ghp_fake'
		},
		{ headers: AUTH_HEADERS }
	);
	assertEquals(res.status, 400);
	const body = await res.json();
	assertExists(body.error);
});

test('POST /api/v1/databases returns 400 when local_ops_enabled without PAT', async () => {
	const res = await client.post(
		'/api/v1/databases',
		{
			name: 'Local Ops No PAT DB',
			repository_url: TEST_REPO,
			local_ops_enabled: true
		},
		{ headers: AUTH_HEADERS }
	);
	assertEquals(res.status, 400);
	const body = await res.json();
	assertExists(body.error);
});

test('POST /api/v1/databases returns 400 when conflict_strategy set with PAT but no local_ops', async () => {
	const res = await client.post(
		'/api/v1/databases',
		{
			name: 'Conflict PAT DB',
			repository_url: TEST_REPO,
			personal_access_token: 'ghp_fake',
			git_user_name: 'Test',
			git_user_email: 'test@test.com',
			conflict_strategy: 'align'
		},
		{ headers: AUTH_HEADERS }
	);
	assertEquals(res.status, 400);
	const body = await res.json();
	assertExists(body.error);
});

test('POST /api/v1/databases returns 409 when name already exists', async () => {
	// 'Test DB' was seeded by the earlier GET test
	const res = await client.post(
		'/api/v1/databases',
		{ name: 'Test DB', repository_url: TEST_REPO },
		{ headers: AUTH_HEADERS }
	);
	assertEquals(res.status, 409);
	const body = await res.json();
	assertExists(body.error);
});

test('POST /api/v1/databases returns 201 and links a real database', async () => {
	const res = await client.post(
		'/api/v1/databases',
		{
			name: 'API Linked DB',
			repository_url: TEST_REPO,
			branch: 'v2'
		},
		{ headers: AUTH_HEADERS }
	);
	assertEquals(res.status, 201, `Expected 201, got ${res.status}: ${await res.clone().text()}`);
	const body = await res.json();

	// Required fields present
	assertExists(body.id);
	assertExists(body.uuid);
	assertEquals(body.name, 'API Linked DB');
	assertEquals(body.repository_url, TEST_REPO);
	assertExists(body.created_at);
	assertExists(body.updated_at);

	// Defaults applied
	assertEquals(body.sync_strategy, 0);
	assertEquals(body.auto_pull, 0);
	assertEquals(body.enabled, 1);
	assertEquals(body.local_ops_enabled, 0);
	assertEquals(body.conflict_strategy, 'override');
	assertEquals(body.hasPat, false);

	// Secrets stripped
	assertEquals(body.personal_access_token, undefined);
	assertEquals(body.local_path, undefined);
});

await run();
