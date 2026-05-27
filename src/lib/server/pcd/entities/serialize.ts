/**
 * Entity Serialization
 *
 * Reads full entities from PCD cache and returns portable format.
 * Used by clone (serialize → rename → deserialize) and future export.
 */

import type { PCDCache } from '$pcd/index.ts';
import type {
	PortableDelayProfile,
	PortableRegularExpression,
	PortableCustomFormat,
	PortableQualityProfile,
	PortableRadarrNaming,
	PortableSonarrNaming,
	PortableMediaSettings,
	PortableQualityDefinitions
} from '$shared/pcd/portable.ts';
import * as delayProfileQueries from './delayProfiles/index.ts';
import * as cfQueries from './customFormats/index.ts';
import * as qpQueries from './qualityProfiles/index.ts';
import * as namingQueries from './mediaManagement/naming/index.ts';
import * as mediaSettingsQueries from './mediaManagement/media-settings/index.ts';
import * as qualityDefsQueries from './mediaManagement/quality-definitions/index.ts';

// ============================================================================
// DELAY PROFILES
// ============================================================================

export async function serializeDelayProfile(
	cache: PCDCache,
	name: string
): Promise<PortableDelayProfile> {
	const row = await delayProfileQueries.getByName(cache, name);
	if (!row) throw new Error(`Delay profile "${name}" not found`);

	return {
		name: row.name,
		preferredProtocol: row.preferred_protocol,
		usenetDelay: row.usenet_delay ?? 0,
		torrentDelay: row.torrent_delay ?? 0,
		bypassIfHighestQuality: row.bypass_if_highest_quality,
		bypassIfAboveCfScore: row.bypass_if_above_custom_format_score,
		minimumCfScore: row.minimum_custom_format_score ?? 0
	};
}

// ============================================================================
// REGULAR EXPRESSIONS
// ============================================================================

export async function serializeRegularExpression(
	cache: PCDCache,
	name: string
): Promise<PortableRegularExpression> {
	const db = cache.kb;

	const regex = await db
		.selectFrom('regular_expressions')
		.select(['name', 'pattern', 'description', 'regex101_id'])
		.where('name', '=', name)
		.executeTakeFirst();

	if (!regex) throw new Error(`Regular expression "${name}" not found`);

	const tags = await db
		.selectFrom('regular_expression_tags as ret')
		.innerJoin('tags as t', 't.name', 'ret.tag_name')
		.select(['t.name'])
		.where('ret.regular_expression_name', '=', name)
		.orderBy('t.name')
		.execute();

	return {
		name: regex.name,
		pattern: regex.pattern,
		tags: tags.map((t) => t.name),
		description: regex.description || null,
		regex101Id: regex.regex101_id || null
	};
}

// ============================================================================
// CUSTOM FORMATS
// ============================================================================

export async function serializeCustomFormat(
	cache: PCDCache,
	name: string
): Promise<PortableCustomFormat> {
	const db = cache.kb;

	const format = await db
		.selectFrom('custom_formats')
		.select(['name', 'description', 'include_in_rename'])
		.where('name', '=', name)
		.executeTakeFirst();

	if (!format) throw new Error(`Custom format "${name}" not found`);

	const tags = await db
		.selectFrom('custom_format_tags as cft')
		.innerJoin('tags as t', 't.name', 'cft.tag_name')
		.select(['t.name'])
		.where('cft.custom_format_name', '=', name)
		.orderBy('t.name')
		.execute();

	const conditions = await cfQueries.getConditionsForEvaluation(cache, name);
	const tests = await cfQueries.listTests(cache, name);

	return {
		name: format.name,
		description: format.description || null,
		includeInRename: format.include_in_rename === 1,
		tags: tags.map((t) => t.name),
		conditions,
		tests: tests.map((t) => ({
			title: t.title,
			type: t.type as 'movie' | 'series',
			shouldMatch: t.should_match,
			description: t.description
		}))
	};
}

// ============================================================================
// QUALITY PROFILES
// ============================================================================

export async function serializeQualityProfile(
	cache: PCDCache,
	name: string
): Promise<PortableQualityProfile> {
	const db = cache.kb;

	const profile = await db
		.selectFrom('quality_profiles')
		.select([
			'name',
			'description',
			'upgrades_allowed',
			'minimum_custom_format_score',
			'upgrade_until_score',
			'upgrade_score_increment'
		])
		.where('name', '=', name)
		.executeTakeFirst();

	if (!profile) throw new Error(`Quality profile "${name}" not found`);

	const tags = await db
		.selectFrom('quality_profile_tags as qpt')
		.innerJoin('tags as t', 't.name', 'qpt.tag_name')
		.select(['t.name'])
		.where('qpt.quality_profile_name', '=', name)
		.orderBy('t.name')
		.execute();

	const languageRow = await db
		.selectFrom('quality_profile_languages as qpl')
		.select(['qpl.language_name'])
		.where('qpl.quality_profile_name', '=', name)
		.executeTakeFirst();

	// databaseId param is unused in qualities()
	const qualitiesData = await qpQueries.qualities(cache, 0, name);

	const scores = await db
		.selectFrom('quality_profile_custom_formats')
		.select(['custom_format_name', 'arr_type', 'score'])
		.where('quality_profile_name', '=', name)
		.execute();

	return {
		name: profile.name,
		description: profile.description || null,
		tags: tags.map((t) => t.name),
		language: languageRow?.language_name ?? null,
		orderedItems: qualitiesData.orderedItems,
		upgradesAllowed: profile.upgrades_allowed === 1,
		minimumScore: profile.minimum_custom_format_score,
		upgradeUntilScore: profile.upgrade_until_score,
		upgradeScoreIncrement: profile.upgrade_score_increment,
		customFormatScores: scores.map((s) => ({
			customFormatName: s.custom_format_name,
			arrType: s.arr_type,
			score: s.score
		}))
	};
}

// ============================================================================
// NAMING
// ============================================================================

export async function serializeRadarrNaming(
	cache: PCDCache,
	name: string
): Promise<PortableRadarrNaming> {
	const row = await namingQueries.getRadarrByName(cache, name);
	if (!row) throw new Error(`Radarr naming "${name}" not found`);

	return {
		name: row.name,
		rename: row.rename,
		movieFormat: row.movie_format,
		movieFolderFormat: row.movie_folder_format,
		replaceIllegalCharacters: row.replace_illegal_characters,
		colonReplacementFormat: row.colon_replacement_format
	};
}

export async function serializeSonarrNaming(
	cache: PCDCache,
	name: string
): Promise<PortableSonarrNaming> {
	const row = await namingQueries.getSonarrByName(cache, name);
	if (!row) throw new Error(`Sonarr naming "${name}" not found`);

	return {
		name: row.name,
		rename: row.rename,
		standardEpisodeFormat: row.standard_episode_format,
		dailyEpisodeFormat: row.daily_episode_format,
		animeEpisodeFormat: row.anime_episode_format,
		seriesFolderFormat: row.series_folder_format,
		seasonFolderFormat: row.season_folder_format,
		replaceIllegalCharacters: row.replace_illegal_characters,
		colonReplacementFormat: row.colon_replacement_format,
		customColonReplacementFormat: row.custom_colon_replacement_format,
		multiEpisodeStyle: row.multi_episode_style
	};
}

// ============================================================================
// MEDIA SETTINGS
// ============================================================================

export async function serializeRadarrMediaSettings(
	cache: PCDCache,
	name: string
): Promise<PortableMediaSettings> {
	const row = await mediaSettingsQueries.getRadarrByName(cache, name);
	if (!row) throw new Error(`Radarr media settings "${name}" not found`);

	return {
		name: row.name,
		propersRepacks: row.propers_repacks,
		enableMediaInfo: row.enable_media_info
	};
}

export async function serializeSonarrMediaSettings(
	cache: PCDCache,
	name: string
): Promise<PortableMediaSettings> {
	const row = await mediaSettingsQueries.getSonarrByName(cache, name);
	if (!row) throw new Error(`Sonarr media settings "${name}" not found`);

	return {
		name: row.name,
		propersRepacks: row.propers_repacks,
		enableMediaInfo: row.enable_media_info
	};
}

// ============================================================================
// QUALITY DEFINITIONS
// ============================================================================

export async function serializeRadarrQualityDefinitions(
	cache: PCDCache,
	name: string
): Promise<PortableQualityDefinitions> {
	const config = await qualityDefsQueries.getRadarrByName(cache, name);
	if (!config) throw new Error(`Radarr quality definitions "${name}" not found`);

	return {
		name: config.name,
		entries: config.entries
	};
}

export async function serializeSonarrQualityDefinitions(
	cache: PCDCache,
	name: string
): Promise<PortableQualityDefinitions> {
	const config = await qualityDefsQueries.getSonarrByName(cache, name);
	if (!config) throw new Error(`Sonarr quality definitions "${name}" not found`);

	return {
		name: config.name,
		entries: config.entries
	};
}
