/**
 * Where a profile's size limits come from on an instance that stores them per
 * profile (Sonarr v5). Resolution order, first match per quality wins:
 *
 * 1. the instance's global quality definitions selection (Media Management)
 * 2. what the profile already has on the Arr, or the Arr's profile schema
 *    defaults for a profile that does not exist yet
 *
 * Shared by the quality profile syncer and entity sync so the rule lives once.
 * The global selection is read once per source; the schema is fetched only
 * when a profile has to be created.
 */

import { arrSyncQueries } from '$db/queries/arrSync.ts';
import { getCache } from '$pcd/index.ts';
import {
	getRadarrByName as getRadarrQualityDefs,
	getSonarrByName as getSonarrQualityDefs
} from '$pcd/entities/mediaManagement/quality-definitions/read.ts';
import { logger } from '$logger/logger.ts';
import type { BaseArrClient } from '$arr/base.ts';
import type { ArrQualityProfile } from '$arr/types.ts';
import type { SyncArrType } from '../mappings.ts';
import { transformQualityDefinitionsForArr } from '../mediaManagement/transformer.ts';
import { getQualityApiMappings } from './transformer.ts';
import {
	collectItemSizes,
	definitionsToSizeMap,
	mergeSizes,
	type QualitySizeMap
} from './sizes.ts';

export interface ProfileSizeSource {
	/**
	 * Sizes for one profile's payload. Throws if the profile does not exist
	 * and the schema cannot be fetched, so a create is never sent without
	 * sizes by accident.
	 */
	forProfile(existing?: ArrQualityProfile): Promise<QualitySizeMap>;
}

export function createProfileSizeSource(
	client: BaseArrClient,
	instanceId: number,
	instanceType: SyncArrType,
	source: string
): ProfileSizeSource {
	let globalSizes: Promise<QualitySizeMap | null> | undefined;
	let schemaSizes: Promise<QualitySizeMap> | undefined;

	async function loadGlobalSizes(): Promise<QualitySizeMap | null> {
		const config = arrSyncQueries.getMediaManagementSync(instanceId);
		const databaseId = config.qualityDefinitionsDatabaseId;
		const configName = config.qualityDefinitionsConfigName;
		if (!databaseId || !configName) {
			await logger.info(
				'No quality definitions selected; synced profiles keep the sizes the Arr already has',
				{ source, meta: { instanceId } }
			);
			return null;
		}

		const cache = getCache(databaseId);
		if (!cache) {
			await logger.warn(
				`PCD cache not found for database ${databaseId}; profile sizes left as is`,
				{
					source,
					meta: { instanceId, databaseId, configName }
				}
			);
			return null;
		}

		const getByName = instanceType === 'radarr' ? getRadarrQualityDefs : getSonarrQualityDefs;
		const definitions = await getByName(cache, configName);
		if (!definitions || definitions.entries.length === 0) {
			await logger.warn(
				`Quality definitions "${configName}" not found or empty; profile sizes left as is`,
				{
					source,
					meta: { instanceId, databaseId, configName }
				}
			);
			return null;
		}

		const mappings = await getQualityApiMappings(cache, instanceType);
		const transformed = transformQualityDefinitionsForArr(definitions.entries, mappings);
		if (transformed.unmapped.length > 0) {
			await logger.debug('Quality definitions without an API mapping are skipped', {
				source,
				meta: { instanceId, configName, unmapped: transformed.unmapped }
			});
		}

		await logger.info(
			`Applying quality definitions "${configName}" to each synced profile; this Arr keeps sizes on profiles`,
			{
				source,
				meta: { instanceId, databaseId, configName, qualities: transformed.definitions.length }
			}
		);
		return definitionsToSizeMap(transformed.definitions);
	}

	async function loadSchemaSizes(): Promise<QualitySizeMap> {
		const schema = await client.getQualityProfileSchema();
		return collectItemSizes(schema.items);
	}

	return {
		async forProfile(existing) {
			globalSizes ??= loadGlobalSizes();
			const fallback = existing
				? collectItemSizes(existing.items)
				: await (schemaSizes ??= loadSchemaSizes());
			const global = await globalSizes;
			return global ? mergeSizes(fallback, global) : fallback;
		}
	};
}
