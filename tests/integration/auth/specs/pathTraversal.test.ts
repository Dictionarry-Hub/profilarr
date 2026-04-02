/**
 * Integration tests: Path traversal (SA-01)
 *
 * Three endpoints accept client-supplied file paths that flow into
 * filesystem operations (Deno.readTextFile, Deno.copyFile). Without
 * validation, an attacker can use ../ sequences or absolute paths to
 * read, exfiltrate, or push arbitrary files.
 *
 * Endpoints:
 * 1. POST /databases/[id]/changes?/commit (form action)
 * 2. POST /databases/[id]/changes?/preview (form action)
 *
 * Tests:
 * 1-4.   commit action rejects traversal payloads
 * 5-8.   preview action rejects traversal payloads
 * 9-10.  symlink escape rejected across both endpoints
 */

import { assertEquals } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { createUserDirect, login } from '../harness/setup.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { Database } from 'jsr:@db/sqlite@0.12';

const PORT = 7018;
const ORIGIN = `http://localhost:${PORT}`;
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

		return { id: row.id, uuid };
	} finally {
		db.close();
	}
}

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');
	const dbPath = getDbPath(PORT);

	await createUserDirect(dbPath, 'admin', 'password123');
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

// --- Endpoint 1: commit action (form action with session) ---
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

// --- Endpoint 2: preview action (form action with session) ---

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
