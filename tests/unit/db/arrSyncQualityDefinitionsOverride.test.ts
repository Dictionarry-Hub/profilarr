/**
 * The per-profile quality definitions override on arr_sync_quality_profiles:
 * saved and read with the selection, renamed with the config, and found by
 * the affected-instances query. The narrow write of the instance's default
 * pick leaves the rest of the media management row alone.
 */

import { afterAll, describe, expect, test } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

describe('quality definitions override on profile selections', async () => {
	// Point the app at a fresh folder before anything imports config
	const baseDir = await mkdtemp(join(tmpdir(), 'profilarr-qd-override-'));
	process.env.APP_BASE_PATH = baseDir;

	const { db } = await import('#db/db.ts');
	const { runMigrations } = await import('#db/migrations.ts');
	const { arrInstancesQueries } = await import('#db/queries/arrInstances.ts');
	const { arrSyncQueries } = await import('#db/queries/arrSync.ts');

	afterAll(async () => {
		db.close();
		await rm(baseDir, { recursive: true });
	});

	await db.initialize();
	await runMigrations();

	db.execute(
		`INSERT INTO database_instances (id, uuid, name, repository_url, local_path, enabled) VALUES (1, 'test-uuid', 'Dictionarry', 'https://example.invalid/db.git', '/tmp/db', 1)`
	);
	const instanceId = arrInstancesQueries.create({
		name: 'Sonarr v5',
		type: 'sonarr',
		url: 'http://sonarr-v5.local',
		apiKey: 'test-api-key'
	});

	test('selections save and read the override, null meaning the instance pick', () => {
		arrSyncQueries.saveQualityProfilesSync(
			instanceId,
			[
				{ databaseId: 1, profileName: '1080p Quality', qualityDefinitionsConfigName: 'Series' },
				{ databaseId: 1, profileName: '2160p Quality', qualityDefinitionsConfigName: null }
			],
			{ trigger: 'manual', cron: null }
		);
		const { selections } = arrSyncQueries.getQualityProfilesSync(instanceId);
		expect(selections.map((s) => [s.profileName, s.qualityDefinitionsConfigName])).toStrictEqual([
			['1080p Quality', 'Series'],
			['2160p Quality', null]
		]);
	});

	test('the affected-instances query finds the override', () => {
		const rows = arrSyncQueries.getInstancesForQualityDefinitionsOverride(1, 'Series');
		expect(rows.map((r) => r.instance_id)).toStrictEqual([instanceId]);
		expect(arrSyncQueries.getInstancesForQualityDefinitionsOverride(1, 'Other')).toStrictEqual([]);
	});

	test('renaming a config renames the override and the instance pick', () => {
		arrSyncQueries.saveMediaManagementSync(instanceId, {
			namingDatabaseId: 1,
			namingConfigName: 'Sonarr',
			qualityDefinitionsDatabaseId: 1,
			qualityDefinitionsConfigName: 'Series',
			mediaSettingsDatabaseId: 1,
			mediaSettingsConfigName: 'Sonarr',
			trigger: 'manual',
			cron: null
		});
		const changed = arrSyncQueries.updateQualityDefinitionsConfigName('Series', 'Series v2');
		expect(changed).toStrictEqual(2);
		expect(
			arrSyncQueries.getQualityProfilesSync(instanceId).selections[0].qualityDefinitionsConfigName
		).toStrictEqual('Series v2');
		expect(
			arrSyncQueries.getMediaManagementSync(instanceId).qualityDefinitionsConfigName
		).toStrictEqual('Series v2');
	});

	test('the narrow pick write leaves naming and media settings alone', () => {
		arrSyncQueries.saveQualityDefinitionsSelection(instanceId, 1, 'Movies');
		const mm = arrSyncQueries.getMediaManagementSync(instanceId);
		expect(mm.qualityDefinitionsDatabaseId).toStrictEqual(1);
		expect(mm.qualityDefinitionsConfigName).toStrictEqual('Movies');
		expect(mm.namingConfigName).toStrictEqual('Sonarr');
		expect(mm.mediaSettingsConfigName).toStrictEqual('Sonarr');

		arrSyncQueries.saveQualityDefinitionsSelection(instanceId, null, null);
		expect(
			arrSyncQueries.getMediaManagementSync(instanceId).qualityDefinitionsConfigName
		).toStrictEqual(null);
	});

	test('the narrow pick write creates the row when there is none', () => {
		const other = arrInstancesQueries.create({
			name: 'Sonarr v5 b',
			type: 'sonarr',
			url: 'http://sonarr-v5-b.local',
			apiKey: 'test-api-key'
		});
		arrSyncQueries.saveQualityDefinitionsSelection(other, 1, 'Series v2');
		const mm = arrSyncQueries.getMediaManagementSync(other);
		expect(mm.qualityDefinitionsConfigName).toStrictEqual('Series v2');
		expect(mm.namingConfigName).toStrictEqual(null);
	});
});
