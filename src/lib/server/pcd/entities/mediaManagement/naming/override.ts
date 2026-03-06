import { getCache } from '$pcd/index.ts';
import type { PCDCache, WriteResult } from '$pcd/index.ts';
import type { RadarrNamingRow, SonarrNamingRow } from '$shared/pcd/display.ts';
import { getRadarrByName, getSonarrByName } from './read.ts';
import { updateRadarrNaming, updateSonarrNaming } from './update.ts';
import type { StoredOpMetadata, StoredDesiredState } from '$pcd/conflicts/overrideUtils.ts';
import { getDesiredTo, followRenameChain, valuesEqual } from '$pcd/conflicts/overrideUtils.ts';

type NamingTable = 'radarr_naming' | 'sonarr_naming';

async function resolveNamingName(
	cache: PCDCache,
	databaseId: number,
	table: NamingTable,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<string | null> {
	const candidates = [
		metadata?.stable_key?.value,
		metadata?.name,
		getDesiredTo<string>(desiredState?.name),
		typeof desiredState?.name === 'string' ? (desiredState.name as string) : null
	].filter((v): v is string => typeof v === 'string' && v.length > 0);

	if (candidates.length === 0) return null;

	for (const name of candidates) {
		const row = await cache.kb
			.selectFrom(table)
			.select('name')
			.where('name', '=', name)
			.executeTakeFirst();
		if (row) return row.name!;
	}

	const entityType = table === 'radarr_naming' ? 'radarr_naming' : 'sonarr_naming';
	const resolved = followRenameChain(databaseId, entityType, candidates[0]);
	if (resolved !== candidates[0]) {
		const row = await cache.kb
			.selectFrom(table)
			.select('name')
			.where('name', '=', resolved)
			.executeTakeFirst();
		if (row) return row.name!;
	}

	return null;
}

function resolveString(value: unknown, fallback: string): string {
	const resolved = getDesiredTo<string>(value);
	if (typeof resolved === 'string') return resolved;
	if (typeof value === 'string') return value;
	return fallback;
}

function resolveNullableString(value: unknown, fallback: string | null): string | null {
	const resolved = getDesiredTo<string | null>(value);
	if (resolved !== undefined) return resolved;
	if (typeof value === 'string' || value === null) return value as string | null;
	return fallback;
}

function resolveBoolean(value: unknown, fallback: boolean): boolean {
	const resolved = getDesiredTo<boolean>(value);
	if (typeof resolved === 'boolean') return resolved;
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value === 1;
	return fallback;
}

// ── Radarr ──

async function overrideRadarr(
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<WriteResult> {
	if (!desiredState) {
		return { success: false, error: 'Missing desired state for radarr naming override' };
	}

	const cache = getCache(databaseId);
	if (!cache) {
		return { success: false, error: 'Cache not available' };
	}

	const name = await resolveNamingName(cache, databaseId, 'radarr_naming', metadata, desiredState);
	if (!name) {
		return { success: false, error: 'Radarr naming config not found for override' };
	}

	const current = await getRadarrByName(cache, name);
	if (!current) {
		return { success: false, error: 'Radarr naming config not found for override' };
	}

	const desiredName = resolveString(desiredState.name, current.name);
	const desiredRename = resolveBoolean(desiredState.rename, current.rename);
	const desiredMovieFormat = resolveString(desiredState.movie_format, current.movie_format);
	const desiredMovieFolderFormat = resolveString(
		desiredState.movie_folder_format,
		current.movie_folder_format
	);
	const desiredReplaceIllegal = resolveBoolean(
		desiredState.replace_illegal_characters,
		current.replace_illegal_characters
	);
	const desiredColonFormat = resolveString(
		desiredState.colon_replacement_format,
		current.colon_replacement_format
	) as RadarrNamingRow['colon_replacement_format'];

	const matches =
		current.name === desiredName &&
		valuesEqual(current.rename, desiredRename) &&
		current.movie_format === desiredMovieFormat &&
		current.movie_folder_format === desiredMovieFolderFormat &&
		valuesEqual(current.replace_illegal_characters, desiredReplaceIllegal) &&
		current.colon_replacement_format === desiredColonFormat;

	if (matches) {
		return { success: true };
	}

	return updateRadarrNaming({
		databaseId,
		cache,
		layer: 'user',
		current,
		input: {
			name: desiredName,
			rename: desiredRename,
			movieFormat: desiredMovieFormat,
			movieFolderFormat: desiredMovieFolderFormat,
			replaceIllegalCharacters: desiredReplaceIllegal,
			colonReplacementFormat: desiredColonFormat
		}
	});
}

// ── Sonarr ──

async function overrideSonarr(
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<WriteResult> {
	if (!desiredState) {
		return { success: false, error: 'Missing desired state for sonarr naming override' };
	}

	const cache = getCache(databaseId);
	if (!cache) {
		return { success: false, error: 'Cache not available' };
	}

	const name = await resolveNamingName(cache, databaseId, 'sonarr_naming', metadata, desiredState);
	if (!name) {
		return { success: false, error: 'Sonarr naming config not found for override' };
	}

	const current = await getSonarrByName(cache, name);
	if (!current) {
		return { success: false, error: 'Sonarr naming config not found for override' };
	}

	const desiredName = resolveString(desiredState.name, current.name);
	const desiredRename = resolveBoolean(desiredState.rename, current.rename);
	const desiredStandard = resolveString(
		desiredState.standard_episode_format,
		current.standard_episode_format
	);
	const desiredDaily = resolveString(
		desiredState.daily_episode_format,
		current.daily_episode_format
	);
	const desiredAnime = resolveString(
		desiredState.anime_episode_format,
		current.anime_episode_format
	);
	const desiredSeriesFolder = resolveString(
		desiredState.series_folder_format,
		current.series_folder_format
	);
	const desiredSeasonFolder = resolveString(
		desiredState.season_folder_format,
		current.season_folder_format
	);
	const desiredReplaceIllegal = resolveBoolean(
		desiredState.replace_illegal_characters,
		current.replace_illegal_characters
	);
	const desiredColonFormat = resolveString(
		desiredState.colon_replacement_format,
		current.colon_replacement_format
	) as SonarrNamingRow['colon_replacement_format'];
	const desiredCustomColon = resolveNullableString(
		desiredState.custom_colon_replacement_format,
		current.custom_colon_replacement_format
	);
	const desiredMultiEpisode = resolveString(
		desiredState.multi_episode_style,
		current.multi_episode_style
	) as SonarrNamingRow['multi_episode_style'];

	const matches =
		current.name === desiredName &&
		valuesEqual(current.rename, desiredRename) &&
		current.standard_episode_format === desiredStandard &&
		current.daily_episode_format === desiredDaily &&
		current.anime_episode_format === desiredAnime &&
		current.series_folder_format === desiredSeriesFolder &&
		current.season_folder_format === desiredSeasonFolder &&
		valuesEqual(current.replace_illegal_characters, desiredReplaceIllegal) &&
		current.colon_replacement_format === desiredColonFormat &&
		current.custom_colon_replacement_format === desiredCustomColon &&
		current.multi_episode_style === desiredMultiEpisode;

	if (matches) {
		return { success: true };
	}

	return updateSonarrNaming({
		databaseId,
		cache,
		layer: 'user',
		current,
		input: {
			name: desiredName,
			rename: desiredRename,
			standardEpisodeFormat: desiredStandard,
			dailyEpisodeFormat: desiredDaily,
			animeEpisodeFormat: desiredAnime,
			seriesFolderFormat: desiredSeriesFolder,
			seasonFolderFormat: desiredSeasonFolder,
			replaceIllegalCharacters: desiredReplaceIllegal,
			colonReplacementFormat: desiredColonFormat,
			customColonReplacementFormat: desiredCustomColon,
			multiEpisodeStyle: desiredMultiEpisode
		}
	});
}

// ── Exports ──

export function overrideCreate(
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<WriteResult> {
	return metadata?.entity === 'sonarr_naming'
		? overrideSonarr(databaseId, metadata, desiredState)
		: overrideRadarr(databaseId, metadata, desiredState);
}

export function overrideUpdate(
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<WriteResult> {
	return metadata?.entity === 'sonarr_naming'
		? overrideSonarr(databaseId, metadata, desiredState)
		: overrideRadarr(databaseId, metadata, desiredState);
}
