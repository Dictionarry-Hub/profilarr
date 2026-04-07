/**
 * Integration tests for GET/PATCH /api/v1/backups/settings
 *
 * Verifies settings retrieval, updates, validation, and auth.
 */

import { assertEquals } from '@std/assert';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { TestClient } from '$test-harness/client.ts';
import { createUser, login, setApiKey } from '$test-harness/setup.ts';

const PORT = 7034;
const ORIGIN = `http://localhost:${PORT}`;
const API_KEY = 'test-api-key-backups-settings-123';

let client: TestClient;
let unauthClient: TestClient;
let apiKeyClient: TestClient;

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

// ─── GET: Auth ───────────────────────────────────────────────────────────────

test('GET /api/v1/backups/settings with session returns 200', async () => {
	const res = await client.get('/api/v1/backups/settings');
	assertEquals(res.status, 200);
});

test('GET /api/v1/backups/settings with API key returns 200', async () => {
	const res = await apiKeyClient.get('/api/v1/backups/settings', {
		headers: { 'X-Api-Key': API_KEY }
	});
	assertEquals(res.status, 200);
});

test('GET /api/v1/backups/settings without auth returns 401', async () => {
	const res = await unauthClient.get('/api/v1/backups/settings');
	assertEquals(res.status, 401);
});

// ─── GET: Response shape ─────────────────────────────────────────────────────

test('GET returns default settings with expected fields', async () => {
	const res = await client.get('/api/v1/backups/settings');
	const body = await res.json();

	assertEquals(body.schedule, 'daily');
	assertEquals(body.retentionDays, 30);
	assertEquals(body.enabled, true);
	assertEquals(body.includeDatabase, true);
	assertEquals(body.compressionEnabled, true);
});

// ─── PATCH: Updates ──────────────────────────────────────────────────────────

test('PATCH updates schedule and returns updated settings', async () => {
	const res = await client.patch('/api/v1/backups/settings', { schedule: 'weekly' });
	assertEquals(res.status, 200);

	const body = await res.json();
	assertEquals(body.schedule, 'weekly');
	// Other fields unchanged
	assertEquals(body.retentionDays, 30);
	assertEquals(body.enabled, true);
});

test('PATCH updates retentionDays', async () => {
	const res = await client.patch('/api/v1/backups/settings', { retentionDays: 14 });
	assertEquals(res.status, 200);

	const body = await res.json();
	assertEquals(body.retentionDays, 14);
});

test('PATCH updates enabled toggle', async () => {
	const res = await client.patch('/api/v1/backups/settings', { enabled: false });
	assertEquals(res.status, 200);

	const body = await res.json();
	assertEquals(body.enabled, false);

	// Restore
	await client.patch('/api/v1/backups/settings', { enabled: true });
});

// ─── PATCH: Validation ───────────────────────────────────────────────────────

test('PATCH with empty body returns 400', async () => {
	const res = await client.patch('/api/v1/backups/settings', {});
	assertEquals(res.status, 400);
});

test('PATCH with retentionDays: 0 returns 400', async () => {
	const res = await client.patch('/api/v1/backups/settings', { retentionDays: 0 });
	assertEquals(res.status, 400);
});

test('PATCH with retentionDays: 999 returns 400', async () => {
	const res = await client.patch('/api/v1/backups/settings', { retentionDays: 999 });
	assertEquals(res.status, 400);
});

test('PATCH with invalid schedule returns 400', async () => {
	const res = await client.patch('/api/v1/backups/settings', { schedule: 'every-5-seconds' });
	assertEquals(res.status, 400);
});

// ─── PATCH: Auth ─────────────────────────────────────────────────────────────

test('PATCH without auth returns 401', async () => {
	const res = await unauthClient.patch('/api/v1/backups/settings', { schedule: 'weekly' });
	assertEquals(res.status, 401);
});

// ─── Round-trip ──────────────────────────────────────────────────────────────

test('after PATCH, GET reflects changes', async () => {
	// Reset to known state first
	await client.patch('/api/v1/backups/settings', {
		schedule: 'daily',
		retentionDays: 30,
		enabled: true
	});

	// Make a change
	await client.patch('/api/v1/backups/settings', { schedule: 'monthly', retentionDays: 7 });

	// Verify via GET
	const res = await client.get('/api/v1/backups/settings');
	const body = await res.json();
	assertEquals(body.schedule, 'monthly');
	assertEquals(body.retentionDays, 7);

	// Restore defaults
	await client.patch('/api/v1/backups/settings', { schedule: 'daily', retentionDays: 30 });
});

await run();
