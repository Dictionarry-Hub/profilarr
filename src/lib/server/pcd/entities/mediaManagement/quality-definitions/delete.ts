/**
 * Quality definitions remove operations
 */

import type { PCDCache } from '$pcd/index.ts';
import { writeOperation, type OperationLayer } from '$pcd/index.ts';
import type { QualityDefinitionsConfig } from '$shared/pcd/display.ts';

export interface RemoveQualityDefinitionsOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	current: QualityDefinitionsConfig;
}

export async function removeRadarrQualityDefinitions(options: RemoveQualityDefinitionsOptions) {
	const { databaseId, cache, layer, current } = options;
	const db = cache.kb;

	const deleteQuery = db
		.deleteFrom('radarr_quality_definitions')
		.where('name', '=', current.name)
		.compile();

	return writeOperation({
		databaseId,
		layer,
		description: `remove-radarr-quality-definitions-${current.name}`,
		queries: [deleteQuery],
		desiredState: {
			deleted: true,
			name: current.name,
			entries: current.entries
		},
		metadata: {
			operation: 'delete',
			entity: 'radarr_quality_definitions',
			name: current.name,
			stableKey: { key: 'radarr_quality_definitions_name', value: current.name },
			changedFields: ['deleted'],
			summary: 'Delete Radarr quality definitions',
			title: `Delete Radarr quality definitions "${current.name}"`
		}
	});
}

export async function removeSonarrQualityDefinitions(options: RemoveQualityDefinitionsOptions) {
	const { databaseId, cache, layer, current } = options;
	const db = cache.kb;

	const deleteQuery = db
		.deleteFrom('sonarr_quality_definitions')
		.where('name', '=', current.name)
		.compile();

	return writeOperation({
		databaseId,
		layer,
		description: `remove-sonarr-quality-definitions-${current.name}`,
		queries: [deleteQuery],
		desiredState: {
			deleted: true,
			name: current.name,
			entries: current.entries
		},
		metadata: {
			operation: 'delete',
			entity: 'sonarr_quality_definitions',
			name: current.name,
			stableKey: { key: 'sonarr_quality_definitions_name', value: current.name },
			changedFields: ['deleted'],
			summary: 'Delete Sonarr quality definitions',
			title: `Delete Sonarr quality definitions "${current.name}"`
		}
	});
}
