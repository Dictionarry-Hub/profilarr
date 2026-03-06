/**
 * Affected arrs lookup
 * Determines which arr instances are affected by an entity change
 */

import { arrSyncQueries } from '$db/queries/arrSync.ts';
import { getCache } from '$pcd/index.ts';
import type { AffectedArr } from '$shared/sync/types.ts';

type EntityType =
	| 'qualityProfile'
	| 'customFormat'
	| 'regularExpression'
	| 'delayProfile'
	| 'naming'
	| 'qualityDefinitions'
	| 'mediaSettings';

/**
 * Find all arr instances affected by an entity change
 */
export function getAffectedArrs({
	entityType,
	databaseId,
	entityName
}: {
	entityType: EntityType;
	databaseId: number;
	entityName: string;
}): AffectedArr[] {
	try {
		switch (entityType) {
			case 'qualityProfile':
				return getAffectedArrsForQualityProfile(databaseId, entityName);
			case 'customFormat':
				return getAffectedArrsForCustomFormat(databaseId, entityName);
			case 'regularExpression':
				return getAffectedArrsForRegularExpression(databaseId, entityName);
			case 'delayProfile':
				return getAffectedArrsForDelayProfile(databaseId, entityName);
			case 'naming':
				return getAffectedArrsForNaming(databaseId, entityName);
			case 'qualityDefinitions':
				return getAffectedArrsForQualityDefinitions(databaseId, entityName);
			case 'mediaSettings':
				return getAffectedArrsForMediaSettings(databaseId, entityName);
			default:
				return [];
		}
	} catch {
		return [];
	}
}

function getAffectedArrsForQualityProfile(databaseId: number, profileName: string): AffectedArr[] {
	const rows = arrSyncQueries.getInstancesForQualityProfile(databaseId, profileName);

	return rows.map((row) => ({
		instanceId: row.instance_id,
		instanceName: row.instance_name,
		sections: [
			{
				section: 'qualityProfiles' as const,
				syncStatus: row.sync_status,
				lastSyncedAt: row.last_synced_at
			}
		]
	}));
}

function getAffectedArrsForCustomFormat(databaseId: number, cfName: string): AffectedArr[] {
	const cache = getCache(databaseId);
	if (!cache) return [];

	// CF → QPs that reference it
	const profileRows = cache.query<{ quality_profile_name: string }>(
		`SELECT DISTINCT quality_profile_name FROM quality_profile_custom_formats WHERE custom_format_name = ?`,
		cfName
	);

	if (profileRows.length === 0) return [];

	return collectInstancesForProfiles(
		databaseId,
		profileRows.map((r) => r.quality_profile_name)
	);
}

function getAffectedArrsForRegularExpression(databaseId: number, regexName: string): AffectedArr[] {
	const cache = getCache(databaseId);
	if (!cache) return [];

	// Regex → CFs that use it
	const cfRows = cache.query<{ custom_format_name: string }>(
		`SELECT DISTINCT custom_format_name FROM condition_patterns WHERE regular_expression_name = ?`,
		regexName
	);

	if (cfRows.length === 0) return [];

	// CFs → QPs that reference them
	const profileNames = new Set<string>();
	for (const row of cfRows) {
		const profileRows = cache.query<{ quality_profile_name: string }>(
			`SELECT DISTINCT quality_profile_name FROM quality_profile_custom_formats WHERE custom_format_name = ?`,
			row.custom_format_name
		);
		for (const pr of profileRows) profileNames.add(pr.quality_profile_name);
	}

	if (profileNames.size === 0) return [];

	return collectInstancesForProfiles(databaseId, [...profileNames]);
}

function getAffectedArrsForNaming(databaseId: number, configName: string): AffectedArr[] {
	const rows = arrSyncQueries.getInstancesForNaming(databaseId, configName);

	return rows.map((row) => ({
		instanceId: row.instance_id,
		instanceName: row.instance_name,
		sections: [
			{
				section: 'mediaManagement' as const,
				syncStatus: row.sync_status,
				lastSyncedAt: row.last_synced_at
			}
		]
	}));
}

function getAffectedArrsForDelayProfile(databaseId: number, profileName: string): AffectedArr[] {
	const rows = arrSyncQueries.getInstancesForDelayProfile(databaseId, profileName);

	return rows.map((row) => ({
		instanceId: row.instance_id,
		instanceName: row.instance_name,
		sections: [
			{
				section: 'delayProfiles' as const,
				syncStatus: row.sync_status,
				lastSyncedAt: row.last_synced_at
			}
		]
	}));
}

function getAffectedArrsForMediaSettings(databaseId: number, configName: string): AffectedArr[] {
	const rows = arrSyncQueries.getInstancesForMediaSettings(databaseId, configName);

	return rows.map((row) => ({
		instanceId: row.instance_id,
		instanceName: row.instance_name,
		sections: [
			{
				section: 'mediaManagement' as const,
				syncStatus: row.sync_status,
				lastSyncedAt: row.last_synced_at
			}
		]
	}));
}

function getAffectedArrsForQualityDefinitions(
	databaseId: number,
	configName: string
): AffectedArr[] {
	const rows = arrSyncQueries.getInstancesForQualityDefinitions(databaseId, configName);

	return rows.map((row) => ({
		instanceId: row.instance_id,
		instanceName: row.instance_name,
		sections: [
			{
				section: 'mediaManagement' as const,
				syncStatus: row.sync_status,
				lastSyncedAt: row.last_synced_at
			}
		]
	}));
}

/**
 * Given profile names, find all arr instances that sync them (deduplicated)
 */
function collectInstancesForProfiles(databaseId: number, profileNames: string[]): AffectedArr[] {
	const instanceMap = new Map<number, AffectedArr>();

	for (const profileName of profileNames) {
		const instances = arrSyncQueries.getInstancesForQualityProfile(databaseId, profileName);
		for (const inst of instances) {
			if (!instanceMap.has(inst.instance_id)) {
				instanceMap.set(inst.instance_id, {
					instanceId: inst.instance_id,
					instanceName: inst.instance_name,
					sections: [
						{
							section: 'qualityProfiles' as const,
							syncStatus: inst.sync_status,
							lastSyncedAt: inst.last_synced_at
						}
					]
				});
			}
		}
	}

	return [...instanceMap.values()];
}
