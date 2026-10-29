/**
 * The detected version columns on arr_instances: null after create, written
 * by `updateDetectedVersion`, and not counted as a user edit (updated_at
 * stays put).
 */

import { afterAll, describe, expect, test } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

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
		expect(row.detected_version).toStrictEqual(null);
		expect(row.detected_api).toStrictEqual(null);
		expect(row.detected_at).toStrictEqual(null);
	});

	test('updateDetectedVersion stores the probe result', () => {
		const before = arrInstancesQueries.getById(id)!;
		arrInstancesQueries.updateDetectedVersion(id, {
			version: '5.0.0.2569',
			api: 'v5',
			checkedAt: '2026-10-15T01:46:05.000Z'
		});
		const row = arrInstancesQueries.getById(id)!;
		expect(row.detected_version).toStrictEqual('5.0.0.2569');
		expect(row.detected_api).toStrictEqual('v5');
		expect(row.detected_at).toStrictEqual('2026-10-15T01:46:05.000Z');
		expect(row.updated_at).toStrictEqual(before.updated_at);
	});

	test('a null API generation is stored as null', () => {
		arrInstancesQueries.updateDetectedVersion(id, { version: '4.0.20.3014', api: null });
		const row = arrInstancesQueries.getById(id)!;
		expect(row.detected_version).toStrictEqual('4.0.20.3014');
		expect(row.detected_api).toStrictEqual(null);
		expect(typeof row.detected_at).toStrictEqual('string');
	});
});
