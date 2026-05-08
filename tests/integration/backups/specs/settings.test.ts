/**
 * Integration tests for GET/PATCH /api/v1/backups/settings
 *
 * Verifies settings retrieval, updates, validation, and auth.
 */

import { assertEquals } from '@std/assert';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { TestClient } from '$test-harness/client.ts';
import { createUser, login, setApiKey } from '$test-harness/setup.ts';
import { openDb } from '$test-harness/db.ts';

const PORT = PORTS.backups.settings;
const ORIGIN = `http://localhost:${PORT}`;
const API_KEY = 'test-api-key-backups-settings-123';

let client: TestClient;
let unauthClient: TestClient;
let apiKeyClient: TestClient;

function setBackupSettings(
	dbPath: string,
	settings: { schedule?: string; retentionDays?: number; enabled?: boolean }
): void {
	const db = openDb(dbPath);
	try {
		const updates: string[] = [];
		const params: (string | number)[] = [];
		if (settings.schedule !== undefined) {
			updates.push('schedule = ?');
			params.push(settings.schedule);
		}
		if (settings.retentionDays !== undefined) {
			updates.push('retention_days = ?');
			params.push(settings.retentionDays);
		}
		if (settings.enabled !== undefined) {
			updates.push('enabled = ?');
			params.push(settings.enabled ? 1 : 0);
		}
		if (updates.length === 0) return;
		db.exec(`UPDATE backup_settings SET ${updates.join(', ')} WHERE id = 1`, params);
	} finally {
		db.close();
	}
}

function setQueuedScheduledJob(
	dbPath: string,
	dedupeKey: string,
	jobType: string,
	runAt: string
): void {
	const db = openDb(dbPath);
	try {
		const existing = db.prepare('SELECT id FROM job_queue WHERE dedupe_key = ?').get(dedupeKey) as
			| { id: number }
			| undefined;
		if (existing) {
			db.exec(
				`UPDATE job_queue
				 SET job_type = ?, status = 'queued', run_at = ?, payload = '{}', source = 'schedule'
				 WHERE id = ?`,
				[jobType, runAt, existing.id]
			);
			return;
		}

		db.exec(
			`INSERT INTO job_queue (job_type, status, run_at, payload, source, dedupe_key)
			 VALUES (?, 'queued', ?, '{}', 'schedule', ?)`,
			[jobType, runAt, dedupeKey]
		);
	} finally {
		db.close();
	}
}

function getScheduledRunAt(dbPath: string, dedupeKey: string): string | null {
	const db = openDb(dbPath);
	try {
		const row = db.prepare('SELECT run_at FROM job_queue WHERE dedupe_key = ?').get(dedupeKey) as
			| { run_at: string }
			| undefined;
		return row?.run_at ?? null;
	} finally {
		db.close();
	}
}

function setScheduleFixture(dbPath: string): { backupRunAt: string; cleanupRunAt: string } {
	const backupRunAt = '2035-01-02T03:04:05.000Z';
	const cleanupRunAt = '2035-01-03T03:04:05.000Z';
	setBackupSettings(dbPath, { schedule: 'weekly', retentionDays: 30, enabled: true });
	setQueuedScheduledJob(dbPath, 'backup.create', 'backup.create', backupRunAt);
	setQueuedScheduledJob(dbPath, 'backup.cleanup', 'backup.cleanup', cleanupRunAt);
	setQueuedScheduledJob(dbPath, 'logs.cleanup', 'logs.cleanup', cleanupRunAt);
	return { backupRunAt, cleanupRunAt };
}

async function saveGeneralSettings(fields: {
	backupSchedule: string;
	backupRetentionDays: number;
	logRetentionDays: number;
}): Promise<Response> {
	return client.postForm(
		'/settings/general?/save',
		{
			date_format: 'auto',
			arr_apply_default_delay_profiles: 'on',
			backup_enabled: 'on',
			backup_schedule: fields.backupSchedule,
			backup_retention_days: String(fields.backupRetentionDays),
			log_enabled: 'on',
			log_file_logging: 'on',
			log_console_logging: 'on',
			log_retention_days: String(fields.logRetentionDays),
			log_min_level: 'INFO',
			tmdb_api_key: ''
		},
		{ headers: { Origin: ORIGIN } }
	);
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

// ─── Scheduled jobs ─────────────────────────────────────────────────────────

test('PATCH retentionDays preserves queued backup job run times', async () => {
	const dbPath = getDbPath(PORT);
	const { backupRunAt, cleanupRunAt } = setScheduleFixture(dbPath);

	const res = await client.patch('/api/v1/backups/settings', { retentionDays: 14 });
	assertEquals(res.status, 200);

	assertEquals(getScheduledRunAt(dbPath, 'backup.create'), backupRunAt);
	assertEquals(getScheduledRunAt(dbPath, 'backup.cleanup'), cleanupRunAt);
});

test('PATCH schedule recalculates backup job but preserves cleanup job run time', async () => {
	const dbPath = getDbPath(PORT);
	const { backupRunAt, cleanupRunAt } = setScheduleFixture(dbPath);

	const res = await client.patch('/api/v1/backups/settings', { schedule: 'daily' });
	assertEquals(res.status, 200);

	const nextBackupRunAt = getScheduledRunAt(dbPath, 'backup.create');
	assertEquals(nextBackupRunAt === backupRunAt, false);
	assertEquals(getScheduledRunAt(dbPath, 'backup.cleanup'), cleanupRunAt);
});

test('general settings save preserves queued named schedule run times', async () => {
	const dbPath = getDbPath(PORT);
	const { backupRunAt, cleanupRunAt } = setScheduleFixture(dbPath);

	const res = await saveGeneralSettings({
		backupSchedule: 'weekly',
		backupRetentionDays: 21,
		logRetentionDays: 21
	});
	assertEquals(res.status, 200);

	assertEquals(getScheduledRunAt(dbPath, 'backup.create'), backupRunAt);
	assertEquals(getScheduledRunAt(dbPath, 'backup.cleanup'), cleanupRunAt);
	assertEquals(getScheduledRunAt(dbPath, 'logs.cleanup'), cleanupRunAt);
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
