/**
 * Update naming config operations
 */

import type { PCDCache } from '$pcd/index.ts';
import { writeOperation, type OperationLayer } from '$pcd/index.ts';
import type { RadarrNamingRow, SonarrNamingRow } from '$shared/pcd/display.ts';
import { colonReplacementToDb, multiEpisodeStyleToDb } from '$shared/pcd/mediaManagement.ts';

export interface UpdateRadarrNamingInput {
	name: string;
	rename: boolean;
	movieFormat: string;
	movieFolderFormat: string;
	replaceIllegalCharacters: boolean;
	colonReplacementFormat: RadarrNamingRow['colon_replacement_format'];
}

export interface UpdateRadarrNamingOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	current: RadarrNamingRow;
	input: UpdateRadarrNamingInput;
}

export async function updateRadarrNaming(options: UpdateRadarrNamingOptions) {
	const { databaseId, cache, layer, current, input } = options;
	const db = cache.kb;

	// If renaming, check if new name already exists
	if (input.name !== current.name) {
		const existing = await db
			.selectFrom('radarr_naming')
			.where((eb) => eb(eb.fn('lower', [eb.ref('name')]), '=', input.name.toLowerCase()))
			.select('name')
			.executeTakeFirst();

		if (existing) {
			throw new Error(`A radarr naming config with name "${input.name}" already exists`);
		}
	}

	const setValues: Record<string, unknown> = {};
	if (current.name !== input.name) setValues.name = input.name;
	if (current.rename !== input.rename) setValues.rename = input.rename ? 1 : 0;
	if (current.movie_format !== input.movieFormat) setValues.movie_format = input.movieFormat;
	if (current.movie_folder_format !== input.movieFolderFormat) {
		setValues.movie_folder_format = input.movieFolderFormat;
	}
	if (current.replace_illegal_characters !== input.replaceIllegalCharacters) {
		setValues.replace_illegal_characters = input.replaceIllegalCharacters ? 1 : 0;
	}
	if (current.colon_replacement_format !== input.colonReplacementFormat) {
		setValues.colon_replacement_format = input.colonReplacementFormat;
	}

	let updateQuery = db.updateTable('radarr_naming').set(setValues).where('name', '=', current.name);

	if (current.rename !== input.rename) {
		updateQuery = updateQuery.where('rename', '=', current.rename ? 1 : 0);
	}
	if (current.movie_format !== input.movieFormat) {
		updateQuery = updateQuery.where('movie_format', '=', current.movie_format);
	}
	if (current.movie_folder_format !== input.movieFolderFormat) {
		updateQuery = updateQuery.where('movie_folder_format', '=', current.movie_folder_format);
	}
	if (current.replace_illegal_characters !== input.replaceIllegalCharacters) {
		updateQuery = updateQuery.where(
			'replace_illegal_characters',
			'=',
			current.replace_illegal_characters ? 1 : 0
		);
	}
	if (current.colon_replacement_format !== input.colonReplacementFormat) {
		updateQuery = updateQuery.where(
			'colon_replacement_format',
			'=',
			current.colon_replacement_format
		);
	}

	if (Object.keys(setValues).length === 0) {
		return { success: true };
	}

	const updateQueryCompiled = updateQuery.compile();

	const changes: Record<string, { from: unknown; to: unknown }> = {};
	if (current.name !== input.name) changes.name = { from: current.name, to: input.name };
	if (current.rename !== input.rename) changes.rename = { from: current.rename, to: input.rename };
	if (current.movie_format !== input.movieFormat) {
		changes.movieFormat = { from: current.movie_format, to: input.movieFormat };
	}
	if (current.movie_folder_format !== input.movieFolderFormat) {
		changes.movieFolderFormat = {
			from: current.movie_folder_format,
			to: input.movieFolderFormat
		};
	}
	if (current.replace_illegal_characters !== input.replaceIllegalCharacters) {
		changes.replaceIllegalCharacters = {
			from: current.replace_illegal_characters,
			to: input.replaceIllegalCharacters
		};
	}
	if (current.colon_replacement_format !== input.colonReplacementFormat) {
		changes.colonReplacementFormat = {
			from: current.colon_replacement_format,
			to: input.colonReplacementFormat
		};
	}

	const changedFields = Object.keys(changes);
	const desiredState: Record<string, unknown> = {};
	if (changes.name) desiredState.name = { from: current.name, to: input.name };
	if (changes.rename) desiredState.rename = { from: current.rename, to: input.rename };
	if (changes.movieFormat) {
		desiredState.movie_format = { from: current.movie_format, to: input.movieFormat };
	}
	if (changes.movieFolderFormat) {
		desiredState.movie_folder_format = {
			from: current.movie_folder_format,
			to: input.movieFolderFormat
		};
	}
	if (changes.replaceIllegalCharacters) {
		desiredState.replace_illegal_characters = {
			from: current.replace_illegal_characters,
			to: input.replaceIllegalCharacters
		};
	}
	if (changes.colonReplacementFormat) {
		desiredState.colon_replacement_format = {
			from: current.colon_replacement_format,
			to: input.colonReplacementFormat
		};
	}

	return writeOperation({
		databaseId,
		layer,
		description: `update-radarr-naming-${input.name}`,
		queries: [updateQueryCompiled],
		desiredState,
		metadata: {
			operation: 'update',
			entity: 'radarr_naming',
			name: input.name,
			...(current.name !== input.name && { previousName: current.name }),
			stableKey: { key: 'radarr_naming_name', value: current.name },
			changedFields,
			summary: 'Update Radarr naming config',
			title: `Update Radarr naming "${input.name}"`
		}
	});
}

export interface UpdateSonarrNamingInput {
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

export interface UpdateSonarrNamingOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	current: SonarrNamingRow;
	input: UpdateSonarrNamingInput;
}

export async function updateSonarrNaming(options: UpdateSonarrNamingOptions) {
	const { databaseId, cache, layer, current, input } = options;
	const db = cache.kb;

	// If renaming, check if new name already exists
	if (input.name !== current.name) {
		const existing = await db
			.selectFrom('sonarr_naming')
			.where((eb) => eb(eb.fn('lower', [eb.ref('name')]), '=', input.name.toLowerCase()))
			.select('name')
			.executeTakeFirst();

		if (existing) {
			throw new Error(`A sonarr naming config with name "${input.name}" already exists`);
		}
	}

	const currentColonReplacement = colonReplacementToDb(current.colon_replacement_format);
	const nextColonReplacement = colonReplacementToDb(input.colonReplacementFormat);
	const currentMultiEpisode = multiEpisodeStyleToDb(current.multi_episode_style);
	const nextMultiEpisode = multiEpisodeStyleToDb(input.multiEpisodeStyle);

	const setValues: Record<string, unknown> = {};
	if (current.name !== input.name) setValues.name = input.name;
	if (current.rename !== input.rename) setValues.rename = input.rename ? 1 : 0;
	if (current.standard_episode_format !== input.standardEpisodeFormat) {
		setValues.standard_episode_format = input.standardEpisodeFormat;
	}
	if (current.daily_episode_format !== input.dailyEpisodeFormat) {
		setValues.daily_episode_format = input.dailyEpisodeFormat;
	}
	if (current.anime_episode_format !== input.animeEpisodeFormat) {
		setValues.anime_episode_format = input.animeEpisodeFormat;
	}
	if (current.series_folder_format !== input.seriesFolderFormat) {
		setValues.series_folder_format = input.seriesFolderFormat;
	}
	if (current.season_folder_format !== input.seasonFolderFormat) {
		setValues.season_folder_format = input.seasonFolderFormat;
	}
	if (current.replace_illegal_characters !== input.replaceIllegalCharacters) {
		setValues.replace_illegal_characters = input.replaceIllegalCharacters ? 1 : 0;
	}
	if (currentColonReplacement !== nextColonReplacement) {
		setValues.colon_replacement_format = nextColonReplacement;
	}
	if (current.custom_colon_replacement_format !== input.customColonReplacementFormat) {
		setValues.custom_colon_replacement_format = input.customColonReplacementFormat;
	}
	if (currentMultiEpisode !== nextMultiEpisode) {
		setValues.multi_episode_style = nextMultiEpisode;
	}

	let updateQuery = db.updateTable('sonarr_naming').set(setValues).where('name', '=', current.name);

	if (current.rename !== input.rename) {
		updateQuery = updateQuery.where('rename', '=', current.rename ? 1 : 0);
	}
	if (current.standard_episode_format !== input.standardEpisodeFormat) {
		updateQuery = updateQuery.where(
			'standard_episode_format',
			'=',
			current.standard_episode_format
		);
	}
	if (current.daily_episode_format !== input.dailyEpisodeFormat) {
		updateQuery = updateQuery.where('daily_episode_format', '=', current.daily_episode_format);
	}
	if (current.anime_episode_format !== input.animeEpisodeFormat) {
		updateQuery = updateQuery.where('anime_episode_format', '=', current.anime_episode_format);
	}
	if (current.series_folder_format !== input.seriesFolderFormat) {
		updateQuery = updateQuery.where('series_folder_format', '=', current.series_folder_format);
	}
	if (current.season_folder_format !== input.seasonFolderFormat) {
		updateQuery = updateQuery.where('season_folder_format', '=', current.season_folder_format);
	}
	if (current.replace_illegal_characters !== input.replaceIllegalCharacters) {
		updateQuery = updateQuery.where(
			'replace_illegal_characters',
			'=',
			current.replace_illegal_characters ? 1 : 0
		);
	}
	if (currentColonReplacement !== nextColonReplacement) {
		updateQuery = updateQuery.where('colon_replacement_format', '=', currentColonReplacement);
	}
	if (current.custom_colon_replacement_format !== input.customColonReplacementFormat) {
		if (current.custom_colon_replacement_format === null) {
			updateQuery = updateQuery.where('custom_colon_replacement_format', 'is', null);
		} else {
			updateQuery = updateQuery.where(
				'custom_colon_replacement_format',
				'=',
				current.custom_colon_replacement_format
			);
		}
	}
	if (currentMultiEpisode !== nextMultiEpisode) {
		updateQuery = updateQuery.where('multi_episode_style', '=', currentMultiEpisode);
	}

	if (Object.keys(setValues).length === 0) {
		return { success: true };
	}

	const updateQueryCompiled = updateQuery.compile();

	const changes: Record<string, { from: unknown; to: unknown }> = {};
	if (current.name !== input.name) changes.name = { from: current.name, to: input.name };
	if (current.rename !== input.rename) changes.rename = { from: current.rename, to: input.rename };
	if (current.standard_episode_format !== input.standardEpisodeFormat) {
		changes.standardEpisodeFormat = {
			from: current.standard_episode_format,
			to: input.standardEpisodeFormat
		};
	}
	if (current.daily_episode_format !== input.dailyEpisodeFormat) {
		changes.dailyEpisodeFormat = {
			from: current.daily_episode_format,
			to: input.dailyEpisodeFormat
		};
	}
	if (current.anime_episode_format !== input.animeEpisodeFormat) {
		changes.animeEpisodeFormat = {
			from: current.anime_episode_format,
			to: input.animeEpisodeFormat
		};
	}
	if (current.series_folder_format !== input.seriesFolderFormat) {
		changes.seriesFolderFormat = {
			from: current.series_folder_format,
			to: input.seriesFolderFormat
		};
	}
	if (current.season_folder_format !== input.seasonFolderFormat) {
		changes.seasonFolderFormat = {
			from: current.season_folder_format,
			to: input.seasonFolderFormat
		};
	}
	if (current.replace_illegal_characters !== input.replaceIllegalCharacters) {
		changes.replaceIllegalCharacters = {
			from: current.replace_illegal_characters,
			to: input.replaceIllegalCharacters
		};
	}
	if (currentColonReplacement !== nextColonReplacement) {
		changes.colonReplacementFormat = {
			from: current.colon_replacement_format,
			to: input.colonReplacementFormat
		};
	}
	if (current.custom_colon_replacement_format !== input.customColonReplacementFormat) {
		changes.customColonReplacementFormat = {
			from: current.custom_colon_replacement_format,
			to: input.customColonReplacementFormat
		};
	}
	if (currentMultiEpisode !== nextMultiEpisode) {
		changes.multiEpisodeStyle = {
			from: current.multi_episode_style,
			to: input.multiEpisodeStyle
		};
	}

	const changedFields = Object.keys(changes);
	const desiredState: Record<string, unknown> = {};
	if (changes.name) desiredState.name = { from: current.name, to: input.name };
	if (changes.rename) desiredState.rename = { from: current.rename, to: input.rename };
	if (changes.standardEpisodeFormat) {
		desiredState.standard_episode_format = {
			from: current.standard_episode_format,
			to: input.standardEpisodeFormat
		};
	}
	if (changes.dailyEpisodeFormat) {
		desiredState.daily_episode_format = {
			from: current.daily_episode_format,
			to: input.dailyEpisodeFormat
		};
	}
	if (changes.animeEpisodeFormat) {
		desiredState.anime_episode_format = {
			from: current.anime_episode_format,
			to: input.animeEpisodeFormat
		};
	}
	if (changes.seriesFolderFormat) {
		desiredState.series_folder_format = {
			from: current.series_folder_format,
			to: input.seriesFolderFormat
		};
	}
	if (changes.seasonFolderFormat) {
		desiredState.season_folder_format = {
			from: current.season_folder_format,
			to: input.seasonFolderFormat
		};
	}
	if (changes.replaceIllegalCharacters) {
		desiredState.replace_illegal_characters = {
			from: current.replace_illegal_characters,
			to: input.replaceIllegalCharacters
		};
	}
	if (changes.colonReplacementFormat) {
		desiredState.colon_replacement_format = {
			from: current.colon_replacement_format,
			to: input.colonReplacementFormat
		};
	}
	if (changes.customColonReplacementFormat) {
		desiredState.custom_colon_replacement_format = {
			from: current.custom_colon_replacement_format,
			to: input.customColonReplacementFormat
		};
	}
	if (changes.multiEpisodeStyle) {
		desiredState.multi_episode_style = {
			from: current.multi_episode_style,
			to: input.multiEpisodeStyle
		};
	}

	return writeOperation({
		databaseId,
		layer,
		description: `update-sonarr-naming-${input.name}`,
		queries: [updateQueryCompiled],
		desiredState,
		metadata: {
			operation: 'update',
			entity: 'sonarr_naming',
			name: input.name,
			...(current.name !== input.name && { previousName: current.name }),
			stableKey: { key: 'sonarr_naming_name', value: current.name },
			changedFields,
			summary: 'Update Sonarr naming config',
			title: `Update Sonarr naming "${input.name}"`
		}
	});
}
