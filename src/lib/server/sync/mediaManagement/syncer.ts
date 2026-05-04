/**
 * Media management syncer
 * Syncs media management settings from PCD to arr instances
 *
 * Handles three types of configs:
 * 1. Media Settings (downloadPropersAndRepacks, enableMediaInfo)
 * 2. Naming (movie/episode naming formats, folder formats)
 * 3. Quality Definitions
 *
 * Flow for each:
 * 1. GET existing config from arr
 * 2. Fetch settings from PCD
 * 3. Modify only the fields we care about
 * 4. PUT the full config back to arr
 */

import { BaseSyncer, type SyncResult } from '../base.ts';
import type { SyncedItem } from '../types.ts';
import { arrSyncQueries } from '$db/queries/arrSync.ts';
import { getCache, type PCDCache } from '$pcd/index.ts';
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
import type { RadarrMediaSettingsRow, SonarrMediaSettingsRow } from '$shared/pcd/display.ts';
import type { ArrType, RadarrNamingConfig, SonarrNamingConfig } from '$arr/types.ts';
import {
	applyQualityDefinitionsToArr,
	mergeMediaSettingsConfig,
	mergeRadarrNamingConfig,
	mergeSonarrNamingConfig,
	transformQualityDefinitionsForArr
} from './transformer.ts';
import { logger } from '$logger/logger.ts';

export class MediaManagementSyncer extends BaseSyncer {
	private instanceType: ArrType;

	constructor(
		client: ConstructorParameters<typeof BaseSyncer>[0],
		instanceId: number,
		instanceName: string,
		instanceType: ArrType
	) {
		super(client, instanceId, instanceName);
		this.instanceType = instanceType;
	}

	protected get syncType(): string {
		return 'media management';
	}

	/**
	 * Override sync to handle multiple config types
	 */
	override async sync(): Promise<SyncResult> {
		const syncConfig = arrSyncQueries.getMediaManagementSync(this.instanceId);
		let totalSynced = 0;
		const errors: string[] = [];
		const items: SyncedItem[] = [];

		// Sync media settings if configured (both database and config name required)
		if (syncConfig.mediaSettingsDatabaseId && syncConfig.mediaSettingsConfigName) {
			try {
				const synced = await this.syncMediaSettings(
					syncConfig.mediaSettingsDatabaseId,
					syncConfig.mediaSettingsConfigName
				);
				if (synced) {
					totalSynced++;
					items.push({ name: 'Media Settings', action: 'updated' });
				}
			} catch (error) {
				const msg = error instanceof Error ? error.message : 'Unknown error';
				errors.push(`Media settings: ${msg}`);
				await logger.error(`Failed to sync media settings`, {
					source: 'Sync:MediaManagement',
					meta: { instanceId: this.instanceId, error: msg }
				});
			}
		}

		// Sync naming if configured (both database and config name required)
		if (syncConfig.namingDatabaseId && syncConfig.namingConfigName) {
			try {
				const synced = await this.syncNaming(
					syncConfig.namingDatabaseId,
					syncConfig.namingConfigName
				);
				if (synced) {
					totalSynced++;
					items.push({ name: 'Naming', action: 'updated' });
				}
			} catch (error) {
				const msg = error instanceof Error ? error.message : 'Unknown error';
				errors.push(`Naming: ${msg}`);
				await logger.error(`Failed to sync naming`, {
					source: 'Sync:MediaManagement',
					meta: { instanceId: this.instanceId, error: msg }
				});
			}
		}

		// Sync quality definitions if configured (both database and config name required)
		if (syncConfig.qualityDefinitionsDatabaseId && syncConfig.qualityDefinitionsConfigName) {
			try {
				const synced = await this.syncQualityDefinitions(
					syncConfig.qualityDefinitionsDatabaseId,
					syncConfig.qualityDefinitionsConfigName
				);
				if (synced) {
					totalSynced++;
					items.push({ name: 'Quality Definitions', action: 'updated' });
				}
			} catch (error) {
				const msg = error instanceof Error ? error.message : 'Unknown error';
				errors.push(`Quality definitions: ${msg}`);
				await logger.error(`Failed to sync quality definitions`, {
					source: 'Sync:MediaManagement',
					meta: { instanceId: this.instanceId, error: msg }
				});
			}
		}

		const success = errors.length === 0;
		const result: SyncResult = {
			success,
			itemsSynced: totalSynced,
			error: errors.length > 0 ? errors.join('; ') : undefined,
			items: items.length > 0 ? items : undefined
		};

		await logger.info(`Completed media management sync for "${this.instanceName}"`, {
			source: 'Sync:MediaManagement',
			meta: { instanceId: this.instanceId, ...result }
		});

		return result;
	}

	// =========================================================================
	// Media Settings
	// =========================================================================

	private async syncMediaSettings(databaseId: number, configName: string): Promise<boolean> {
		const cache = getCache(databaseId);
		if (!cache) {
			await logger.warn(`PCD cache not found for database ${databaseId}`, {
				source: 'Sync:MediaSettings',
				meta: { instanceId: this.instanceId }
			});
			return false;
		}

		// Fetch from PCD by config name
		let mediaSettings: RadarrMediaSettingsRow | SonarrMediaSettingsRow | null = null;
		if (this.instanceType === 'radarr') {
			mediaSettings = await getRadarrMediaSettings(cache, configName);
		} else if (this.instanceType === 'sonarr') {
			mediaSettings = await getSonarrMediaSettings(cache, configName);
		}

		if (!mediaSettings) {
			await logger.debug(`Media settings config "${configName}" not found in PCD`, {
				source: 'Sync:MediaSettings',
				meta: { instanceId: this.instanceId, configName }
			});
			return false;
		}

		// GET existing config
		const existingConfig = await this.client.getMediaManagementConfig();

		// Transform and update
		const updatedConfig = mergeMediaSettingsConfig(existingConfig, mediaSettings);

		await logger.debug('Updating media settings', {
			source: 'Sync:MediaSettings',
			meta: {
				instanceId: this.instanceId,
				configName,
				propersRepacks: updatedConfig.downloadPropersAndRepacks,
				enableMediaInfo: updatedConfig.enableMediaInfo
			}
		});

		await this.client.updateMediaManagementConfig(updatedConfig);
		return true;
	}

	// =========================================================================
	// Naming
	// =========================================================================

	private async syncNaming(databaseId: number, configName: string): Promise<boolean> {
		const cache = getCache(databaseId);
		if (!cache) {
			await logger.warn(`PCD cache not found for database ${databaseId}`, {
				source: 'Sync:Naming',
				meta: { instanceId: this.instanceId }
			});
			return false;
		}

		if (this.instanceType === 'radarr') {
			return this.syncRadarrNaming(cache, configName);
		} else if (this.instanceType === 'sonarr') {
			return this.syncSonarrNaming(cache, configName);
		}

		await logger.warn(`Unsupported instance type for naming sync: ${this.instanceType}`, {
			source: 'Sync:Naming',
			meta: { instanceId: this.instanceId }
		});
		return false;
	}

	private async syncRadarrNaming(cache: PCDCache, configName: string): Promise<boolean> {
		const naming = await getRadarrNaming(cache, configName);
		if (!naming) {
			await logger.debug(`Radarr naming config "${configName}" not found in PCD`, {
				source: 'Sync:Naming',
				meta: { instanceId: this.instanceId, configName }
			});
			return false;
		}

		// GET existing config
		const existingConfig = (await this.client.getNamingConfig()) as RadarrNamingConfig;

		// Transform and update
		const updatedConfig = mergeRadarrNamingConfig(existingConfig, naming);

		await logger.debug('Updating Radarr naming', {
			source: 'Sync:Naming',
			meta: {
				instanceId: this.instanceId,
				configName,
				renameMovies: updatedConfig.renameMovies,
				colonReplacementFormat: updatedConfig.colonReplacementFormat
			}
		});

		await this.client.updateNamingConfig(updatedConfig);
		return true;
	}

	private async syncSonarrNaming(cache: PCDCache, configName: string): Promise<boolean> {
		const naming = await getSonarrNaming(cache, configName);
		if (!naming) {
			await logger.debug(`Sonarr naming config "${configName}" not found in PCD`, {
				source: 'Sync:Naming',
				meta: { instanceId: this.instanceId, configName }
			});
			return false;
		}

		// GET existing config
		const existingConfig = (await this.client.getNamingConfig()) as SonarrNamingConfig;

		// Transform and update
		const updatedConfig = mergeSonarrNamingConfig(existingConfig, naming);

		await logger.debug('Updating Sonarr naming', {
			source: 'Sync:Naming',
			meta: {
				instanceId: this.instanceId,
				configName,
				renameEpisodes: updatedConfig.renameEpisodes,
				colonReplacementFormat: updatedConfig.colonReplacementFormat,
				multiEpisodeStyle: updatedConfig.multiEpisodeStyle
			}
		});

		await this.client.updateNamingConfig(updatedConfig);
		return true;
	}

	// =========================================================================
	// Quality Definitions
	// =========================================================================

	private async syncQualityDefinitions(databaseId: number, configName: string): Promise<boolean> {
		const cache = getCache(databaseId);
		if (!cache) {
			await logger.warn(`PCD cache not found for database ${databaseId}`, {
				source: 'Sync:QualityDefinitions',
				meta: { instanceId: this.instanceId }
			});
			return false;
		}

		// Fetch quality definitions from PCD by config name
		const getByName = this.instanceType === 'radarr' ? getRadarrQualityDefs : getSonarrQualityDefs;
		const qualityDefsConfig = await getByName(cache, configName);

		if (!qualityDefsConfig) {
			await logger.debug(`Quality definitions config "${configName}" not found in PCD`, {
				source: 'Sync:QualityDefinitions',
				meta: { instanceId: this.instanceId, configName }
			});
			return false;
		}

		if (qualityDefsConfig.entries.length === 0) {
			await logger.debug(`Quality definitions config "${configName}" has no entries`, {
				source: 'Sync:QualityDefinitions',
				meta: { instanceId: this.instanceId, configName }
			});
			return false;
		}

		// Get quality API mappings from PCD (maps quality_name -> api_name)
		const apiMappings = await this.getQualityApiMappings(cache);

		// GET existing quality definitions from ARR
		const arrDefinitions = await this.client.getQualityDefinitions();

		const transformed = transformQualityDefinitionsForArr(qualityDefsConfig.entries, apiMappings);
		for (const qualityName of transformed.unmapped) {
			await logger.debug(`No API mapping found for quality "${qualityName}"`, {
				source: 'Sync:QualityDefinitions',
				meta: { instanceId: this.instanceId, qualityName }
			});
		}

		const { updatedCount, missing } = applyQualityDefinitionsToArr(
			arrDefinitions,
			transformed.definitions
		);
		for (const apiName of missing) {
			await logger.debug(`No ARR definition found for quality "${apiName}"`, {
				source: 'Sync:QualityDefinitions',
				meta: { instanceId: this.instanceId, apiName }
			});
		}

		if (updatedCount === 0) {
			await logger.debug('No quality definitions matched for update', {
				source: 'Sync:QualityDefinitions',
				meta: { instanceId: this.instanceId, configName }
			});
			return false;
		}

		await logger.debug(`Updating ${updatedCount} quality definitions`, {
			source: 'Sync:QualityDefinitions',
			meta: { instanceId: this.instanceId, configName, updatedCount }
		});

		// PUT the full array back
		await this.client.updateQualityDefinitions(arrDefinitions);
		return true;
	}

	/**
	 * Get quality API mappings from PCD
	 * Returns a map of quality_name (lowercase) -> api_name
	 */
	private async getQualityApiMappings(cache: PCDCache): Promise<Map<string, string>> {
		const arrType = this.instanceType;
		const rows = await cache.kb
			.selectFrom('quality_api_mappings as qam')
			.where('qam.arr_type', '=', arrType)
			.select(['qam.quality_name', 'qam.api_name'])
			.execute();

		const map = new Map<string, string>();
		for (const row of rows) {
			map.set(row.quality_name.toLowerCase(), row.api_name);
		}
		return map;
	}

	// =========================================================================
	// Base class abstract methods (not used since we override sync())
	// =========================================================================

	protected async fetchFromPcd(): Promise<unknown[]> {
		return [];
	}

	protected transformToArr(_pcdData: unknown[]): unknown[] {
		return [];
	}

	protected async pushToArr(_arrData: unknown[]): Promise<void> {
		// Not used
	}
}
