/**
 * Integration tests: Path traversal (SA-01)
 *
 * Three endpoints accept client-supplied file paths that flow into
 * filesystem operations (Deno.readTextFile, Deno.copyFile). Without
 * validation, an attacker can use ../ sequences or absolute paths to
 * read, exfiltrate, or push arbitrary files.
 *
 * Endpoints:
 * 1. POST /api/databases/[id]/generate-commit-message (JSON body)
 * 2. POST /databases/[id]/changes?/commit (form action)
 * 3. POST /databases/[id]/changes?/preview (form action)
 *
 * Tests:
 * 1-4.   generate-commit-message rejects traversal payloads
 * 5-8.   commit action rejects traversal payloads
 * 9-12.  preview action rejects traversal payloads
 * 13-15. symlink escape rejected across all 3 endpoints
 */

import { assertEquals, assertStringIncludes } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { createUserDirect, setApiKey, login } from '../harness/setup.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { Database } from 'jsr:@db/sqlite@0.12';

const PORT = 7018;
const ORIGIN = `http://localhost:${PORT}`;
const API_KEY = 'path-traversal-test-key-abc123';

const PAYLOADS = [
	{ name: 'relative traversal', path: '../../etc/passwd' },
	{ name: 'absolute path', path: '/etc/passwd' },
	{ name: 'dot-prefix traversal', path: './../../etc/passwd' },
	{ name: 'nested traversal', path: 'valid-dir/../../etc/passwd' }
];

let dbId: number;
let dbUuid: string;
let sessionClient: TestClient;
let outsideDir: string;

function seedDatabase(dbPath: string): { id: number; uuid: string } {
	const db = new Database(dbPath);
	try {
		const uuid = crypto.randomUUID();
		const localPath = `./dist/integration-${PORT}/data/databases/${uuid}`;
		db.exec(
			`INSERT INTO database_instances (uuid, name, repository_url, local_path, enabled)
			 VALUES (?, 'Path Traversal Test DB', 'https://github.com/test/repo', ?, 1)`,
			[uuid, localPath]
		);
		const row = db.prepare('SELECT id FROM database_instances WHERE uuid = ?').get(uuid) as {
			id: number;
		};

		// Enable AI so generate-commit-message gets past isAIEnabled()
		db.exec('UPDATE ai_settings SET enabled = 1, api_url = ?, model = ? WHERE id = 1', [
			'http://localhost:9999/v1',
			'test-model'
		]);

		return { id: row.id, uuid };
	} finally {
		db.close();
	}
}

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');
	const dbPath = getDbPath(PORT);

	await createUserDirect(dbPath, 'admin', 'password123');
	await setApiKey(dbPath, API_KEY);
	const seed = seedDatabase(dbPath);
	dbId = seed.id;
	dbUuid = seed.uuid;

	// Create repo directory and a symlink pointing outside it
	const repoDir = `./dist/integration-${PORT}/data/databases/${dbUuid}`;
	outsideDir = await Deno.makeTempDir({ prefix: 'profilarr-symlink-test-' });
	await Deno.writeTextFile(`${outsideDir}/secret.txt`, 'sensitive data');
	await Deno.mkdir(repoDir, { recursive: true });
	await Deno.symlink(outsideDir, `${repoDir}/evil`);

	sessionClient = new TestClient(ORIGIN);
	await login(sessionClient, 'admin', 'password123', ORIGIN);
});

teardown(async () => {
	await stopServer(PORT);
	try {
		await Deno.remove(outsideDir, { recursive: true });
	} catch {
		// cleanup best-effort
	}
});

// --- Endpoint 1: generate-commit-message (JSON API with API key) ---

for (const payload of PAYLOADS) {
	test(`generate-commit-message rejects ${payload.name}`, async () => {
		const client = new TestClient(ORIGIN);
		const res = await client.post(
			`/api/databases/${dbId}/generate-commit-message`,
			{ files: [payload.path] },
			{ headers: { 'X-Api-Key': API_KEY } }
		);
		assertEquals(res.status, 400, `Expected 400 for ${payload.name}, got ${res.status}`);
		const body = await res.json();
		assertStringIncludes(
			body.message.toLowerCase(),
			'path',
			`Error message should mention path validation, got: ${body.message}`
		);
	});
}

// --- Endpoint 2: commit action (form action with session) ---
// SvelteKit form actions return HTTP 200 with status in JSON body:
// { "type": "failure", "status": 400, "data": "..." }

for (const payload of PAYLOADS) {
	test(`commit action rejects ${payload.name}`, async () => {
		const res = await sessionClient.postForm(
			`/databases/${dbId}/changes?/commit`,
			{ filePaths: payload.path, message: 'test commit', opIds: '' },
			{ headers: { Origin: ORIGIN } }
		);
		const body = await res.json();
		assertEquals(
			body.status,
			400,
			`Expected inner status 400 for ${payload.name}, got ${body.status}`
		);
	});
}

// --- Endpoint 3: preview action (form action with session) ---

for (const payload of PAYLOADS) {
	test(`preview action rejects ${payload.name}`, async () => {
		const res = await sessionClient.postForm(
			`/databases/${dbId}/changes?/preview`,
			{ filePaths: payload.path, message: 'test commit', opIds: '' },
			{ headers: { Origin: ORIGIN } }
		);
		const body = await res.json();
		assertEquals(
			body.status,
			400,
			`Expected inner status 400 for ${payload.name}, got ${body.status}`
		);
	});
}

// --- Symlink escape: path resolves lexically inside repo but follows symlink outside ---
// Setup creates <repoDir>/evil -> /tmp/..., so "evil/secret.txt" passes a
// naive startsWith check but actually reads from outside the repo.

test('generate-commit-message rejects symlink escape', async () => {
	const client = new TestClient(ORIGIN);
	const res = await client.post(
		`/api/databases/${dbId}/generate-commit-message`,
		{ files: ['evil/secret.txt'] },
		{ headers: { 'X-Api-Key': API_KEY } }
	);
	assertEquals(res.status, 400, `Expected 400 for symlink escape, got ${res.status}`);
	const body = await res.json();
	assertStringIncludes(
		body.message.toLowerCase(),
		'path',
		`Error message should mention path validation, got: ${body.message}`
	);
});

test('commit action rejects symlink escape', async () => {
	const res = await sessionClient.postForm(
		`/databases/${dbId}/changes?/commit`,
		{ filePaths: 'evil/secret.txt', message: 'test commit', opIds: '' },
		{ headers: { Origin: ORIGIN } }
	);
	const body = await res.json();
	assertEquals(
		body.status,
		400,
		`Expected inner status 400 for symlink escape, got ${body.status}`
	);
});

test('preview action rejects symlink escape', async () => {
	const res = await sessionClient.postForm(
		`/databases/${dbId}/changes?/preview`,
		{ filePaths: 'evil/secret.txt', message: 'test commit', opIds: '' },
		{ headers: { Origin: ORIGIN } }
	);
	const body = await res.json();
	assertEquals(
		body.status,
		400,
		`Expected inner status 400 for symlink escape, got ${body.status}`
	);
});

await run();
