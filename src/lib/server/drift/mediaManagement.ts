import { arrSyncQueries } from '$db/queries/arrSync.ts';
import type { BaseArrClient } from '$arr/base.ts';
import type {
	ArrMediaManagementConfig,
	ArrNamingConfig,
	ArrQualityDefinition
} from '$arr/types.ts';
import type { SyncArrType } from '$sync/mappings.ts';
import { getCache } from '$pcd/index.ts';
import {
	getRadarrByName as getRadarrMediaSettings,
	getSonarrByName as getSonarrMediaSettings
} from '$pcd/entities/mediaManagement/media-settings/read.ts';
import {
	getRadarrByName as getRadarrNaming,
	getSonarrByName as getSonarrNaming
} from '$pcd/entities/mediaManagement/naming/read.ts';
import {
	getRadarrByName as getRadarrQualityDefs,
	getSonarrByName as getSonarrQualityDefs
} from '$pcd/entities/mediaManagement/quality-definitions/read.ts';
import {
	normalizeArrQualityDefinition,
	normalizeNamingConfig,
	transformMediaSettings,
	transformNamingForDrift,
	transformQualityDefinitionsForArr,
	type ArrMediaSettingsManagedFields,
	type MappedQualityDefinition,
	type NormalizedNamingManagedFields
} from '$sync/mediaManagement/transformer.ts';
import { getQualityApiMappings } from '$sync/qualityProfiles/transformer.ts';
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

export interface NamingMissingDiff {
	name: string;
}

export interface NamingModifiedDiff {
	name: string;
	fields: DriftFieldDiff[];
}

export interface NamingDriftDiff {
	missing: NamingMissingDiff[];
	modified: NamingModifiedDiff[];
}

export interface QualityDefinitionsMissingDiff {
	name: string;
}

export interface QualityDefinitionsModifiedDiff {
	name: string;
	fields: DriftFieldDiff[];
}

export interface QualityDefinitionsDriftDiff {
	missing: QualityDefinitionsMissingDiff[];
	modified: QualityDefinitionsModifiedDiff[];
}

export interface MediaManagementDriftDiff {
	media_settings: MediaSettingsDriftDiff;
	naming: NamingDriftDiff;
	quality_definitions: QualityDefinitionsDriftDiff;
}

export interface MediaManagementDriftResult {
	count: number;
	diff: MediaManagementDriftDiff;
}

export interface MediaSettingsDriftExpected extends ArrMediaSettingsManagedFields {
	name: string;
}

export interface NamingDriftExpected {
	name: string;
	arrType: SyncArrType;
	fields: NormalizedNamingManagedFields;
}

export interface QualityDefinitionsDriftExpected {
	name: string;
	definitions: MappedQualityDefinition[];
}

const MEDIA_SETTINGS_FIELD_ORDER = ['downloadPropersAndRepacks', 'enableMediaInfo'] as const;
const NAMING_FIELD_ORDER: Record<SyncArrType, string[]> = {
	radarr: [
		'renameMovies',
		'replaceIllegalCharacters',
		'colonReplacementFormat',
		'standardMovieFormat',
		'movieFolderFormat'
	],
	sonarr: [
		'renameEpisodes',
		'replaceIllegalCharacters',
		'colonReplacementFormat',
		'customColonReplacementFormat',
		'multiEpisodeStyle',
		'standardEpisodeFormat',
		'dailyEpisodeFormat',
		'animeEpisodeFormat',
		'seriesFolderFormat',
		'seasonFolderFormat'
	]
};
const QUALITY_DEFINITION_FIELD_ORDER = ['minSize', 'maxSize', 'preferredSize'] as const;

function emptyDiff(): MediaManagementDriftDiff {
	return {
		media_settings: { missing: [], modified: [] },
		naming: { missing: [], modified: [] },
		quality_definitions: { missing: [], modified: [] }
	};
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
	for (const field of MEDIA_SETTINGS_FIELD_ORDER) {
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

function fieldValue(fields: NormalizedNamingManagedFields, field: string): unknown {
	return (fields as unknown as Record<string, unknown>)[field];
}

function compareNaming(
	expected: NamingDriftExpected,
	actual: ArrNamingConfig | null
): DriftFieldDiff[] | null {
	if (!actual) return null;

	const actualFields = normalizeNamingConfig(actual, expected.arrType);
	const diffs: DriftFieldDiff[] = [];
	for (const field of NAMING_FIELD_ORDER[expected.arrType]) {
		const expectedValue = fieldValue(expected.fields, field);
		const actualValue = fieldValue(actualFields, field);
		if (!valuesEqual(expectedValue, actualValue)) {
			diffs.push({
				path: field,
				expected: expectedValue,
				actual: actualValue
			});
		}
	}
	return diffs;
}

function compareQualityDefinitions(
	expected: QualityDefinitionsDriftExpected,
	actual: ArrQualityDefinition[] | null
): DriftFieldDiff[] | null {
	if (!actual) return null;

	const actualMap = new Map<string, ArrQualityDefinition>();
	for (const definition of actual) {
		if (definition.quality.name) {
			actualMap.set(definition.quality.name.toLowerCase(), definition);
		}
	}

	const diffs: DriftFieldDiff[] = [];
	for (const definition of expected.definitions) {
		const actualDefinition = actualMap.get(definition.qualityName.toLowerCase());
		if (!actualDefinition) continue;

		const actualFields = normalizeArrQualityDefinition(actualDefinition);
		for (const field of QUALITY_DEFINITION_FIELD_ORDER) {
			const expectedValue = definition.fields[field];
			const actualValue = actualFields[field];
			if (!valuesEqual(expectedValue, actualValue)) {
				diffs.push({
					path: `qualityDefinitions[${definition.qualityName}].${field}`,
					expected: expectedValue,
					actual: actualValue
				});
			}
		}
	}

	return diffs;
}

export function compareMediaManagementDrift(
	expected: MediaSettingsDriftExpected | null,
	actual: ArrMediaManagementConfig | null,
	expectedNaming: NamingDriftExpected | null = null,
	actualNaming: ArrNamingConfig | null = null,
	expectedQualityDefinitions: QualityDefinitionsDriftExpected | null = null,
	actualQualityDefinitions: ArrQualityDefinition[] | null = null
): MediaManagementDriftResult {
	const diff = emptyDiff();

	if (expected) {
		const fields = compareMediaSettings(expected, actual);
		if (!fields) {
			diff.media_settings.missing.push({ name: expected.name });
		} else if (fields.length > 0) {
			diff.media_settings.modified.push({ name: expected.name, fields });
		}
	}

	if (expectedNaming) {
		const fields = compareNaming(expectedNaming, actualNaming);
		if (!fields) {
			diff.naming.missing.push({ name: expectedNaming.name });
		} else if (fields.length > 0) {
			diff.naming.modified.push({ name: expectedNaming.name, fields });
		}
	}

	if (expectedQualityDefinitions) {
		const fields = compareQualityDefinitions(expectedQualityDefinitions, actualQualityDefinitions);
		if (!fields) {
			diff.quality_definitions.missing.push({ name: expectedQualityDefinitions.name });
		} else if (fields.length > 0) {
			diff.quality_definitions.modified.push({ name: expectedQualityDefinitions.name, fields });
		}
	}

	return {
		count:
			diff.media_settings.missing.length +
			diff.media_settings.modified.length +
			diff.naming.missing.length +
			diff.naming.modified.length +
			diff.quality_definitions.missing.length +
			diff.quality_definitions.modified.length,
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

export async function buildExpectedNaming(
	instanceId: number,
	arrType: SyncArrType
): Promise<NamingDriftExpected | null> {
	const syncConfig = arrSyncQueries.getMediaManagementSync(instanceId);
	if (!syncConfig.namingDatabaseId || !syncConfig.namingConfigName) return null;

	const cache = getCache(syncConfig.namingDatabaseId);
	if (!cache) {
		throw new Error(`PCD cache not found for database ${syncConfig.namingDatabaseId}`);
	}

	const getByName = arrType === 'radarr' ? getRadarrNaming : getSonarrNaming;
	const naming = await getByName(cache, syncConfig.namingConfigName);
	if (!naming) {
		throw new Error(
			`Naming config "${syncConfig.namingConfigName}" not found in database ${syncConfig.namingDatabaseId}`
		);
	}

	return {
		name: syncConfig.namingConfigName,
		arrType,
		fields: transformNamingForDrift(naming, arrType)
	};
}

export async function buildExpectedQualityDefinitions(
	instanceId: number,
	arrType: SyncArrType
): Promise<QualityDefinitionsDriftExpected | null> {
	const syncConfig = arrSyncQueries.getMediaManagementSync(instanceId);
	if (!syncConfig.qualityDefinitionsDatabaseId || !syncConfig.qualityDefinitionsConfigName) {
		return null;
	}

	const cache = getCache(syncConfig.qualityDefinitionsDatabaseId);
	if (!cache) {
		throw new Error(`PCD cache not found for database ${syncConfig.qualityDefinitionsDatabaseId}`);
	}

	const getByName = arrType === 'radarr' ? getRadarrQualityDefs : getSonarrQualityDefs;
	const qualityDefinitions = await getByName(cache, syncConfig.qualityDefinitionsConfigName);
	if (!qualityDefinitions) {
		throw new Error(
			`Quality definitions "${syncConfig.qualityDefinitionsConfigName}" not found in database ${syncConfig.qualityDefinitionsDatabaseId}`
		);
	}

	const apiMappings = await getQualityApiMappings(cache, arrType);
	const { definitions } = transformQualityDefinitionsForArr(
		qualityDefinitions.entries,
		apiMappings
	);
	return {
		name: syncConfig.qualityDefinitionsConfigName,
		definitions
	};
}

export async function checkMediaManagementDrift(
	client: Pick<
		BaseArrClient,
		'getMediaManagementConfig' | 'getNamingConfig' | 'getQualityDefinitions'
	>,
	instanceId: number,
	arrType: SyncArrType
): Promise<MediaManagementDriftResult> {
	const [expectedMediaSettings, expectedNaming, expectedQualityDefinitions] = await Promise.all([
		buildExpectedMediaSettings(instanceId, arrType),
		buildExpectedNaming(instanceId, arrType),
		buildExpectedQualityDefinitions(instanceId, arrType)
	]);
	if (!expectedMediaSettings && !expectedNaming && !expectedQualityDefinitions) {
		return compareMediaManagementDrift(null, null);
	}

	const [actualMediaSettings, actualNaming, actualQualityDefinitions] = await Promise.all([
		expectedMediaSettings ? client.getMediaManagementConfig() : Promise.resolve(null),
		expectedNaming ? client.getNamingConfig() : Promise.resolve(null),
		expectedQualityDefinitions ? client.getQualityDefinitions() : Promise.resolve(null)
	]);
	return compareMediaManagementDrift(
		expectedMediaSettings,
		actualMediaSettings,
		expectedNaming,
		actualNaming,
		expectedQualityDefinitions,
		actualQualityDefinitions
	);
}
