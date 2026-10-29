/**
 * The detected version columns on arr_instances: null after create, written
 * by `updateDetectedVersion`, and not counted as a user edit (updated_at
 * stays put).
 */

import { afterAll, describe, test } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { assertEquals } from '@std/assert';

describe('arr_instances detected version columns', async () => {
	// Point the app at a fresh folder before anything imports config
	const baseDir = await mkdtemp(join(tmpdir(), 'profilarr-detected-version-'));
	process.env.APP_BASE_PATH = baseDir;

	const { db } = await import('#db/db.ts');
	const { runMigrations } = await import('#db/migrations.ts');
	const { arrInstancesQueries } = await import('#db/queries/arrInstances.ts');

	afterAll(async () => {
		db.close();
		await rm(baseDir, { recursive: true });
	});

	await db.initialize();
	await runMigrations();

	const id = arrInstancesQueries.create({
		name: 'Sonarr v5',
		type: 'sonarr',
		url: 'http://sonarr-v5.local',
		apiKey: 'test-api-key'
	});

	test('a new instance has nothing detected', () => {
		const row = arrInstancesQueries.getById(id)!;
		assertEquals(row.detected_version, null);
		assertEquals(row.detected_api, null);
		assertEquals(row.detected_at, null);
	});

	test('updateDetectedVersion stores the probe result', () => {
		const before = arrInstancesQueries.getById(id)!;
		arrInstancesQueries.updateDetectedVersion(id, {
			version: '5.0.0.2569',
			api: 'v5',
			checkedAt: '2026-10-15T01:46:05.000Z'
		});
		const row = arrInstancesQueries.getById(id)!;
		assertEquals(row.detected_version, '5.0.0.2569');
		assertEquals(row.detected_api, 'v5');
		assertEquals(row.detected_at, '2026-10-15T01:46:05.000Z');
		assertEquals(row.updated_at, before.updated_at);
	});

	test('a null API generation is stored as null', () => {
		arrInstancesQueries.updateDetectedVersion(id, { version: '4.0.20.3014', api: null });
		const row = arrInstancesQueries.getById(id)!;
		assertEquals(row.detected_version, '4.0.20.3014');
		assertEquals(row.detected_api, null);
		assertEquals(typeof row.detected_at, 'string');
	});
});
