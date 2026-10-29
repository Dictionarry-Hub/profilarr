/**
 * Create media settings config operations
 */

import type { PCDCache } from '#pcd/index.ts';
import { writeOperation, type OperationLayer } from '#pcd/index.ts';
import type { RadarrMediaSettingsRow } from '#shared/pcd/display.ts';

export interface CreateMediaSettingsInput {
	name: string;
	propersRepacks: RadarrMediaSettingsRow['propers_repacks'];
	enableMediaInfo: boolean;
}

export interface CreateMediaSettingsOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	input: CreateMediaSettingsInput;
}

export async function createRadarrMediaSettings(options: CreateMediaSettingsOptions) {
	const { databaseId, cache, layer, input } = options;
	const db = cache.kb;

	// Check if name already exists
	const existing = await db
		.selectFrom('radarr_media_settings')
		.where((eb) => eb(eb.fn('lower', [eb.ref('name')]), '=', input.name.toLowerCase()))
		.select('name')
		.executeTakeFirst();

	if (existing) {
		throw new Error(`A radarr media settings config with name "${input.name}" already exists`);
	}

	const insertQuery = db
		.insertInto('radarr_media_settings')
		.values({
			name: input.name,
			propers_repacks: input.propersRepacks,
			enable_media_info: input.enableMediaInfo ? 1 : 0
		})
		.compile();

	return writeOperation({
		databaseId,
		layer,
		description: `create-radarr-media-settings-${input.name}`,
		queries: [insertQuery],
		desiredState: {
			name: input.name,
			propers_repacks: input.propersRepacks,
			enable_media_info: input.enableMediaInfo
		},
		metadata: {
			operation: 'create',
			entity: 'radarr_media_settings',
			name: input.name,
			stableKey: { key: 'radarr_media_settings_name', value: input.name },
			summary: 'Create Radarr media settings',
			title: `Create Radarr media settings "${input.name}"`
		}
	});
}

export async function createSonarrMediaSettings(options: CreateMediaSettingsOptions) {
	const { databaseId, cache, layer, input } = options;
	const db = cache.kb;

	// Check if name already exists
	const existing = await db
		.selectFrom('sonarr_media_settings')
		.where((eb) => eb(eb.fn('lower', [eb.ref('name')]), '=', input.name.toLowerCase()))
		.select('name')
		.executeTakeFirst();

	if (existing) {
		throw new Error(`A sonarr media settings config with name "${input.name}" already exists`);
	}

	const insertQuery = db
		.insertInto('sonarr_media_settings')
		.values({
			name: input.name,
			propers_repacks: input.propersRepacks,
			enable_media_info: input.enableMediaInfo ? 1 : 0
		})
		.compile();

	return writeOperation({
		databaseId,
		layer,
		description: `create-sonarr-media-settings-${input.name}`,
		queries: [insertQuery],
		desiredState: {
			name: input.name,
			propers_repacks: input.propersRepacks,
			enable_media_info: input.enableMediaInfo
		},
		metadata: {
			operation: 'create',
			entity: 'sonarr_media_settings',
			name: input.name,
			stableKey: { key: 'sonarr_media_settings_name', value: input.name },
			summary: 'Create Sonarr media settings',
			title: `Create Sonarr media settings "${input.name}"`
		}
	});
}
