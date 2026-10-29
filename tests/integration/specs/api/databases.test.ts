/**
 * Integration tests: /api/v1/databases
 *
 * GET /databases:
 * 1. Returns 401 without auth
 * 2. Returns 200 with empty array when no databases linked
 * 3. Returns populated array after seeding a database instance
 * 4. Response does not contain personal_access_token or local_path
 *
 * POST /databases:
 * 5. Returns 401 without auth
 * 6. Returns 400 when name is missing
 * 7. Returns 400 when repository_url is missing
 * 8. Returns 400 when PAT is set without git identity
 * 9. Returns 400 when local_ops_enabled is set without PAT
 * 10. Returns 400 when conflict_strategy is set with PAT but without local_ops_enabled
 * 11. Returns 409 when name already exists
 * 12. Returns 201 and links a real database
 *
 * GET /databases/{id}:
 * 13. Returns 404 for non-existent ID
 * 14. Returns 200 with database detail
 *
 * PATCH /databases/{id}:
 * 15. Returns 404 for non-existent ID
 * 16. Returns 400 for empty body
 * 17. Returns 400 when PAT set without git identity
 * 18. Returns 409 when name conflicts with another database
 * 19. Returns 200 and updates name
 *
 * POST /databases/{id}/sync:
 * 20. Returns 404 for non-existent ID
 * 21. Returns 202 with jobId
 *
 * DELETE /databases/{id}:
 * 22. Returns 404 for non-existent ID
 * 23. Returns 204 and unlinks
 * 24. GET after delete returns 404
 */

import { TestClient } from '#integration/harness/client.ts';
import { startServer, stopServer, getDbPath } from '#integration/harness/server.ts';
import { createUserDirect, setApiKey } from '#integration/harness/setup.ts';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';
import { openDb } from '#integration/harness/db.ts';

const PORT = PORTS.api.databases;
const ORIGIN = `http://localhost:${PORT}`;
const API_KEY = 'databases-test-key-abc123';

let client: TestClient;
let linkedDbId: number;

function seedDatabase(dbPath: string): void {
	const db = openDb(dbPath);
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

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN, INTEGRATION_TEST: '1' }, 'preview');
	const dbPath = getDbPath(PORT);
	await createUserDirect(dbPath, 'admin', 'password123');
	await setApiKey(dbPath, API_KEY);
	client = new TestClient(ORIGIN);
});

afterAll(async () => {
	await stopServer(PORT);
});

test('GET /api/v1/databases returns 401 without auth', async () => {
	const unauthClient = new TestClient(ORIGIN);
	const res = await unauthClient.get('/api/v1/databases');
	expect(res.status).toStrictEqual(401);
});

test('GET /api/v1/databases returns 200 with empty array', async () => {
	const res = await client.get('/api/v1/databases', {
		headers: { 'X-Api-Key': API_KEY }
	});
	expect(res.status).toStrictEqual(200);
	const body = await res.json();
	expect(Array.isArray(body)).toStrictEqual(true);
	expect(body.length).toStrictEqual(0);
});

test('GET /api/v1/databases returns seeded database', async () => {
	seedDatabase(getDbPath(PORT));
	const res = await client.get('/api/v1/databases', {
		headers: { 'X-Api-Key': API_KEY }
	});
	expect(res.status).toStrictEqual(200);
	const body = await res.json();
	expect(body.length).toStrictEqual(1);
	expect(body[0].name).toStrictEqual('Test DB');
	expect(body[0].repository_url).toStrictEqual('https://github.com/test/repo');
	expect(body[0].hasPat).not.toBeOneOf([null, undefined]);
	expect(body[0].hasPat).toStrictEqual(true);
});

test('response does not contain secrets or internal fields', async () => {
	const res = await client.get('/api/v1/databases', {
		headers: { 'X-Api-Key': API_KEY }
	});
	const body = await res.json();
	expect(body.length).toStrictEqual(1);
	expect(body[0].personal_access_token).toStrictEqual(undefined);
	expect(body[0].local_path).toStrictEqual(undefined);
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
	expect(res.status).toStrictEqual(401);
});

test('POST /api/v1/databases returns 400 when name is missing', async () => {
	const res = await client.post(
		'/api/v1/databases',
		{ repository_url: TEST_REPO },
		{ headers: AUTH_HEADERS }
	);
	expect(res.status).toStrictEqual(400);
	const body = await res.json();
	expect(body.error).not.toBeOneOf([null, undefined]);
});

test('POST /api/v1/databases returns 400 when repository_url is missing', async () => {
	const res = await client.post(
		'/api/v1/databases',
		{ name: 'Missing URL DB' },
		{ headers: AUTH_HEADERS }
	);
	expect(res.status).toStrictEqual(400);
	const body = await res.json();
	expect(body.error).not.toBeOneOf([null, undefined]);
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
	expect(res.status).toStrictEqual(400);
	const body = await res.json();
	expect(body.error).not.toBeOneOf([null, undefined]);
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
	expect(res.status).toStrictEqual(400);
	const body = await res.json();
	expect(body.error).not.toBeOneOf([null, undefined]);
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
	expect(res.status).toStrictEqual(400);
	const body = await res.json();
	expect(body.error).not.toBeOneOf([null, undefined]);
});

test('POST /api/v1/databases returns 409 when name already exists', async () => {
	// 'Test DB' was seeded by the earlier GET test
	const res = await client.post(
		'/api/v1/databases',
		{ name: 'Test DB', repository_url: TEST_REPO },
		{ headers: AUTH_HEADERS }
	);
	expect(res.status).toStrictEqual(409);
	const body = await res.json();
	expect(body.error).not.toBeOneOf([null, undefined]);
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
	expect(res.status, `Expected 201, got ${res.status}: ${await res.clone().text()}`).toStrictEqual(
		201
	);
	const body = await res.json();

	// Required fields present
	expect(body.id).not.toBeOneOf([null, undefined]);
	linkedDbId = body.id;
	expect(body.uuid).not.toBeOneOf([null, undefined]);
	expect(body.name).toStrictEqual('API Linked DB');
	expect(body.repository_url).toStrictEqual(TEST_REPO);
	expect(body.created_at).not.toBeOneOf([null, undefined]);
	expect(body.updated_at).not.toBeOneOf([null, undefined]);

	// Defaults applied
	expect(body.sync_strategy).toStrictEqual(0);
	expect(body.auto_pull).toStrictEqual(0);
	expect(body.enabled).toStrictEqual(1);
	expect(body.local_ops_enabled).toStrictEqual(0);
	expect(body.conflict_strategy).toStrictEqual('override');
	expect(body.hasPat).toStrictEqual(false);

	// Secrets stripped
	expect(body.personal_access_token).toStrictEqual(undefined);
	expect(body.local_path).toStrictEqual(undefined);
});

// --- GET /api/v1/databases/{id} ---

test('GET /api/v1/databases/{id} returns 404 for non-existent ID', async () => {
	const res = await client.get('/api/v1/databases/99999', {
		headers: AUTH_HEADERS
	});
	expect(res.status).toStrictEqual(404);
	const body = await res.json();
	expect(body.error).not.toBeOneOf([null, undefined]);
});

test('GET /api/v1/databases/{id} returns 200 with database detail', async () => {
	const res = await client.get(`/api/v1/databases/${linkedDbId}`, {
		headers: AUTH_HEADERS
	});
	expect(res.status).toStrictEqual(200);
	const body = await res.json();
	expect(body.id).toStrictEqual(linkedDbId);
	expect(body.name).toStrictEqual('API Linked DB');
	expect(body.repository_url).toStrictEqual(TEST_REPO);
	expect(body.created_at).not.toBeOneOf([null, undefined]);
	// Secrets stripped
	expect(body.personal_access_token).toStrictEqual(undefined);
	expect(body.local_path).toStrictEqual(undefined);
});

// --- PATCH /api/v1/databases/{id} ---

test('PATCH /api/v1/databases/{id} returns 404 for non-existent ID', async () => {
	const res = await client.patch(
		'/api/v1/databases/99999',
		{ name: 'Nope' },
		{ headers: AUTH_HEADERS }
	);
	expect(res.status).toStrictEqual(404);
});

test('PATCH /api/v1/databases/{id} returns 400 for empty body', async () => {
	const res = await client.patch(`/api/v1/databases/${linkedDbId}`, {}, { headers: AUTH_HEADERS });
	expect(res.status).toStrictEqual(400);
	const body = await res.json();
	expect(body.error).not.toBeOneOf([null, undefined]);
});

test('PATCH /api/v1/databases/{id} returns 400 when PAT set without git identity', async () => {
	const res = await client.patch(
		`/api/v1/databases/${linkedDbId}`,
		{ personal_access_token: 'ghp_fake' },
		{ headers: AUTH_HEADERS }
	);
	expect(res.status).toStrictEqual(400);
	const body = await res.json();
	expect(body.error).not.toBeOneOf([null, undefined]);
});

test('PATCH /api/v1/databases/{id} returns 409 when name conflicts', async () => {
	// 'Test DB' was seeded earlier
	const res = await client.patch(
		`/api/v1/databases/${linkedDbId}`,
		{ name: 'Test DB' },
		{ headers: AUTH_HEADERS }
	);
	expect(res.status).toStrictEqual(409);
	const body = await res.json();
	expect(body.error).not.toBeOneOf([null, undefined]);
});

test('PATCH /api/v1/databases/{id} returns 200 and updates name', async () => {
	const res = await client.patch(
		`/api/v1/databases/${linkedDbId}`,
		{ name: 'Renamed DB' },
		{ headers: AUTH_HEADERS }
	);
	expect(res.status, `Expected 200, got ${res.status}: ${await res.clone().text()}`).toStrictEqual(
		200
	);
	const body = await res.json();
	expect(body.name).toStrictEqual('Renamed DB');
	expect(body.id).toStrictEqual(linkedDbId);
	// Secrets stripped
	expect(body.personal_access_token).toStrictEqual(undefined);
	expect(body.local_path).toStrictEqual(undefined);
});

// --- POST /api/v1/databases/{id}/sync ---

test('POST /api/v1/databases/{id}/sync returns 404 for non-existent ID', async () => {
	const res = await client.post('/api/v1/databases/99999/sync', {}, { headers: AUTH_HEADERS });
	expect(res.status).toStrictEqual(404);
});

test('POST /api/v1/databases/{id}/sync returns 202 with jobId', async () => {
	const res = await client.post(
		`/api/v1/databases/${linkedDbId}/sync`,
		{},
		{ headers: AUTH_HEADERS }
	);
	expect(res.status, `Expected 202, got ${res.status}: ${await res.clone().text()}`).toStrictEqual(
		202
	);
	const body = await res.json();
	expect(body.jobId).not.toBeOneOf([null, undefined]);
	expect(typeof body.jobId).toStrictEqual('number');
});

// --- DELETE /api/v1/databases/{id} ---

test('DELETE /api/v1/databases/{id} returns 404 for non-existent ID', async () => {
	const res = await client.delete('/api/v1/databases/99999', { headers: AUTH_HEADERS });
	expect(res.status).toStrictEqual(404);
});

test('DELETE /api/v1/databases/{id} returns 204 and unlinks', async () => {
	const res = await client.delete(`/api/v1/databases/${linkedDbId}`, { headers: AUTH_HEADERS });
	expect(res.status).toStrictEqual(204);
});

test('GET /api/v1/databases/{id} returns 404 after delete', async () => {
	const res = await client.get(`/api/v1/databases/${linkedDbId}`, {
		headers: AUTH_HEADERS
	});
	expect(res.status).toStrictEqual(404);
});
