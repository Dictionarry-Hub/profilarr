import type { SeedOperation } from './pcd.ts';
import {
	colonReplacementToDb,
	multiEpisodeStyleToDb,
	type MultiEpisodeStyle,
	type RadarrColonReplacementFormat,
	type SonarrColonReplacementFormat
} from '$shared/pcd/mediaManagement.ts';

type QualityProfileQualityItem = {
	type: 'quality' | 'group';
	name: string;
	position: number;
	enabled?: boolean;
	upgradeUntil?: boolean;
	members?: Array<string | { name: string }>;
};

export const base = {
	delayProfile(input: {
		name: string;
		preferredProtocol?: 'prefer_usenet' | 'prefer_torrent' | 'only_usenet' | 'only_torrent';
		usenetDelay?: number | null;
		torrentDelay?: number | null;
		bypassIfHighestQuality?: boolean;
		bypassIfAboveCfScore?: boolean;
		minimumCfScore?: number | null;
	}): SeedOperation {
		const preferredProtocol = input.preferredProtocol ?? 'prefer_usenet';
		const usenetDelay = preferredProtocol === 'only_torrent' ? null : (input.usenetDelay ?? 0);
		const torrentDelay = preferredProtocol === 'only_usenet' ? null : (input.torrentDelay ?? 0);
		const bypassIfAboveCfScore = input.bypassIfAboveCfScore ?? false;
		const minimumCfScore = bypassIfAboveCfScore ? (input.minimumCfScore ?? 0) : null;

		return {
			sql: `INSERT INTO delay_profiles (
				       name,
				       preferred_protocol,
				       usenet_delay,
				       torrent_delay,
				       bypass_if_highest_quality,
				       bypass_if_above_custom_format_score,
				       minimum_custom_format_score
			      )
			      VALUES (
				       ${sqlValue(input.name)},
				       ${sqlValue(preferredProtocol)},
				       ${sqlNumber(usenetDelay)},
				       ${sqlNumber(torrentDelay)},
				       ${input.bypassIfHighestQuality ? 1 : 0},
				       ${bypassIfAboveCfScore ? 1 : 0},
				       ${sqlNumber(minimumCfScore)}
			      );`
		};
	},

	regex(input: {
		name: string;
		pattern: string;
		description?: string | null;
		regex101Id?: string | null;
		tags?: string[];
	}): SeedOperation {
		const description = 'description' in input ? (input.description ?? null) : '';
		const regex101Id = input.regex101Id ?? null;
		const tags = Array.from(new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean)));
		const tagSql = tags.map((tag) =>
			[
				`INSERT INTO tags (name) VALUES (${sqlValue(tag)}) ON CONFLICT(name) DO NOTHING;`,
				`INSERT INTO regular_expression_tags (regular_expression_name, tag_name) VALUES (${sqlValue(
					input.name
				)}, ${sqlValue(tag)});`
			].join('\n')
		);

		return {
			sql: [
				`INSERT INTO regular_expressions (name, pattern, description, regex101_id)
				 VALUES (${sqlValue(input.name)}, ${sqlValue(input.pattern)}, ${sqlValue(
						description
					)}, ${sqlValue(regex101Id)});`,
				...tagSql
			].join('\n')
		};
	},

	customFormat(input: {
		name: string;
		description?: string | null;
		includeInRename?: boolean;
		tags?: string[];
	}): SeedOperation {
		const description = 'description' in input ? (input.description ?? null) : '';
		const includeInRename = input.includeInRename ?? false;
		const tags = Array.from(new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean)));
		const tagSql = tags.map((tag) =>
			[
				`INSERT INTO tags (name) VALUES (${sqlValue(tag)}) ON CONFLICT(name) DO NOTHING;`,
				`INSERT INTO custom_format_tags (custom_format_name, tag_name) VALUES (${sqlValue(
					input.name
				)}, ${sqlValue(tag)});`
			].join('\n')
		);

		return {
			sql: [
				`INSERT INTO custom_formats (name, description, include_in_rename)
				 VALUES (${sqlValue(input.name)}, ${sqlValue(description)}, ${includeInRename ? 1 : 0});`,
				...tagSql
			].join('\n')
		};
	},

	languages(names: string[]): SeedOperation {
		const sql = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)))
			.map(
				(name) =>
					`INSERT INTO languages (name) VALUES (${sqlValue(name)}) ON CONFLICT(name) DO NOTHING;`
			)
			.join('\n');
		return { sql };
	},

	qualityProfile(input: {
		name: string;
		description?: string | null;
		tags?: string[];
		language?: string | null;
		upgradesAllowed?: boolean;
		minimumScore?: number;
		upgradeUntilScore?: number;
		upgradeScoreIncrement?: number;
		customFormatScores?: Array<{
			customFormatName: string;
			arrType?: 'all' | 'radarr' | 'sonarr';
			score: number;
		}>;
		qualityItems?: QualityProfileQualityItem[];
	}): SeedOperation {
		const description = 'description' in input ? (input.description ?? null) : '';
		const tags = Array.from(new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean)));
		const tagSql = tags.map((tag) =>
			[
				`INSERT INTO tags (name) VALUES (${sqlValue(tag)}) ON CONFLICT(name) DO NOTHING;`,
				`INSERT INTO quality_profile_tags (quality_profile_name, tag_name) VALUES (${sqlValue(
					input.name
				)}, ${sqlValue(tag)});`
			].join('\n')
		);
		const languageSql = input.language
			? [
					`INSERT INTO languages (name) VALUES (${sqlValue(input.language)}) ON CONFLICT(name) DO NOTHING;`,
					`INSERT INTO quality_profile_languages (quality_profile_name, language_name, type) VALUES (${sqlValue(
						input.name
					)}, ${sqlValue(input.language)}, 'simple');`
				]
			: [];
		const customFormatScoreSql = (input.customFormatScores ?? []).map(
			(score) =>
				`INSERT INTO quality_profile_custom_formats (quality_profile_name, custom_format_name, arr_type, score)
			 VALUES (${sqlValue(input.name)}, ${sqlValue(score.customFormatName)}, ${sqlValue(
					score.arrType ?? 'all'
				)}, ${sqlNumber(score.score)});`
		);
		const qualityItemSql = qualityProfileQualityItemsSql(input.name, input.qualityItems ?? []);

		return {
			sql: [
				`INSERT INTO quality_profiles (
				       name,
				       description,
				       upgrades_allowed,
				       minimum_custom_format_score,
				       upgrade_until_score,
				       upgrade_score_increment
			      )
			      VALUES (
				       ${sqlValue(input.name)},
				       ${sqlValue(description)},
				       ${input.upgradesAllowed === false ? 0 : 1},
				       ${sqlNumber(input.minimumScore ?? 0)},
				       ${sqlNumber(input.upgradeUntilScore ?? 0)},
				       ${sqlNumber(input.upgradeScoreIncrement ?? 1)}
			      );`,
				...tagSql,
				...languageSql,
				...customFormatScoreSql,
				qualityItemSql
			].join('\n')
		};
	},

	radarrMediaSettings(input: {
		name: string;
		propersRepacks?: 'doNotPrefer' | 'doNotUpgradeAutomatically' | 'preferAndUpgrade';
		enableMediaInfo?: boolean;
	}): SeedOperation {
		return mediaSettingsSeed('radarr_media_settings', input);
	},

	sonarrMediaSettings(input: {
		name: string;
		propersRepacks?: 'doNotPrefer' | 'doNotUpgradeAutomatically' | 'preferAndUpgrade';
		enableMediaInfo?: boolean;
	}): SeedOperation {
		return mediaSettingsSeed('sonarr_media_settings', input);
	},

	radarrNaming(input: {
		name: string;
		rename?: boolean;
		movieFormat?: string;
		movieFolderFormat?: string;
		replaceIllegalCharacters?: boolean;
		colonReplacementFormat?: RadarrColonReplacementFormat;
	}): SeedOperation {
		const rename = input.rename ?? true;
		const movieFormat = input.movieFormat ?? '';
		const movieFolderFormat = input.movieFolderFormat ?? '';
		const replaceIllegal = input.replaceIllegalCharacters ?? false;
		const colon = input.colonReplacementFormat ?? 'delete';
		return {
			sql: `INSERT INTO radarr_naming (
			              name,
			              rename,
			              movie_format,
			              movie_folder_format,
			              replace_illegal_characters,
			              colon_replacement_format
			          )
			          VALUES (
			              ${sqlValue(input.name)},
			              ${rename ? 1 : 0},
			              ${sqlValue(movieFormat)},
			              ${sqlValue(movieFolderFormat)},
			              ${replaceIllegal ? 1 : 0},
			              ${sqlValue(colon)}
			          );`
		};
	},

	sonarrNaming(input: {
		name: string;
		rename?: boolean;
		standardEpisodeFormat?: string;
		dailyEpisodeFormat?: string;
		animeEpisodeFormat?: string;
		seriesFolderFormat?: string;
		seasonFolderFormat?: string;
		replaceIllegalCharacters?: boolean;
		colonReplacementFormat?: SonarrColonReplacementFormat;
		customColonReplacementFormat?: string | null;
		multiEpisodeStyle?: MultiEpisodeStyle;
	}): SeedOperation {
		const rename = input.rename ?? true;
		const standardEpisode = input.standardEpisodeFormat ?? '';
		const dailyEpisode = input.dailyEpisodeFormat ?? '';
		const animeEpisode = input.animeEpisodeFormat ?? '';
		const seriesFolder = input.seriesFolderFormat ?? '';
		const seasonFolder = input.seasonFolderFormat ?? '';
		const replaceIllegal = input.replaceIllegalCharacters ?? false;
		const colon = colonReplacementToDb(input.colonReplacementFormat ?? 'delete');
		const customColon = input.customColonReplacementFormat ?? null;
		const multi = multiEpisodeStyleToDb(input.multiEpisodeStyle ?? 'extend');
		return {
			sql: `INSERT INTO sonarr_naming (
			              name,
			              rename,
			              standard_episode_format,
			              daily_episode_format,
			              anime_episode_format,
			              series_folder_format,
			              season_folder_format,
			              replace_illegal_characters,
			              colon_replacement_format,
			              custom_colon_replacement_format,
			              multi_episode_style
			          )
			          VALUES (
			              ${sqlValue(input.name)},
			              ${rename ? 1 : 0},
			              ${sqlValue(standardEpisode)},
			              ${sqlValue(dailyEpisode)},
			              ${sqlValue(animeEpisode)},
			              ${sqlValue(seriesFolder)},
			              ${sqlValue(seasonFolder)},
			              ${replaceIllegal ? 1 : 0},
			              ${colon},
			              ${sqlValue(customColon)},
			              ${multi}
			          );`
		};
	},

	qualities(input: { entries: { name: string; arrType: 'radarr' | 'sonarr' }[] }): SeedOperation {
		const inserts = input.entries
			.map(
				(entry) =>
					`INSERT OR IGNORE INTO qualities (name) VALUES (${sqlValue(entry.name)});\n` +
					`INSERT OR IGNORE INTO quality_api_mappings (quality_name, arr_type, api_name) VALUES (${sqlValue(
						entry.name
					)}, ${sqlValue(entry.arrType)}, ${sqlValue(entry.name)});`
			)
			.join('\n');
		return { sql: inserts };
	},

	radarrQualityDefinitions(input: {
		name: string;
		entries: QualityDefinitionEntry[];
	}): SeedOperation {
		return qualityDefinitionsSeed('radarr_quality_definitions', 'radarr', input);
	},

	sonarrQualityDefinitions(input: {
		name: string;
		entries: QualityDefinitionEntry[];
	}): SeedOperation {
		return qualityDefinitionsSeed('sonarr_quality_definitions', 'sonarr', input);
	},

	customFormatResolutionCondition(input: {
		formatName: string;
		conditionName: string;
		resolution: string;
		negate?: boolean;
		required?: boolean;
		arrType?: 'all' | 'radarr' | 'sonarr';
	}): SeedOperation {
		return {
			sql: `INSERT INTO custom_formats (name, description, include_in_rename)
			      VALUES (${sqlValue(input.formatName)}, '', 0);

			      INSERT INTO custom_format_conditions
			        (custom_format_name, name, type, arr_type, negate, required)
			      VALUES (
			        ${sqlValue(input.formatName)},
			        ${sqlValue(input.conditionName)},
			        'resolution',
			        ${sqlValue(input.arrType ?? 'all')},
			        ${input.negate ? 1 : 0},
			        ${input.required ? 1 : 0}
			      );

			      INSERT INTO condition_resolutions
			        (custom_format_name, condition_name, resolution)
			      VALUES (
			        ${sqlValue(input.formatName)},
			        ${sqlValue(input.conditionName)},
			        ${sqlValue(input.resolution)}
			      );`
		};
	},

	customFormatRegexCondition(input: {
		formatName: string;
		conditionName: string;
		regexName: string;
		type?: 'release_title' | 'release_group' | 'edition';
		arrType?: 'all' | 'radarr' | 'sonarr' | null;
	}): SeedOperation {
		const type = input.type ?? 'release_title';
		const arrTypeSql = input.arrType === undefined ? "'all'" : sqlValue(input.arrType);
		return {
			sql: `INSERT INTO custom_formats (name, description, include_in_rename)
			      VALUES (${sqlValue(input.formatName)}, '', 0);

			      INSERT INTO custom_format_conditions
			        (custom_format_name, name, type, arr_type, negate, required)
			      VALUES (${sqlValue(input.formatName)}, ${sqlValue(input.conditionName)}, ${sqlValue(
							type
						)}, ${arrTypeSql}, 0, 0);

			      INSERT INTO condition_patterns
			        (custom_format_name, condition_name, regular_expression_name)
			      VALUES (${sqlValue(input.formatName)}, ${sqlValue(input.conditionName)}, ${sqlValue(
							input.regexName
						)});`
		};
	},

	/**
	 * Adds a test row to an existing custom format.
	 * The CF must already exist (use customFormatRegexCondition first).
	 * description: '' seeds an empty-string description, reproducing the
	 * createTest truthy-check bug: '' → NULL in target, causing a mismatch.
	 */
	customFormatTest(input: {
		formatName: string;
		title: string;
		type?: 'movie' | 'series';
		shouldMatch?: boolean;
		description?: string | null;
	}): SeedOperation {
		const type = input.type ?? 'movie';
		const shouldMatch = input.shouldMatch !== false ? 1 : 0;
		const descSql = input.description == null ? 'NULL' : sqlValue(input.description);
		return {
			sql: `INSERT INTO custom_format_tests (custom_format_name, title, type, should_match, description)
			      VALUES (${sqlValue(input.formatName)}, ${sqlValue(input.title)}, ${sqlValue(type)}, ${shouldMatch}, ${descSql});`
		};
	}
};

function sqlValue(value: string | null): string {
	if (value === null) return 'NULL';
	return `'${value.replace(/'/g, "''")}'`;
}

function sqlNumber(value: number | null): string {
	return value === null ? 'NULL' : String(value);
}

function qualityProfileQualityItemsSql(
	profileName: string,
	items: QualityProfileQualityItem[]
): string {
	if (items.length === 0) return '';

	const qualityNames = Array.from(
		new Set(
			items.flatMap((item) =>
				item.type === 'quality' ? [item.name] : memberNames(item.members ?? [])
			)
		)
	);
	const qualitySql = qualityNames
		.map((name) => `INSERT OR IGNORE INTO qualities (name) VALUES (${sqlValue(name)});`)
		.join('\n');
	const itemSql = items.map((item) => {
		const enabled = item.enabled ?? true;
		const upgradeUntil = item.upgradeUntil ?? false;

		if (item.type === 'quality') {
			return `INSERT INTO quality_profile_qualities
			        (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until)
			        VALUES (${sqlValue(profileName)}, ${sqlValue(item.name)}, NULL, ${item.position}, ${
								enabled ? 1 : 0
							}, ${upgradeUntil ? 1 : 0});`;
		}

		const members = Array.from(new Set(memberNames(item.members ?? [])));
		const memberSql = members
			.map(
				(member, index) =>
					`INSERT INTO quality_group_members
					 (quality_profile_name, quality_group_name, quality_name, position)
					 VALUES (${sqlValue(profileName)}, ${sqlValue(item.name)}, ${sqlValue(member)}, ${index});`
			)
			.join('\n');

		return [
			`INSERT INTO quality_groups (quality_profile_name, name)
			 VALUES (${sqlValue(profileName)}, ${sqlValue(item.name)});`,
			memberSql,
			`INSERT INTO quality_profile_qualities
			 (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until)
			 VALUES (${sqlValue(profileName)}, NULL, ${sqlValue(item.name)}, ${item.position}, ${
					enabled ? 1 : 0
				}, ${upgradeUntil ? 1 : 0});`
		].join('\n');
	});

	return [qualitySql, ...itemSql].join('\n');
}

function memberNames(members: Array<string | { name: string }>): string[] {
	return members
		.map((member) => (typeof member === 'string' ? member : member.name))
		.filter(Boolean);
}

function mediaSettingsSeed(
	table: 'radarr_media_settings' | 'sonarr_media_settings',
	input: {
		name: string;
		propersRepacks?: 'doNotPrefer' | 'doNotUpgradeAutomatically' | 'preferAndUpgrade';
		enableMediaInfo?: boolean;
	}
): SeedOperation {
	const propersRepacks = input.propersRepacks ?? 'doNotPrefer';
	const enableMediaInfo = input.enableMediaInfo ?? false;
	return {
		sql: `INSERT INTO ${table} (name, propers_repacks, enable_media_info)
			  VALUES (${sqlValue(input.name)}, ${sqlValue(propersRepacks)}, ${enableMediaInfo ? 1 : 0});`
	};
}

interface QualityDefinitionEntry {
	quality_name: string;
	min_size: number;
	max_size: number;
	preferred_size: number;
}

function qualityDefinitionsSeed(
	table: 'radarr_quality_definitions' | 'sonarr_quality_definitions',
	arrType: 'radarr' | 'sonarr',
	input: { name: string; entries: QualityDefinitionEntry[] }
): SeedOperation {
	const qualityInserts = input.entries
		.map(
			(entry) =>
				`INSERT OR IGNORE INTO qualities (name) VALUES (${sqlValue(entry.quality_name)});\n` +
				`INSERT OR IGNORE INTO quality_api_mappings (quality_name, arr_type, api_name) VALUES (${sqlValue(
					entry.quality_name
				)}, ${sqlValue(arrType)}, ${sqlValue(entry.quality_name)});`
		)
		.join('\n');

	const definitionInserts = input.entries
		.map(
			(entry) =>
				`INSERT INTO ${table} (name, quality_name, min_size, max_size, preferred_size) VALUES (` +
				`${sqlValue(input.name)}, ${sqlValue(entry.quality_name)}, ${entry.min_size}, ${entry.max_size}, ${entry.preferred_size});`
		)
		.join('\n');

	return { sql: `${qualityInserts}\n${definitionInserts}` };
}
