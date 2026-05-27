/**
 * Targeted entity sync
 * Pushes a single entity to an arr instance (inline, no job queue)
 */

import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { arrSyncQueries } from '$db/queries/arrSync.ts';
import { createArrClient } from '$utils/arr/factory.ts';
import { getCache } from '$pcd/index.ts';
import { logger } from '$logger/logger.ts';
import type { ArrType } from '$utils/arr/types.ts';
import type { SyncArrType } from './mappings.ts';

// Quality profile imports
import {
	fetchQualityProfileFromPcd,
	getQualityApiMappings,
	transformQualityProfile
} from './qualityProfiles/transformer.ts';
import { getCustomFormatsForProfile, getCustomFormatsForRegex } from '$pcd/references.ts';
import {
	fetchCustomFormatFromPcd,
	transformCustomFormat,
	syncCustomFormats,
	type PcdCustomFormat
} from './customFormats/index.ts';
import { getByName as getDelayProfileByName } from '$pcd/entities/delayProfiles/index.ts';
import {
	getRadarrByName as getRadarrNaming,
	getSonarrByName as getSonarrNaming
} from '$pcd/entities/mediaManagement/naming/read.ts';
import {
	getRadarrByName as getRadarrQualityDefs,
	getSonarrByName as getSonarrQualityDefs
} from '$pcd/entities/mediaManagement/quality-definitions/read.ts';
import {
	getRadarrByName as getRadarrMediaSettings,
	getSonarrByName as getSonarrMediaSettings
} from '$pcd/entities/mediaManagement/media-settings/read.ts';
import type { RadarrNamingConfig, SonarrNamingConfig } from '$arr/types.ts';
import { transformDelayProfile } from './delayProfiles/transformer.ts';
import {
	applyQualityDefinitionsToArr,
	mergeMediaSettingsConfig,
	mergeRadarrNamingConfig,
	mergeSonarrNamingConfig,
	transformQualityDefinitionsForArr
} from './mediaManagement/transformer.ts';

interface SyncResult {
	success: boolean;
	error?: string;
}

/**
 * Sync a single quality profile to an arr instance
 */
export async function syncQualityProfile(
	instanceId: number,
	databaseId: number,
	profileName: string
): Promise<SyncResult> {
	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) return { success: false, error: 'Instance not found' };

	const cache = getCache(databaseId);
	if (!cache) return { success: false, error: `PCD cache not found for database ${databaseId}` };

	const instanceType = instance.type as SyncArrType;
	const client = createArrClient(instance.type as ArrType, instance.url, instance.api_key);

	try {
		// Fetch the QP from PCD
		const pcdProfile = await fetchQualityProfileFromPcd(cache, profileName, instanceType);
		if (!pcdProfile) {
			return { success: false, error: `Quality profile "${profileName}" not found in PCD` };
		}

		// Check if QP already exists on arr
		const existingProfiles = await client.getQualityProfiles();
		const existingProfile = existingProfiles.find((p) => p.name === profileName);

		const referencedNames = await getCustomFormatsForProfile(cache, profileName, instanceType);
		const pcdFormats = new Map<string, PcdCustomFormat>();
		for (const name of referencedNames) {
			const pcdFormat = await fetchCustomFormatFromPcd(cache, name);
			if (pcdFormat) {
				pcdFormats.set(name, pcdFormat);
			}
		}
		const formatIdMap = await syncCustomFormats(client, instanceId, instanceType, pcdFormats);

		// Get quality API mappings
		const qualityMappings = await getQualityApiMappings(cache, instanceType);

		// Transform
		const arrProfile = transformQualityProfile(
			pcdProfile,
			instanceType,
			qualityMappings,
			formatIdMap
		);
		arrProfile.name = profileName;

		// Push
		if (existingProfile) {
			arrProfile.id = existingProfile.id;
			await client.updateQualityProfile(existingProfile.id, arrProfile);
			await logger.info(`Entity sync: updated quality profile "${profileName}"`, {
				source: 'EntitySync:QualityProfile',
				meta: { instanceId, databaseId, profileName, action: 'updated' }
			});
		} else {
			await client.createQualityProfile(arrProfile);
			await logger.info(`Entity sync: created quality profile "${profileName}"`, {
				source: 'EntitySync:QualityProfile',
				meta: { instanceId, databaseId, profileName, action: 'created' }
			});
		}

		arrSyncQueries.touchSectionLastSynced(instanceId, 'qualityProfiles');

		return { success: true };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Unknown error';
		await logger.error(`Entity sync failed for quality profile "${profileName}"`, {
			source: 'EntitySync:QualityProfile',
			meta: { instanceId, databaseId, profileName, error: errorMsg }
		});
		return { success: false, error: errorMsg };
	} finally {
		client.close();
	}
}

/**
 * Sync a single custom format to an arr instance
 */
export async function syncCustomFormat(
	instanceId: number,
	databaseId: number,
	formatName: string
): Promise<SyncResult> {
	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) return { success: false, error: 'Instance not found' };

	const cache = getCache(databaseId);
	if (!cache) return { success: false, error: `PCD cache not found for database ${databaseId}` };

	const instanceType = instance.type as SyncArrType;
	const client = createArrClient(instance.type as ArrType, instance.url, instance.api_key);

	try {
		const pcdFormat = await fetchCustomFormatFromPcd(cache, formatName);
		if (!pcdFormat) {
			return { success: false, error: `Custom format "${formatName}" not found in PCD` };
		}

		const existingFormats = await client.getCustomFormats();
		const existing = existingFormats.find((f) => f.name === formatName);

		const arrFormat = transformCustomFormat(pcdFormat, instanceType);
		arrFormat.name = formatName;

		if (existing) {
			arrFormat.id = existing.id;
			await client.updateCustomFormat(existing.id!, arrFormat);
			await logger.info(`Entity sync: updated custom format "${formatName}"`, {
				source: 'EntitySync:CustomFormat',
				meta: { instanceId, databaseId, formatName, action: 'updated' }
			});
		} else {
			await client.createCustomFormat(arrFormat);
			await logger.info(`Entity sync: created custom format "${formatName}"`, {
				source: 'EntitySync:CustomFormat',
				meta: { instanceId, databaseId, formatName, action: 'created' }
			});
		}

		arrSyncQueries.touchSectionLastSynced(instanceId, 'qualityProfiles');

		return { success: true };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Unknown error';
		await logger.error(`Entity sync failed for custom format "${formatName}"`, {
			source: 'EntitySync:CustomFormat',
			meta: { instanceId, databaseId, formatName, error: errorMsg }
		});
		return { success: false, error: errorMsg };
	} finally {
		client.close();
	}
}

/**
 * Sync all custom formats affected by a regular expression change
 */
export async function syncRegularExpression(
	instanceId: number,
	databaseId: number,
	regexName: string
): Promise<SyncResult> {
	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) return { success: false, error: 'Instance not found' };

	const cache = getCache(databaseId);
	if (!cache) return { success: false, error: `PCD cache not found for database ${databaseId}` };

	const instanceType = instance.type as SyncArrType;
	const client = createArrClient(instance.type as ArrType, instance.url, instance.api_key);

	try {
		// Find all CFs that use this regex
		const cfNames = await getCustomFormatsForRegex(cache, regexName);
		if (cfNames.length === 0) {
			return { success: true }; // No CFs affected
		}

		const existingFormats = await client.getCustomFormats();
		const existingMap = new Map(existingFormats.map((f) => [f.name, f]));

		let synced = 0;
		for (const cfName of cfNames) {
			const pcdFormat = await fetchCustomFormatFromPcd(cache, cfName);
			if (!pcdFormat) continue;

			const arrFormat = transformCustomFormat(pcdFormat, instanceType);
			arrFormat.name = cfName;

			const existing = existingMap.get(cfName);
			if (existing) {
				arrFormat.id = existing.id;
				await client.updateCustomFormat(existing.id!, arrFormat);
			} else {
				await client.createCustomFormat(arrFormat);
			}
			synced++;
		}

		await logger.info(`Entity sync: synced ${synced} custom format(s) for regex "${regexName}"`, {
			source: 'EntitySync:RegularExpression',
			meta: { instanceId, databaseId, regexName, cfNames, synced }
		});

		arrSyncQueries.touchSectionLastSynced(instanceId, 'qualityProfiles');

		return { success: true };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Unknown error';
		await logger.error(`Entity sync failed for regex "${regexName}"`, {
			source: 'EntitySync:RegularExpression',
			meta: { instanceId, databaseId, regexName, error: errorMsg }
		});
		return { success: false, error: errorMsg };
	} finally {
		client.close();
	}
}

/**
 * Sync a single delay profile to an arr instance (always updates id=1)
 */
export async function syncDelayProfile(
	instanceId: number,
	databaseId: number,
	profileName: string
): Promise<SyncResult> {
	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) return { success: false, error: 'Instance not found' };

	const cache = getCache(databaseId);
	if (!cache) return { success: false, error: `PCD cache not found for database ${databaseId}` };

	const client = createArrClient(instance.type as ArrType, instance.url, instance.api_key);

	try {
		const profile = await getDelayProfileByName(cache, profileName);
		if (!profile) {
			return { success: false, error: `Delay profile "${profileName}" not found in PCD` };
		}

		const transformed = transformDelayProfile(profile);
		await client.updateDelayProfile(1, transformed);

		await logger.info(`Entity sync: updated delay profile "${profileName}"`, {
			source: 'EntitySync:DelayProfile',
			meta: { instanceId, databaseId, profileName }
		});

		arrSyncQueries.touchSectionLastSynced(instanceId, 'delayProfiles');

		return { success: true };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Unknown error';
		await logger.error(`Entity sync failed for delay profile "${profileName}"`, {
			source: 'EntitySync:DelayProfile',
			meta: { instanceId, databaseId, profileName, error: errorMsg }
		});
		return { success: false, error: errorMsg };
	} finally {
		client.close();
	}
}

/**
 * Sync a naming config to an arr instance
 * Merges PCD naming fields into the existing arr naming config
 */
export async function syncNaming(
	instanceId: number,
	databaseId: number,
	configName: string
): Promise<SyncResult> {
	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) return { success: false, error: 'Instance not found' };

	const cache = getCache(databaseId);
	if (!cache) return { success: false, error: `PCD cache not found for database ${databaseId}` };

	const client = createArrClient(instance.type as ArrType, instance.url, instance.api_key);

	try {
		if (instance.type === 'radarr') {
			const naming = await getRadarrNaming(cache, configName);
			if (!naming) {
				return { success: false, error: `Radarr naming config "${configName}" not found in PCD` };
			}

			const existing = (await client.getNamingConfig()) as RadarrNamingConfig;
			const updated = mergeRadarrNamingConfig(existing, naming);
			await client.updateNamingConfig(updated);
		} else if (instance.type === 'sonarr') {
			const naming = await getSonarrNaming(cache, configName);
			if (!naming) {
				return { success: false, error: `Sonarr naming config "${configName}" not found in PCD` };
			}

			const existing = (await client.getNamingConfig()) as SonarrNamingConfig;
			const updated = mergeSonarrNamingConfig(existing, naming);
			await client.updateNamingConfig(updated);
		} else {
			return { success: false, error: `Unsupported instance type: ${instance.type}` };
		}

		await logger.info(`Entity sync: updated naming config "${configName}"`, {
			source: 'EntitySync:Naming',
			meta: { instanceId, databaseId, configName, arrType: instance.type }
		});

		arrSyncQueries.touchSectionLastSynced(instanceId, 'mediaManagement');

		return { success: true };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Unknown error';
		await logger.error(`Entity sync failed for naming config "${configName}"`, {
			source: 'EntitySync:Naming',
			meta: { instanceId, databaseId, configName, error: errorMsg }
		});
		return { success: false, error: errorMsg };
	} finally {
		client.close();
	}
}

/**
 * Sync quality definitions to an arr instance
 * Fetches PCD definitions, maps to arr API names, updates arr definitions
 */
export async function syncQualityDefinitions(
	instanceId: number,
	databaseId: number,
	configName: string
): Promise<SyncResult> {
	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) return { success: false, error: 'Instance not found' };

	const cache = getCache(databaseId);
	if (!cache) return { success: false, error: `PCD cache not found for database ${databaseId}` };

	const instanceType = instance.type as SyncArrType;
	const client = createArrClient(instance.type as ArrType, instance.url, instance.api_key);

	try {
		const getByName = instanceType === 'radarr' ? getRadarrQualityDefs : getSonarrQualityDefs;
		const qualityDefsConfig = await getByName(cache, configName);

		if (!qualityDefsConfig) {
			return {
				success: false,
				error: `Quality definitions config "${configName}" not found in PCD`
			};
		}

		if (qualityDefsConfig.entries.length === 0) {
			return { success: false, error: `Quality definitions config "${configName}" has no entries` };
		}

		// Get quality API mappings (quality_name -> api_name)
		const apiMappings = await getQualityApiMappings(cache, instanceType);

		// GET existing quality definitions from arr
		const arrDefinitions = await client.getQualityDefinitions();

		const transformed = transformQualityDefinitionsForArr(qualityDefsConfig.entries, apiMappings);
		const { updatedCount } = applyQualityDefinitionsToArr(arrDefinitions, transformed.definitions);

		if (updatedCount === 0) {
			return { success: false, error: 'No quality definitions matched for update' };
		}

		// PUT the full array back
		await client.updateQualityDefinitions(arrDefinitions);

		await logger.info(
			`Entity sync: updated ${updatedCount} quality definitions for "${configName}"`,
			{
				source: 'EntitySync:QualityDefinitions',
				meta: { instanceId, databaseId, configName, updatedCount }
			}
		);

		arrSyncQueries.touchSectionLastSynced(instanceId, 'mediaManagement');

		return { success: true };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Unknown error';
		await logger.error(`Entity sync failed for quality definitions "${configName}"`, {
			source: 'EntitySync:QualityDefinitions',
			meta: { instanceId, databaseId, configName, error: errorMsg }
		});
		return { success: false, error: errorMsg };
	} finally {
		client.close();
	}
}

/**
 * Sync media settings to an arr instance
 * Merges PCD media settings fields into the existing arr media management config
 */
export async function syncMediaSettings(
	instanceId: number,
	databaseId: number,
	configName: string
): Promise<SyncResult> {
	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) return { success: false, error: 'Instance not found' };

	const cache = getCache(databaseId);
	if (!cache) return { success: false, error: `PCD cache not found for database ${databaseId}` };

	const client = createArrClient(instance.type as ArrType, instance.url, instance.api_key);

	try {
		const getByName = instance.type === 'radarr' ? getRadarrMediaSettings : getSonarrMediaSettings;
		const mediaSettings = await getByName(cache, configName);

		if (!mediaSettings) {
			return { success: false, error: `Media settings config "${configName}" not found in PCD` };
		}

		const existing = await client.getMediaManagementConfig();
		const updated = mergeMediaSettingsConfig(existing, mediaSettings);
		await client.updateMediaManagementConfig(updated);

		await logger.info(`Entity sync: updated media settings "${configName}"`, {
			source: 'EntitySync:MediaSettings',
			meta: { instanceId, databaseId, configName, arrType: instance.type }
		});

		arrSyncQueries.touchSectionLastSynced(instanceId, 'mediaManagement');

		return { success: true };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : 'Unknown error';
		await logger.error(`Entity sync failed for media settings "${configName}"`, {
			source: 'EntitySync:MediaSettings',
			meta: { instanceId, databaseId, configName, error: errorMsg }
		});
		return { success: false, error: errorMsg };
	} finally {
		client.close();
	}
}
