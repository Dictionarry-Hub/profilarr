/**
 * Integration tests for POST /api/v1/backups/upload
 *
 * Verifies file upload, auth, validation, zip slip rejection, and duplicates.
 */

import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';
import { startServer, stopServer, getDbPath } from '#integration/harness/server.ts';
import { TestClient } from '#integration/harness/client.ts';
import { createUser, login, setApiKey } from '#integration/harness/setup.ts';

const execFileAsync = promisify(execFile);

const PORT = PORTS.backups.upload;
const ORIGIN = `http://localhost:${PORT}`;
const API_KEY = 'test-api-key-backups-upload-123';
const BACKUPS_DIR = `./dist/integration-${PORT}/backups`;

let client: TestClient;
let unauthClient: TestClient;
let apiKeyClient: TestClient;

/** Create a valid tar.gz in a temp location and return its path. */
async function createTarGz(name: string, content: string = 'test'): Promise<string> {
	const tmpDir = await mkdtemp(join(tmpdir(), 'profilarr-'));
	await writeFile(`${tmpDir}/data.txt`, content);

	const archivePath = `${tmpDir}/${name}`;
	await execFileAsync('tar', ['-czf', archivePath, '-C', tmpDir, 'data.txt']);
	return archivePath;
}

/** Create a tar.gz with a zip slip path traversal entry. */
async function createZipSlipTarGz(): Promise<string> {
	const tmpDir = await mkdtemp(join(tmpdir(), 'profilarr-'));
	const dataDir = `${tmpDir}/data`;
	await mkdir(dataDir, { recursive: true });
	await writeFile(`${dataDir}/evil.txt`, 'malicious');

	const archivePath = `${tmpDir}/backup-zipslip.tar.gz`;
	await execFileAsync('tar', [
		'-czf',
		archivePath,
		'--transform',
		's|data/evil.txt|../../etc/evil.txt|',
		'-C',
		tmpDir,
		'data/evil.txt'
	]);
	return archivePath;
}

/** Build a FormData with a file from disk. */
async function buildUploadForm(filePath: string, fieldName: string = 'file'): Promise<FormData> {
	const data = await readFile(filePath);
	const filename = filePath.split('/').pop()!;
	const blob = new Blob([data], { type: 'application/gzip' });
	const formData = new FormData();
	formData.append(fieldName, blob, filename);
	return formData;
}

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');

	client = new TestClient(ORIGIN);
	unauthClient = new TestClient(ORIGIN);
	apiKeyClient = new TestClient(ORIGIN);

	await createUser(client, 'admin', 'password123', ORIGIN);
	await login(client, 'admin', 'password123', ORIGIN);
	await setApiKey(getDbPath(PORT), API_KEY);
});

afterAll(async () => {
	await stopServer(PORT);
});

// ─── Auth ────────────────────────────────────────────────────────────────────

test('POST /api/v1/backups/upload with valid tar.gz returns 201', async () => {
	const archivePath = await createTarGz('backup-upload-test-1.tar.gz');
	const formData = await buildUploadForm(archivePath);

	const res = await client.postMultipart('/api/v1/backups/upload', formData, {
		headers: { Origin: ORIGIN }
	});
	expect(res.status).toStrictEqual(201);

	const body = await res.json();
	expect(body.filename).not.toBeOneOf([null, undefined]);
	expect(body.size).not.toBeOneOf([null, undefined]);
	expect(body.sizeFormatted).not.toBeOneOf([null, undefined]);
});

test('POST /api/v1/backups/upload with API key returns 201', async () => {
	const archivePath = await createTarGz('backup-upload-apikey.tar.gz');
	const formData = await buildUploadForm(archivePath);

	const res = await apiKeyClient.postMultipart('/api/v1/backups/upload', formData, {
		headers: { 'X-Api-Key': API_KEY, Origin: ORIGIN }
	});
	expect(res.status).toStrictEqual(201);
});

test('POST /api/v1/backups/upload without auth returns 401', async () => {
	const archivePath = await createTarGz('backup-upload-unauth.tar.gz');
	const formData = await buildUploadForm(archivePath);

	const res = await unauthClient.postMultipart('/api/v1/backups/upload', formData, {
		headers: { Origin: ORIGIN }
	});
	expect(res.status).toStrictEqual(401);
});

// ─── Validation ──────────────────────────────────────────────────────────────

test('upload with non-tar.gz file returns 400', async () => {
	const tmpDir = await mkdtemp(join(tmpdir(), 'profilarr-'));
	const fakePath = `${tmpDir}/notabackup.zip`;
	await writeFile(fakePath, 'fake zip content');

	const data = await readFile(fakePath);
	const formData = new FormData();
	formData.append('file', new Blob([data]), 'notabackup.zip');

	const res = await client.postMultipart('/api/v1/backups/upload', formData, {
		headers: { Origin: ORIGIN }
	});
	expect(res.status).toStrictEqual(400);

	const body = await res.json();
	expect(body.error.includes('.tar.gz')).toStrictEqual(true);
});

test('upload with no file returns 400', async () => {
	const formData = new FormData();

	const res = await client.postMultipart('/api/v1/backups/upload', formData, {
		headers: { Origin: ORIGIN }
	});
	expect(res.status).toStrictEqual(400);
});

// ─── Behavior ────────────────────────────────────────────────────────────────

test('uploaded file appears in GET /api/v1/backups', async () => {
	const archivePath = await createTarGz('backup-upload-visible.tar.gz');
	const formData = await buildUploadForm(archivePath);

	const uploadRes = await client.postMultipart('/api/v1/backups/upload', formData, {
		headers: { Origin: ORIGIN }
	});
	expect(uploadRes.status).toStrictEqual(201);

	const uploadBody = await uploadRes.json();
	const uploadedFilename = uploadBody.filename;

	const listRes = await client.get('/api/v1/backups');
	const backups = await listRes.json();
	const found = backups.some((b: { filename: string }) => b.filename === uploadedFilename);
	expect(found, `uploaded file ${uploadedFilename} should appear in list`).toStrictEqual(true);
});

// ─── Security ────────────────────────────────────────────────────────────────

test('upload with zip slip archive returns 400', async () => {
	const archivePath = await createZipSlipTarGz();
	const formData = await buildUploadForm(archivePath);

	const res = await client.postMultipart('/api/v1/backups/upload', formData, {
		headers: { Origin: ORIGIN }
	});
	expect(res.status).toStrictEqual(400);

	const body = await res.json();
	expect(body.error.includes('path traversal')).toStrictEqual(true);
});

// ─── Duplicates ──────────────────────────────────────────────────────────────

test('upload with duplicate filename returns 400', async () => {
	const archivePath1 = await createTarGz('backup-duplicate-test.tar.gz', 'first');
	const formData1 = await buildUploadForm(archivePath1);

	const res1 = await client.postMultipart('/api/v1/backups/upload', formData1, {
		headers: { Origin: ORIGIN }
	});
	expect(res1.status).toStrictEqual(201);

	const archivePath2 = await createTarGz('backup-duplicate-test.tar.gz', 'second');
	const formData2 = await buildUploadForm(archivePath2);

	const res2 = await client.postMultipart('/api/v1/backups/upload', formData2, {
		headers: { Origin: ORIGIN }
	});
	expect(res2.status).toStrictEqual(400);

	const body = await res2.json();
	expect(body.error.includes('already exists')).toStrictEqual(true);
});
