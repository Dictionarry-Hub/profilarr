import type {
	ArrMediaManagementConfig,
	ArrNamingConfig,
	ArrPropersAndRepacks,
	RadarrNamingConfig,
	SonarrNamingConfig
} from '$arr/types.ts';
import type {
	RadarrMediaSettingsRow,
	RadarrNamingRow,
	SonarrMediaSettingsRow,
	SonarrNamingRow
} from '$shared/pcd/display.ts';
import {
	colonReplacementFromDb,
	colonReplacementToDb,
	multiEpisodeStyleFromDb,
	multiEpisodeStyleToDb,
	type MultiEpisodeStyle,
	type RadarrColonReplacementFormat,
	type SonarrColonReplacementFormat
} from '$shared/pcd/mediaManagement.ts';
import type { SyncArrType } from '$sync/mappings.ts';

export interface ArrMediaSettingsManagedFields {
	downloadPropersAndRepacks: ArrPropersAndRepacks;
	enableMediaInfo: boolean;
}

type PcdMediaSettings = Pick<
	RadarrMediaSettingsRow | SonarrMediaSettingsRow,
	'propers_repacks' | 'enable_media_info'
>;

type PcdRadarrNaming = Pick<
	RadarrNamingRow,
	| 'rename'
	| 'replace_illegal_characters'
	| 'colon_replacement_format'
	| 'movie_format'
	| 'movie_folder_format'
>;

type PcdSonarrNaming = Pick<
	SonarrNamingRow,
	| 'rename'
	| 'replace_illegal_characters'
	| 'colon_replacement_format'
	| 'custom_colon_replacement_format'
	| 'multi_episode_style'
	| 'standard_episode_format'
	| 'daily_episode_format'
	| 'anime_episode_format'
	| 'series_folder_format'
	| 'season_folder_format'
>;

export interface RadarrNamingManagedFields {
	renameMovies: boolean;
	replaceIllegalCharacters: boolean;
	colonReplacementFormat: RadarrColonReplacementFormat;
	standardMovieFormat: string | null;
	movieFolderFormat: string | null;
}

export interface SonarrNamingManagedFields {
	renameEpisodes: boolean;
	replaceIllegalCharacters: boolean;
	colonReplacementFormat: SonarrColonReplacementFormat;
	customColonReplacementFormat: string | null;
	multiEpisodeStyle: MultiEpisodeStyle;
	standardEpisodeFormat: string | null;
	dailyEpisodeFormat: string | null;
	animeEpisodeFormat: string | null;
	seriesFolderFormat: string | null;
	seasonFolderFormat: string | null;
}

type SonarrNamingApiManagedFields = Omit<
	SonarrNamingManagedFields,
	'colonReplacementFormat' | 'multiEpisodeStyle'
> & {
	colonReplacementFormat: number;
	multiEpisodeStyle: number;
};

export type NormalizedNamingManagedFields = RadarrNamingManagedFields | SonarrNamingManagedFields;

export function transformMediaSettings(
	mediaSettings: PcdMediaSettings
): ArrMediaSettingsManagedFields {
	return {
		downloadPropersAndRepacks: mapPropersRepacks(mediaSettings.propers_repacks),
		enableMediaInfo: mediaSettings.enable_media_info
	};
}

export function transformRadarrNaming(naming: PcdRadarrNaming): RadarrNamingManagedFields {
	return {
		renameMovies: naming.rename,
		replaceIllegalCharacters: naming.replace_illegal_characters,
		colonReplacementFormat: naming.colon_replacement_format,
		standardMovieFormat: naming.movie_format,
		movieFolderFormat: naming.movie_folder_format
	};
}

export function transformSonarrNaming(naming: PcdSonarrNaming): SonarrNamingApiManagedFields {
	return {
		renameEpisodes: naming.rename,
		replaceIllegalCharacters: naming.replace_illegal_characters,
		colonReplacementFormat: colonReplacementToDb(naming.colon_replacement_format),
		customColonReplacementFormat: naming.custom_colon_replacement_format,
		multiEpisodeStyle: multiEpisodeStyleToDb(naming.multi_episode_style),
		standardEpisodeFormat: naming.standard_episode_format,
		dailyEpisodeFormat: naming.daily_episode_format,
		animeEpisodeFormat: naming.anime_episode_format,
		seriesFolderFormat: naming.series_folder_format,
		seasonFolderFormat: naming.season_folder_format
	};
}

export function transformNamingForDrift(
	naming: PcdRadarrNaming | PcdSonarrNaming,
	arrType: SyncArrType
): NormalizedNamingManagedFields {
	if (arrType === 'radarr') {
		return transformRadarrNaming(naming as PcdRadarrNaming);
	}
	return normalizeSonarrNamingConfig(transformSonarrNaming(naming as PcdSonarrNaming));
}

export function mergeMediaSettingsConfig(
	existing: ArrMediaManagementConfig,
	mediaSettings: PcdMediaSettings
): ArrMediaManagementConfig {
	return {
		...existing,
		...transformMediaSettings(mediaSettings)
	};
}

export function mergeRadarrNamingConfig(
	existing: RadarrNamingConfig,
	naming: PcdRadarrNaming
): RadarrNamingConfig {
	return {
		...existing,
		...transformRadarrNaming(naming)
	};
}

export function mergeSonarrNamingConfig(
	existing: SonarrNamingConfig,
	naming: PcdSonarrNaming
): SonarrNamingConfig {
	return {
		...existing,
		...transformSonarrNaming(naming)
	};
}

export function normalizeNamingConfig(
	config: ArrNamingConfig,
	arrType: SyncArrType
): NormalizedNamingManagedFields {
	if (arrType === 'radarr') {
		return normalizeRadarrNamingConfig(config as RadarrNamingConfig);
	}
	return normalizeSonarrNamingConfig(config as SonarrNamingConfig);
}

export function normalizeRadarrNamingConfig(
	config: Pick<
		RadarrNamingConfig,
		| 'renameMovies'
		| 'replaceIllegalCharacters'
		| 'colonReplacementFormat'
		| 'standardMovieFormat'
		| 'movieFolderFormat'
	>
): RadarrNamingManagedFields {
	return {
		renameMovies: config.renameMovies,
		replaceIllegalCharacters: config.replaceIllegalCharacters,
		colonReplacementFormat: config.colonReplacementFormat,
		standardMovieFormat: config.standardMovieFormat,
		movieFolderFormat: config.movieFolderFormat
	};
}

export function normalizeSonarrNamingConfig(
	config: Pick<
		SonarrNamingConfig | SonarrNamingApiManagedFields,
		| 'renameEpisodes'
		| 'replaceIllegalCharacters'
		| 'colonReplacementFormat'
		| 'customColonReplacementFormat'
		| 'multiEpisodeStyle'
		| 'standardEpisodeFormat'
		| 'dailyEpisodeFormat'
		| 'animeEpisodeFormat'
		| 'seriesFolderFormat'
		| 'seasonFolderFormat'
	>
): SonarrNamingManagedFields {
	return {
		renameEpisodes: config.renameEpisodes,
		replaceIllegalCharacters: config.replaceIllegalCharacters,
		colonReplacementFormat: colonReplacementFromDb(config.colonReplacementFormat),
		customColonReplacementFormat: normalizeOptionalNamingString(config.customColonReplacementFormat),
		multiEpisodeStyle: multiEpisodeStyleFromDb(config.multiEpisodeStyle),
		standardEpisodeFormat: config.standardEpisodeFormat,
		dailyEpisodeFormat: config.dailyEpisodeFormat,
		animeEpisodeFormat: config.animeEpisodeFormat,
		seriesFolderFormat: config.seriesFolderFormat,
		seasonFolderFormat: config.seasonFolderFormat
	};
}

function normalizeOptionalNamingString(value: string | null | undefined): string | null {
	if (value === null || value === undefined) return null;
	return value.trim() === '' ? null : value;
}

function mapPropersRepacks(pcdValue: string): ArrPropersAndRepacks {
	const mapping: Record<string, ArrPropersAndRepacks> = {
		doNotPrefer: 'doNotPrefer',
		preferAndUpgrade: 'preferAndUpgrade',
		doNotUpgradeAutomatically: 'doNotUpgrade'
	};
	return mapping[pcdValue] ?? 'doNotPrefer';
}
