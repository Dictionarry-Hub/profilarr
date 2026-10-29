/**
 * Create naming config operations
 */

import type { PCDCache } from '#pcd/index.ts';
import { writeOperation, type OperationLayer } from '#pcd/index.ts';
import type { RadarrNamingRow, SonarrNamingRow } from '#shared/pcd/display.ts';
import { colonReplacementToDb, multiEpisodeStyleToDb } from '#shared/pcd/mediaManagement.ts';

export interface CreateRadarrNamingInput {
	name: string;
	rename: boolean;
	movieFormat: string;
	movieFolderFormat: string;
	replaceIllegalCharacters: boolean;
	colonReplacementFormat: RadarrNamingRow['colon_replacement_format'];
}

export interface CreateRadarrNamingOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	input: CreateRadarrNamingInput;
}

export async function createRadarrNaming(options: CreateRadarrNamingOptions) {
	const { databaseId, cache, layer, input } = options;
	const db = cache.kb;

	// Check if name already exists
	const existing = await db
		.selectFrom('radarr_naming')
		.where((eb) => eb(eb.fn('lower', [eb.ref('name')]), '=', input.name.toLowerCase()))
		.select('name')
		.executeTakeFirst();

	if (existing) {
		throw new Error(`A radarr naming config with name "${input.name}" already exists`);
	}

	const insertQuery = db
		.insertInto('radarr_naming')
		.values({
			name: input.name,
			rename: input.rename ? 1 : 0,
			movie_format: input.movieFormat,
			movie_folder_format: input.movieFolderFormat,
			replace_illegal_characters: input.replaceIllegalCharacters ? 1 : 0,
			colon_replacement_format: input.colonReplacementFormat
		})
		.compile();

	return writeOperation({
		databaseId,
		layer,
		description: `create-radarr-naming-${input.name}`,
		queries: [insertQuery],
		desiredState: {
			name: input.name,
			rename: input.rename,
			movie_format: input.movieFormat,
			movie_folder_format: input.movieFolderFormat,
			replace_illegal_characters: input.replaceIllegalCharacters,
			colon_replacement_format: input.colonReplacementFormat
		},
		metadata: {
			operation: 'create',
			entity: 'radarr_naming',
			name: input.name,
			stableKey: { key: 'radarr_naming_name', value: input.name },
			summary: 'Create Radarr naming config',
			title: `Create Radarr naming "${input.name}"`
		}
	});
}

export interface CreateSonarrNamingInput {
	name: string;
	rename: boolean;
	standardEpisodeFormat: string;
	dailyEpisodeFormat: string;
	animeEpisodeFormat: string;
	seriesFolderFormat: string;
	seasonFolderFormat: string;
	replaceIllegalCharacters: boolean;
	colonReplacementFormat: SonarrNamingRow['colon_replacement_format'];
	customColonReplacementFormat: string | null;
	multiEpisodeStyle: SonarrNamingRow['multi_episode_style'];
}

export interface CreateSonarrNamingOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	input: CreateSonarrNamingInput;
}

export async function createSonarrNaming(options: CreateSonarrNamingOptions) {
	const { databaseId, cache, layer, input } = options;
	const db = cache.kb;

	// Check if name already exists
	const existing = await db
		.selectFrom('sonarr_naming')
		.where((eb) => eb(eb.fn('lower', [eb.ref('name')]), '=', input.name.toLowerCase()))
		.select('name')
		.executeTakeFirst();

	if (existing) {
		throw new Error(`A sonarr naming config with name "${input.name}" already exists`);
	}

	const insertQuery = db
		.insertInto('sonarr_naming')
		.values({
			name: input.name,
			rename: input.rename ? 1 : 0,
			standard_episode_format: input.standardEpisodeFormat,
			daily_episode_format: input.dailyEpisodeFormat,
			anime_episode_format: input.animeEpisodeFormat,
			series_folder_format: input.seriesFolderFormat,
			season_folder_format: input.seasonFolderFormat,
			replace_illegal_characters: input.replaceIllegalCharacters ? 1 : 0,
			colon_replacement_format: colonReplacementToDb(input.colonReplacementFormat),
			custom_colon_replacement_format: input.customColonReplacementFormat,
			multi_episode_style: multiEpisodeStyleToDb(input.multiEpisodeStyle)
		})
		.compile();

	return writeOperation({
		databaseId,
		layer,
		description: `create-sonarr-naming-${input.name}`,
		queries: [insertQuery],
		desiredState: {
			name: input.name,
			rename: input.rename,
			standard_episode_format: input.standardEpisodeFormat,
			daily_episode_format: input.dailyEpisodeFormat,
			anime_episode_format: input.animeEpisodeFormat,
			series_folder_format: input.seriesFolderFormat,
			season_folder_format: input.seasonFolderFormat,
			replace_illegal_characters: input.replaceIllegalCharacters,
			colon_replacement_format: input.colonReplacementFormat,
			custom_colon_replacement_format: input.customColonReplacementFormat,
			multi_episode_style: input.multiEpisodeStyle
		},
		metadata: {
			operation: 'create',
			entity: 'sonarr_naming',
			name: input.name,
			stableKey: { key: 'sonarr_naming_name', value: input.name },
			summary: 'Create Sonarr naming config',
			title: `Create Sonarr naming "${input.name}"`
		}
	});
}
