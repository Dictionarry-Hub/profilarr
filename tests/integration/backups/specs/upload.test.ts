/**
 * Integration tests for POST /api/v1/backups/upload
 *
 * Verifies file upload, auth, validation, zip slip rejection, and duplicates.
 */

import { assertEquals, assertExists } from '@std/assert';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { TestClient } from '$test-harness/client.ts';
import { createUser, login, setApiKey } from '$test-harness/setup.ts';

const PORT = 7033;
const ORIGIN = `http://localhost:${PORT}`;
const API_KEY = 'test-api-key-backups-upload-123';
const BACKUPS_DIR = `./dist/integration-${PORT}/backups`;

let client: TestClient;
let unauthClient: TestClient;
let apiKeyClient: TestClient;

/** Create a valid tar.gz in a temp location and return its path. */
async function createTarGz(name: string, content: string = 'test'): Promise<string> {
	const tmpDir = await Deno.makeTempDir();
	await Deno.writeTextFile(`${tmpDir}/data.txt`, content);

	const archivePath = `${tmpDir}/${name}`;
	const cmd = new Deno.Command('tar', {
		args: ['-czf', archivePath, '-C', tmpDir, 'data.txt'],
		stdout: 'null',
		stderr: 'null'
	});
	await cmd.output();
	return archivePath;
}

/** Create a tar.gz with a zip slip path traversal entry. */
async function createZipSlipTarGz(): Promise<string> {
	const tmpDir = await Deno.makeTempDir();
	const dataDir = `${tmpDir}/data`;
	await Deno.mkdir(dataDir, { recursive: true });
	await Deno.writeTextFile(`${dataDir}/evil.txt`, 'malicious');

	const archivePath = `${tmpDir}/backup-zipslip.tar.gz`;
	const cmd = new Deno.Command('tar', {
		args: [
			'-czf',
			archivePath,
			'--transform',
			's|data/evil.txt|../../etc/evil.txt|',
			'-C',
			tmpDir,
			'data/evil.txt'
		],
		stdout: 'null',
		stderr: 'null'
	});
	await cmd.output();
	return archivePath;
}

/** Build a FormData with a file from disk. */
async function buildUploadForm(filePath: string, fieldName: string = 'file'): Promise<FormData> {
	const data = await Deno.readFile(filePath);
	const filename = filePath.split('/').pop()!;
	const blob = new Blob([data], { type: 'application/gzip' });
	const formData = new FormData();
	formData.append(fieldName, blob, filename);
	return formData;
}

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');

	client = new TestClient(ORIGIN);
	unauthClient = new TestClient(ORIGIN);
	apiKeyClient = new TestClient(ORIGIN);

	await createUser(client, 'admin', 'password123', ORIGIN);
	await login(client, 'admin', 'password123', ORIGIN);
	await setApiKey(getDbPath(PORT), API_KEY);
});

teardown(async () => {
	await stopServer(PORT);
});

// ─── Auth ────────────────────────────────────────────────────────────────────

test('POST /api/v1/backups/upload with valid tar.gz returns 201', async () => {
	const archivePath = await createTarGz('backup-upload-test-1.tar.gz');
	const formData = await buildUploadForm(archivePath);

	const res = await client.postMultipart('/api/v1/backups/upload', formData, {
		headers: { Origin: ORIGIN }
	});
	assertEquals(res.status, 201);

	const body = await res.json();
	assertExists(body.filename);
	assertExists(body.size);
	assertExists(body.sizeFormatted);
});

test('POST /api/v1/backups/upload with API key returns 201', async () => {
	const archivePath = await createTarGz('backup-upload-apikey.tar.gz');
	const formData = await buildUploadForm(archivePath);

	const res = await apiKeyClient.postMultipart('/api/v1/backups/upload', formData, {
		headers: { 'X-Api-Key': API_KEY, Origin: ORIGIN }
	});
	assertEquals(res.status, 201);
});

test('POST /api/v1/backups/upload without auth returns 401', async () => {
	const archivePath = await createTarGz('backup-upload-unauth.tar.gz');
	const formData = await buildUploadForm(archivePath);

	const res = await unauthClient.postMultipart('/api/v1/backups/upload', formData, {
		headers: { Origin: ORIGIN }
	});
	assertEquals(res.status, 401);
});

// ─── Validation ──────────────────────────────────────────────────────────────

test('upload with non-tar.gz file returns 400', async () => {
	const tmpDir = await Deno.makeTempDir();
	const fakePath = `${tmpDir}/notabackup.zip`;
	await Deno.writeTextFile(fakePath, 'fake zip content');

	const data = await Deno.readFile(fakePath);
	const formData = new FormData();
	formData.append('file', new Blob([data]), 'notabackup.zip');

	const res = await client.postMultipart('/api/v1/backups/upload', formData, {
		headers: { Origin: ORIGIN }
	});
	assertEquals(res.status, 400);

	const body = await res.json();
	assertEquals(body.error.includes('.tar.gz'), true);
});

test('upload with no file returns 400', async () => {
	const formData = new FormData();

	const res = await client.postMultipart('/api/v1/backups/upload', formData, {
		headers: { Origin: ORIGIN }
	});
	assertEquals(res.status, 400);
});

// ─── Behavior ────────────────────────────────────────────────────────────────

test('uploaded file appears in GET /api/v1/backups', async () => {
	const archivePath = await createTarGz('backup-upload-visible.tar.gz');
	const formData = await buildUploadForm(archivePath);

	const uploadRes = await client.postMultipart('/api/v1/backups/upload', formData, {
		headers: { Origin: ORIGIN }
	});
	assertEquals(uploadRes.status, 201);

	const uploadBody = await uploadRes.json();
	const uploadedFilename = uploadBody.filename;

	const listRes = await client.get('/api/v1/backups');
	const backups = await listRes.json();
	const found = backups.some((b: { filename: string }) => b.filename === uploadedFilename);
	assertEquals(found, true, `uploaded file ${uploadedFilename} should appear in list`);
});

// ─── Security ────────────────────────────────────────────────────────────────

test('upload with zip slip archive returns 400', async () => {
	const archivePath = await createZipSlipTarGz();
	const formData = await buildUploadForm(archivePath);

	const res = await client.postMultipart('/api/v1/backups/upload', formData, {
		headers: { Origin: ORIGIN }
	});
	assertEquals(res.status, 400);

	const body = await res.json();
	assertEquals(body.error.includes('path traversal'), true);
});

// ─── Duplicates ──────────────────────────────────────────────────────────────

test('upload with duplicate filename returns 400', async () => {
	const archivePath1 = await createTarGz('backup-duplicate-test.tar.gz', 'first');
	const formData1 = await buildUploadForm(archivePath1);

	const res1 = await client.postMultipart('/api/v1/backups/upload', formData1, {
		headers: { Origin: ORIGIN }
	});
	assertEquals(res1.status, 201);

	const archivePath2 = await createTarGz('backup-duplicate-test.tar.gz', 'second');
	const formData2 = await buildUploadForm(archivePath2);

	const res2 = await client.postMultipart('/api/v1/backups/upload', formData2, {
		headers: { Origin: ORIGIN }
	});
	assertEquals(res2.status, 400);

	const body = await res2.json();
	assertEquals(body.error.includes('already exists'), true);
});

await run();
