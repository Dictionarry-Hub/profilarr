/**
 * Entity Clone
 *
 * Orchestrates serialize → rename → deserialize for any entity type.
 * The existing create functions handle name uniqueness validation.
 */

import type { PCDCache } from '$pcd/index.ts';
import type { OperationLayer } from '$pcd/index.ts';
import type { EntityType } from '$shared/pcd/portable.ts';
import * as serialize from './serialize.ts';
import * as deserialize from './deserialize.ts';

interface CloneOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	entityType: EntityType;
	/** Source entity name (used for name-based lookups) */
	sourceName: string;
	/** Name for the cloned entity */
	newName: string;
}

export async function clone(options: CloneOptions) {
	const { databaseId, cache, layer, entityType, sourceName, newName } = options;

	switch (entityType) {
		case 'delay_profile': {
			const portable = await serialize.serializeDelayProfile(cache, sourceName);
			portable.name = newName;
			return deserialize.deserializeDelayProfile({ databaseId, cache, layer, portable });
		}

		case 'regular_expression': {
			const portable = await serialize.serializeRegularExpression(cache, sourceName);
			portable.name = newName;
			return deserialize.deserializeRegularExpression({ databaseId, cache, layer, portable });
		}

		case 'custom_format': {
			const portable = await serialize.serializeCustomFormat(cache, sourceName);
			portable.name = newName;
			return deserialize.deserializeCustomFormat({ databaseId, cache, layer, portable });
		}

		case 'quality_profile': {
			const portable = await serialize.serializeQualityProfile(cache, sourceName);
			portable.name = newName;
			return deserialize.deserializeQualityProfile({ databaseId, cache, layer, portable });
		}

		case 'radarr_naming': {
			const portable = await serialize.serializeRadarrNaming(cache, sourceName);
			portable.name = newName;
			return deserialize.deserializeRadarrNaming({ databaseId, cache, layer, portable });
		}

		case 'sonarr_naming': {
			const portable = await serialize.serializeSonarrNaming(cache, sourceName);
			portable.name = newName;
			return deserialize.deserializeSonarrNaming({ databaseId, cache, layer, portable });
		}

		case 'radarr_media_settings': {
			const portable = await serialize.serializeRadarrMediaSettings(cache, sourceName);
			portable.name = newName;
			return deserialize.deserializeRadarrMediaSettings({ databaseId, cache, layer, portable });
		}

		case 'sonarr_media_settings': {
			const portable = await serialize.serializeSonarrMediaSettings(cache, sourceName);
			portable.name = newName;
			return deserialize.deserializeSonarrMediaSettings({ databaseId, cache, layer, portable });
		}

		case 'radarr_quality_definitions': {
			const portable = await serialize.serializeRadarrQualityDefinitions(cache, sourceName);
			portable.name = newName;
			return deserialize.deserializeRadarrQualityDefinitions({
				databaseId,
				cache,
				layer,
				portable
			});
		}

		case 'sonarr_quality_definitions': {
			const portable = await serialize.serializeSonarrQualityDefinitions(cache, sourceName);
			portable.name = newName;
			return deserialize.deserializeSonarrQualityDefinitions({
				databaseId,
				cache,
				layer,
				portable
			});
		}
	}
}
