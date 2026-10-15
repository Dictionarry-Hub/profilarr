/**
 * Where a profile's size limits come from on an instance that stores them per
 * profile (Sonarr v5). First match per quality wins:
 *
 * 1. the profile's own quality definitions config, if its sync selection
 *    names one (same database as the profile)
 * 2. the instance's quality definitions selection (Media Management)
 * 3. what the profile already has on the Arr, or the Arr's profile schema
 *    defaults for a profile that does not exist yet
 *
 * Shared by the quality profile syncer and entity sync so the rule lives once.
 * Each definitions config is read once per source; the schema is fetched only
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
	resolveProfileSizes,
	type QualitySizeMap
} from './sizes.ts';

/** A profile's own definitions config, from its sync selection. */
export interface SizeOverride {
	databaseId: number;
	configName: string;
}

export interface ProfileSizeSource {
	/**
	 * Sizes for one profile's payload. Throws if the profile does not exist
	 * and the schema cannot be fetched, so a create is never sent without
	 * sizes by accident.
	 */
	forProfile(existing?: ArrQualityProfile, override?: SizeOverride | null): Promise<QualitySizeMap>;
}

export function createProfileSizeSource(
	client: BaseArrClient,
	instanceId: number,
	instanceType: SyncArrType,
	source: string
): ProfileSizeSource {
	const loaded = new Map<string, Promise<QualitySizeMap | null>>();
	let globalSizes: Promise<QualitySizeMap | null> | undefined;
	let schemaSizes: Promise<QualitySizeMap> | undefined;

	/** One read per config per source, whichever role asked for it first. */
	function loadSizes(
		databaseId: number,
		configName: string,
		role: 'default' | 'override'
	): Promise<QualitySizeMap | null> {
		const key = `${databaseId}:${configName}`;
		let pending = loaded.get(key);
		if (!pending) {
			pending = readSizes(databaseId, configName, role);
			loaded.set(key, pending);
		}
		return pending;
	}

	async function readSizes(
		databaseId: number,
		configName: string,
		role: 'default' | 'override'
	): Promise<QualitySizeMap | null> {
		const cache = getCache(databaseId);
		if (!cache) {
			await logger.warn(
				`PCD cache not found for database ${databaseId}; profile sizes left as is`,
				{
					source,
					meta: { instanceId, databaseId, configName, role }
				}
			);
			return null;
		}

		const getByName = instanceType === 'radarr' ? getRadarrQualityDefs : getSonarrQualityDefs;
		const definitions = await getByName(cache, configName);
		if (!definitions || definitions.entries.length === 0) {
			await logger.warn(
				`Quality definitions "${configName}" not found or empty; profile sizes left as is`,
				{ source, meta: { instanceId, databaseId, configName, role } }
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

		const scope =
			role === 'default'
				? 'every synced profile without a choice of its own'
				: 'the profiles that chose them';
		await logger.info(
			`Applying quality definitions "${configName}" to ${scope}; this Arr keeps sizes on profiles`,
			{
				source,
				meta: {
					instanceId,
					databaseId,
					configName,
					role,
					qualities: transformed.definitions.length
				}
			}
		);
		return definitionsToSizeMap(transformed.definitions);
	}

	async function loadGlobalSizes(): Promise<QualitySizeMap | null> {
		const config = arrSyncQueries.getMediaManagementSync(instanceId);
		const databaseId = config.qualityDefinitionsDatabaseId;
		const configName = config.qualityDefinitionsConfigName;
		if (!databaseId || !configName) {
			await logger.info(
				'No quality definitions selected; synced profiles without a choice of their own keep the sizes the Arr already has',
				{ source, meta: { instanceId } }
			);
			return null;
		}
		return loadSizes(databaseId, configName, 'default');
	}

	async function loadSchemaSizes(): Promise<QualitySizeMap> {
		const schema = await client.getQualityProfileSchema();
		return collectItemSizes(schema.items);
	}

	return {
		async forProfile(existing, override) {
			globalSizes ??= loadGlobalSizes();
			const fallback = existing
				? collectItemSizes(existing.items)
				: await (schemaSizes ??= loadSchemaSizes());
			const [global, overrideSizes] = await Promise.all([
				globalSizes,
				override ? loadSizes(override.databaseId, override.configName, 'override') : null
			]);
			return resolveProfileSizes({ fallback, global, override: overrideSizes });
		}
	};
}
