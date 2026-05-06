import type { SeedOperation } from './pcd.ts';

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

	customFormatRegexCondition(input: {
		formatName: string;
		conditionName: string;
		regexName: string;
		type?: 'release_title' | 'release_group' | 'edition';
	}): SeedOperation {
		const type = input.type ?? 'release_title';
		return {
			sql: `INSERT INTO custom_formats (name, description, include_in_rename)
			      VALUES (${sqlValue(input.formatName)}, '', 0);

			      INSERT INTO custom_format_conditions
			        (custom_format_name, name, type, arr_type, negate, required)
			      VALUES (${sqlValue(input.formatName)}, ${sqlValue(input.conditionName)}, ${sqlValue(
							type
						)}, 'all', 0, 0);

			      INSERT INTO condition_patterns
			        (custom_format_name, condition_name, regular_expression_name)
			      VALUES (${sqlValue(input.formatName)}, ${sqlValue(input.conditionName)}, ${sqlValue(
							input.regexName
						)});`
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
