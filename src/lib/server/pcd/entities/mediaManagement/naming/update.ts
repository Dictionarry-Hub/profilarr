/**
 * Update naming config operations
 */

import type { CompiledQuery } from 'kysely';
import type { PCDCache, WriteResult } from '$pcd/index.ts';
import { writeOperation, type OperationLayer } from '$pcd/index.ts';
import type { RadarrNamingRow, SonarrNamingRow } from '$shared/pcd/display.ts';
import { colonReplacementToDb, multiEpisodeStyleToDb } from '$shared/pcd/mediaManagement.ts';
import { uuid } from '$shared/utils/uuid.ts';

// ── Radarr ──

type RadarrField =
	| 'rename'
	| 'movie_format'
	| 'movie_folder_format'
	| 'replace_illegal_characters'
	| 'colon_replacement_format'
	| 'name';

interface RadarrFieldChange {
	field: RadarrField;
	from: unknown;
	to: unknown;
	setValue: unknown;
	guardValue: unknown;
}

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

export async function updateRadarrNaming(options: UpdateRadarrNamingOptions): Promise<WriteResult> {
	const { databaseId, cache, layer, current, input } = options;
	const db = cache.kb;

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

	const changes: RadarrFieldChange[] = [];

	if (current.rename !== input.rename) {
		changes.push({
			field: 'rename',
			from: current.rename,
			to: input.rename,
			setValue: input.rename ? 1 : 0,
			guardValue: current.rename ? 1 : 0
		});
	}
	if (current.movie_format !== input.movieFormat) {
		changes.push({
			field: 'movie_format',
			from: current.movie_format,
			to: input.movieFormat,
			setValue: input.movieFormat,
			guardValue: current.movie_format
		});
	}
	if (current.movie_folder_format !== input.movieFolderFormat) {
		changes.push({
			field: 'movie_folder_format',
			from: current.movie_folder_format,
			to: input.movieFolderFormat,
			setValue: input.movieFolderFormat,
			guardValue: current.movie_folder_format
		});
	}
	if (current.replace_illegal_characters !== input.replaceIllegalCharacters) {
		changes.push({
			field: 'replace_illegal_characters',
			from: current.replace_illegal_characters,
			to: input.replaceIllegalCharacters,
			setValue: input.replaceIllegalCharacters ? 1 : 0,
			guardValue: current.replace_illegal_characters ? 1 : 0
		});
	}
	if (current.colon_replacement_format !== input.colonReplacementFormat) {
		changes.push({
			field: 'colon_replacement_format',
			from: current.colon_replacement_format,
			to: input.colonReplacementFormat,
			setValue: input.colonReplacementFormat,
			guardValue: current.colon_replacement_format
		});
	}
	if (current.name !== input.name) {
		changes.push({
			field: 'name',
			from: current.name,
			to: input.name,
			setValue: input.name,
			guardValue: current.name
		});
	}

	if (changes.length === 0) {
		return { success: true };
	}

	const groupId = changes.length > 1 ? uuid() : undefined;
	let lastResult: WriteResult | null = null;

	for (let index = 0; index < changes.length; index++) {
		const change = changes[index];
		const isRename = change.field === 'name';
		const result = await writeOperation({
			databaseId,
			layer,
			description: `update-radarr-naming-${change.field}-${input.name}`,
			queries: [buildRadarrUpdateQuery(cache, current, change)],
			desiredState: {
				[change.field]: { from: change.from, to: change.to }
			},
			metadata: {
				operation: 'update',
				entity: 'radarr_naming',
				name: input.name,
				...(isRename && { previousName: current.name }),
				stableKey: { key: 'radarr_naming_name', value: current.name },
				...(groupId && { groupId }),
				changedFields: [change.field],
				summary: isRename ? 'Rename Radarr naming config' : 'Update Radarr naming config',
				title: isRename
					? `Rename Radarr naming "${current.name}"`
					: `Update Radarr naming "${input.name}"`
			},
			skipRecompile: index < changes.length - 1
		});

		if (!result.success) {
			return result;
		}
		lastResult = result;
	}

	return lastResult ?? { success: true };
}

function buildRadarrUpdateQuery(
	cache: PCDCache,
	current: RadarrNamingRow,
	change: RadarrFieldChange
): CompiledQuery {
	const setValues: Record<string, unknown> = { [change.field]: change.setValue };
	let query = cache.kb.updateTable('radarr_naming').set(setValues).where('name', '=', current.name);

	if (change.field !== 'name') {
		query = query.where(change.field, '=', change.guardValue as never);
	}

	return query.compile();
}

// ── Sonarr ──

type SonarrField =
	| 'rename'
	| 'standard_episode_format'
	| 'daily_episode_format'
	| 'anime_episode_format'
	| 'series_folder_format'
	| 'season_folder_format'
	| 'replace_illegal_characters'
	| 'colon_replacement_format'
	| 'custom_colon_replacement_format'
	| 'multi_episode_style'
	| 'name';

interface SonarrFieldChange {
	field: SonarrField;
	from: unknown;
	to: unknown;
	setValue: unknown;
	guardValue: unknown;
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

export async function updateSonarrNaming(options: UpdateSonarrNamingOptions): Promise<WriteResult> {
	const { databaseId, cache, layer, current, input } = options;
	const db = cache.kb;

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

	const changes: SonarrFieldChange[] = [];

	if (current.rename !== input.rename) {
		changes.push({
			field: 'rename',
			from: current.rename,
			to: input.rename,
			setValue: input.rename ? 1 : 0,
			guardValue: current.rename ? 1 : 0
		});
	}
	if (current.standard_episode_format !== input.standardEpisodeFormat) {
		changes.push({
			field: 'standard_episode_format',
			from: current.standard_episode_format,
			to: input.standardEpisodeFormat,
			setValue: input.standardEpisodeFormat,
			guardValue: current.standard_episode_format
		});
	}
	if (current.daily_episode_format !== input.dailyEpisodeFormat) {
		changes.push({
			field: 'daily_episode_format',
			from: current.daily_episode_format,
			to: input.dailyEpisodeFormat,
			setValue: input.dailyEpisodeFormat,
			guardValue: current.daily_episode_format
		});
	}
	if (current.anime_episode_format !== input.animeEpisodeFormat) {
		changes.push({
			field: 'anime_episode_format',
			from: current.anime_episode_format,
			to: input.animeEpisodeFormat,
			setValue: input.animeEpisodeFormat,
			guardValue: current.anime_episode_format
		});
	}
	if (current.series_folder_format !== input.seriesFolderFormat) {
		changes.push({
			field: 'series_folder_format',
			from: current.series_folder_format,
			to: input.seriesFolderFormat,
			setValue: input.seriesFolderFormat,
			guardValue: current.series_folder_format
		});
	}
	if (current.season_folder_format !== input.seasonFolderFormat) {
		changes.push({
			field: 'season_folder_format',
			from: current.season_folder_format,
			to: input.seasonFolderFormat,
			setValue: input.seasonFolderFormat,
			guardValue: current.season_folder_format
		});
	}
	if (current.replace_illegal_characters !== input.replaceIllegalCharacters) {
		changes.push({
			field: 'replace_illegal_characters',
			from: current.replace_illegal_characters,
			to: input.replaceIllegalCharacters,
			setValue: input.replaceIllegalCharacters ? 1 : 0,
			guardValue: current.replace_illegal_characters ? 1 : 0
		});
	}
	if (current.colon_replacement_format !== input.colonReplacementFormat) {
		changes.push({
			field: 'colon_replacement_format',
			from: current.colon_replacement_format,
			to: input.colonReplacementFormat,
			setValue: colonReplacementToDb(input.colonReplacementFormat),
			guardValue: colonReplacementToDb(current.colon_replacement_format)
		});
	}
	if (current.custom_colon_replacement_format !== input.customColonReplacementFormat) {
		changes.push({
			field: 'custom_colon_replacement_format',
			from: current.custom_colon_replacement_format,
			to: input.customColonReplacementFormat,
			setValue: input.customColonReplacementFormat,
			guardValue: current.custom_colon_replacement_format
		});
	}
	if (current.multi_episode_style !== input.multiEpisodeStyle) {
		changes.push({
			field: 'multi_episode_style',
			from: current.multi_episode_style,
			to: input.multiEpisodeStyle,
			setValue: multiEpisodeStyleToDb(input.multiEpisodeStyle),
			guardValue: multiEpisodeStyleToDb(current.multi_episode_style)
		});
	}
	if (current.name !== input.name) {
		changes.push({
			field: 'name',
			from: current.name,
			to: input.name,
			setValue: input.name,
			guardValue: current.name
		});
	}

	if (changes.length === 0) {
		return { success: true };
	}

	const groupId = changes.length > 1 ? uuid() : undefined;
	let lastResult: WriteResult | null = null;

	for (let index = 0; index < changes.length; index++) {
		const change = changes[index];
		const isRename = change.field === 'name';
		const result = await writeOperation({
			databaseId,
			layer,
			description: `update-sonarr-naming-${change.field}-${input.name}`,
			queries: [buildSonarrUpdateQuery(cache, current, change)],
			desiredState: {
				[change.field]: { from: change.from, to: change.to }
			},
			metadata: {
				operation: 'update',
				entity: 'sonarr_naming',
				name: input.name,
				...(isRename && { previousName: current.name }),
				stableKey: { key: 'sonarr_naming_name', value: current.name },
				...(groupId && { groupId }),
				changedFields: [change.field],
				summary: isRename ? 'Rename Sonarr naming config' : 'Update Sonarr naming config',
				title: isRename
					? `Rename Sonarr naming "${current.name}"`
					: `Update Sonarr naming "${input.name}"`
			},
			skipRecompile: index < changes.length - 1
		});

		if (!result.success) {
			return result;
		}
		lastResult = result;
	}

	return lastResult ?? { success: true };
}

function buildSonarrUpdateQuery(
	cache: PCDCache,
	current: SonarrNamingRow,
	change: SonarrFieldChange
): CompiledQuery {
	const setValues: Record<string, unknown> = { [change.field]: change.setValue };
	let query = cache.kb.updateTable('sonarr_naming').set(setValues).where('name', '=', current.name);

	if (change.field === 'name') {
		return query.compile();
	}

	if (change.field === 'custom_colon_replacement_format' && change.guardValue === null) {
		query = query.where('custom_colon_replacement_format', 'is', null);
	} else {
		query = query.where(change.field, '=', change.guardValue as never);
	}

	return query.compile();
}
