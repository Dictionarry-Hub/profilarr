/**
 * Remove naming config operations
 */

import type { PCDCache } from '$pcd/index.ts';
import { writeOperation, type OperationLayer } from '$pcd/index.ts';
import type { RadarrNamingRow, SonarrNamingRow } from '$shared/pcd/display.ts';

export interface RemoveRadarrNamingOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	current: RadarrNamingRow;
}

export async function removeRadarrNaming(options: RemoveRadarrNamingOptions) {
	const { databaseId, cache, layer, current } = options;
	const db = cache.kb;

	const deleteQuery = db.deleteFrom('radarr_naming').where('name', '=', current.name).compile();

	return writeOperation({
		databaseId,
		layer,
		description: `delete-radarr-naming-${current.name}`,
		queries: [deleteQuery],
		desiredState: {
			deleted: true,
			name: current.name,
			rename: current.rename,
			movie_format: current.movie_format,
			movie_folder_format: current.movie_folder_format,
			replace_illegal_characters: current.replace_illegal_characters,
			colon_replacement_format: current.colon_replacement_format
		},
		metadata: {
			operation: 'delete',
			entity: 'radarr_naming',
			name: current.name,
			stableKey: { key: 'radarr_naming_name', value: current.name },
			changedFields: ['deleted'],
			summary: 'Delete Radarr naming config',
			title: `Delete Radarr naming "${current.name}"`
		}
	});
}

export interface RemoveSonarrNamingOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	current: SonarrNamingRow;
}

export async function removeSonarrNaming(options: RemoveSonarrNamingOptions) {
	const { databaseId, cache, layer, current } = options;
	const db = cache.kb;

	const deleteQuery = db.deleteFrom('sonarr_naming').where('name', '=', current.name).compile();

	return writeOperation({
		databaseId,
		layer,
		description: `delete-sonarr-naming-${current.name}`,
		queries: [deleteQuery],
		desiredState: {
			deleted: true,
			name: current.name,
			rename: current.rename,
			standard_episode_format: current.standard_episode_format,
			daily_episode_format: current.daily_episode_format,
			anime_episode_format: current.anime_episode_format,
			series_folder_format: current.series_folder_format,
			season_folder_format: current.season_folder_format,
			replace_illegal_characters: current.replace_illegal_characters,
			colon_replacement_format: current.colon_replacement_format,
			custom_colon_replacement_format: current.custom_colon_replacement_format,
			multi_episode_style: current.multi_episode_style
		},
		metadata: {
			operation: 'delete',
			entity: 'sonarr_naming',
			name: current.name,
			stableKey: { key: 'sonarr_naming_name', value: current.name },
			changedFields: ['deleted'],
			summary: 'Delete Sonarr naming config',
			title: `Delete Sonarr naming "${current.name}"`
		}
	});
}
