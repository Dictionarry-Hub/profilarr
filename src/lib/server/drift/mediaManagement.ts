import { arrSyncQueries } from '$db/queries/arrSync.ts';
import type { BaseArrClient } from '$arr/base.ts';
import type { ArrMediaManagementConfig } from '$arr/types.ts';
import type { SyncArrType } from '$sync/mappings.ts';
import { getCache } from '$pcd/index.ts';
import {
	getRadarrByName as getRadarrMediaSettings,
	getSonarrByName as getSonarrMediaSettings
} from '$pcd/entities/mediaManagement/media-settings/read.ts';
import {
	transformMediaSettings,
	type ArrMediaSettingsManagedFields
} from '$sync/mediaManagement/transformer.ts';
import type { DriftFieldDiff } from './customFormats.ts';
import { stringifyCanonical } from './hash.ts';

export interface MediaSettingsMissingDiff {
	name: string;
}

export interface MediaSettingsModifiedDiff {
	name: string;
	fields: DriftFieldDiff[];
}

export interface MediaSettingsDriftDiff {
	missing: MediaSettingsMissingDiff[];
	modified: MediaSettingsModifiedDiff[];
}

export interface MediaManagementDriftDiff {
	media_settings: MediaSettingsDriftDiff;
}

export interface MediaManagementDriftResult {
	count: number;
	diff: MediaManagementDriftDiff;
}

export interface MediaSettingsDriftExpected extends ArrMediaSettingsManagedFields {
	name: string;
}

const FIELD_ORDER = ['downloadPropersAndRepacks', 'enableMediaInfo'] as const;

function emptyDiff(): MediaManagementDriftDiff {
	return { media_settings: { missing: [], modified: [] } };
}

function valuesEqual(expected: unknown, actual: unknown): boolean {
	return stringifyCanonical(expected) === stringifyCanonical(actual);
}

function compareMediaSettings(
	expected: MediaSettingsDriftExpected,
	actual: ArrMediaManagementConfig | null
): DriftFieldDiff[] | null {
	if (!actual) return null;

	const diffs: DriftFieldDiff[] = [];
	for (const field of FIELD_ORDER) {
		if (!valuesEqual(expected[field], actual[field])) {
			diffs.push({
				path: field,
				expected: expected[field],
				actual: actual[field]
			});
		}
	}
	return diffs;
}

export function compareMediaManagementDrift(
	expected: MediaSettingsDriftExpected | null,
	actual: ArrMediaManagementConfig | null
): MediaManagementDriftResult {
	const diff = emptyDiff();
	if (!expected) return { count: 0, diff };

	const fields = compareMediaSettings(expected, actual);
	if (!fields) {
		diff.media_settings.missing.push({ name: expected.name });
		return { count: 1, diff };
	}

	if (fields.length > 0) {
		diff.media_settings.modified.push({ name: expected.name, fields });
	}

	return {
		count: diff.media_settings.missing.length + diff.media_settings.modified.length,
		diff
	};
}

export async function buildExpectedMediaSettings(
	instanceId: number,
	arrType: SyncArrType
): Promise<MediaSettingsDriftExpected | null> {
	const syncConfig = arrSyncQueries.getMediaManagementSync(instanceId);
	if (!syncConfig.mediaSettingsDatabaseId || !syncConfig.mediaSettingsConfigName) return null;

	const cache = getCache(syncConfig.mediaSettingsDatabaseId);
	if (!cache) {
		throw new Error(`PCD cache not found for database ${syncConfig.mediaSettingsDatabaseId}`);
	}

	const getByName = arrType === 'radarr' ? getRadarrMediaSettings : getSonarrMediaSettings;
	const mediaSettings = await getByName(cache, syncConfig.mediaSettingsConfigName);
	if (!mediaSettings) {
		throw new Error(
			`Media settings "${syncConfig.mediaSettingsConfigName}" not found in database ${syncConfig.mediaSettingsDatabaseId}`
		);
	}

	return {
		name: syncConfig.mediaSettingsConfigName,
		...transformMediaSettings(mediaSettings)
	};
}

export async function checkMediaManagementDrift(
	client: Pick<BaseArrClient, 'getMediaManagementConfig'>,
	instanceId: number,
	arrType: SyncArrType
): Promise<MediaManagementDriftResult> {
	const expected = await buildExpectedMediaSettings(instanceId, arrType);
	if (!expected) return compareMediaManagementDrift(null, null);

	const actual = await client.getMediaManagementConfig();
	return compareMediaManagementDrift(expected, actual);
}
