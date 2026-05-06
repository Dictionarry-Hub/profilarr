/**
 * Remove media settings config operations
 */

import type { PCDCache } from '$pcd/index.ts';
import { writeOperation, type OperationLayer } from '$pcd/index.ts';
import type { RadarrMediaSettingsRow, SonarrMediaSettingsRow } from '$shared/pcd/display.ts';

export interface RemoveMediaSettingsOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	current: RadarrMediaSettingsRow;
}

export async function removeRadarrMediaSettings(options: RemoveMediaSettingsOptions) {
	const { databaseId, cache, layer, current } = options;
	const db = cache.kb;

	const deleteQuery = db
		.deleteFrom('radarr_media_settings')
		.where('name', '=', current.name)
		.compile();

	return writeOperation({
		databaseId,
		layer,
		description: `delete-radarr-media-settings-${current.name}`,
		queries: [deleteQuery],
		desiredState: {
			deleted: true,
			name: current.name,
			propers_repacks: current.propers_repacks,
			enable_media_info: current.enable_media_info
		},
		metadata: {
			operation: 'delete',
			entity: 'radarr_media_settings',
			name: current.name,
			stableKey: { key: 'radarr_media_settings_name', value: current.name },
			changedFields: ['deleted'],
			summary: 'Delete Radarr media settings',
			title: `Delete Radarr media settings "${current.name}"`
		}
	});
}

export interface RemoveSonarrMediaSettingsOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	current: SonarrMediaSettingsRow;
}

export async function removeSonarrMediaSettings(options: RemoveSonarrMediaSettingsOptions) {
	const { databaseId, cache, layer, current } = options;
	const db = cache.kb;

	const deleteQuery = db
		.deleteFrom('sonarr_media_settings')
		.where('name', '=', current.name)
		.compile();

	return writeOperation({
		databaseId,
		layer,
		description: `delete-sonarr-media-settings-${current.name}`,
		queries: [deleteQuery],
		desiredState: {
			deleted: true,
			name: current.name,
			propers_repacks: current.propers_repacks,
			enable_media_info: current.enable_media_info
		},
		metadata: {
			operation: 'delete',
			entity: 'sonarr_media_settings',
			name: current.name,
			stableKey: { key: 'sonarr_media_settings_name', value: current.name },
			changedFields: ['deleted'],
			summary: 'Delete Sonarr media settings',
			title: `Delete Sonarr media settings "${current.name}"`
		}
	});
}
