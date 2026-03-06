/**
 * Portable Entity Validation
 *
 * Validates portable data shape before deserialization.
 * Returns a string error message if invalid, null if valid.
 */

import type { EntityType } from '$shared/pcd/portable.ts';

const VALID_PROTOCOLS = new Set(['prefer_usenet', 'prefer_torrent', 'only_usenet', 'only_torrent']);
const VALID_COLON_FORMATS = new Set(['delete', 'dash', 'space_dash', 'space_dash_space', 'smart']);
const VALID_MULTI_EPISODE_STYLES = new Set([
	'extend',
	'duplicate',
	'repeat',
	'scene',
	'range',
	'prefixed_range'
]);
const VALID_PROPERS_REPACKS = new Set([
	'do_not_prefer',
	'prefer_and_upgrade',
	'do_not_upgrade_automatically'
]);

export function validatePortableData(
	entityType: EntityType,
	data: Record<string, unknown>
): string | null {
	switch (entityType) {
		case 'delay_profile':
			return validateDelayProfile(data);
		case 'regular_expression':
			return validateRegularExpression(data);
		case 'custom_format':
			return validateCustomFormat(data);
		case 'quality_profile':
			return validateQualityProfile(data);
		case 'radarr_naming':
			return validateRadarrNaming(data);
		case 'sonarr_naming':
			return validateSonarrNaming(data);
		case 'radarr_media_settings':
		case 'sonarr_media_settings':
			return validateMediaSettings(data);
		case 'radarr_quality_definitions':
		case 'sonarr_quality_definitions':
			return validateQualityDefinitions(data);
		default:
			return null;
	}
}

function requireName(data: Record<string, unknown>): string | null {
	if (typeof data.name !== 'string' || !data.name.trim()) {
		return 'data.name is required and must be a non-empty string';
	}
	return null;
}

function validateDelayProfile(data: Record<string, unknown>): string | null {
	const nameError = requireName(data);
	if (nameError) return nameError;
	if (!VALID_PROTOCOLS.has(data.preferredProtocol as string)) {
		return `data.preferredProtocol must be one of: ${[...VALID_PROTOCOLS].join(', ')}`;
	}
	if (typeof data.usenetDelay !== 'number') {
		return 'data.usenetDelay must be a number';
	}
	if (typeof data.torrentDelay !== 'number') {
		return 'data.torrentDelay must be a number';
	}
	if (typeof data.bypassIfHighestQuality !== 'boolean') {
		return 'data.bypassIfHighestQuality must be a boolean';
	}
	if (typeof data.bypassIfAboveCfScore !== 'boolean') {
		return 'data.bypassIfAboveCfScore must be a boolean';
	}
	if (typeof data.minimumCfScore !== 'number') {
		return 'data.minimumCfScore must be a number';
	}
	return null;
}

function validateRegularExpression(data: Record<string, unknown>): string | null {
	const nameError = requireName(data);
	if (nameError) return nameError;
	if (typeof data.pattern !== 'string') {
		return 'data.pattern must be a string';
	}
	if (!Array.isArray(data.tags)) {
		return 'data.tags must be an array';
	}
	if (data.description !== null && typeof data.description !== 'string') {
		return 'data.description must be a string or null';
	}
	if (data.regex101Id !== null && typeof data.regex101Id !== 'string') {
		return 'data.regex101Id must be a string or null';
	}
	return null;
}

function validateCustomFormat(data: Record<string, unknown>): string | null {
	const nameError = requireName(data);
	if (nameError) return nameError;
	if (data.description !== null && typeof data.description !== 'string') {
		return 'data.description must be a string or null';
	}
	if (typeof data.includeInRename !== 'boolean') {
		return 'data.includeInRename must be a boolean';
	}
	if (!Array.isArray(data.tags)) {
		return 'data.tags must be an array';
	}
	if (!Array.isArray(data.conditions)) {
		return 'data.conditions must be an array';
	}
	if (!Array.isArray(data.tests)) {
		return 'data.tests must be an array';
	}
	return null;
}

function validateQualityProfile(data: Record<string, unknown>): string | null {
	const nameError = requireName(data);
	if (nameError) return nameError;
	if (data.description !== null && typeof data.description !== 'string') {
		return 'data.description must be a string or null';
	}
	if (!Array.isArray(data.tags)) {
		return 'data.tags must be an array';
	}
	if (data.language !== null && typeof data.language !== 'string') {
		return 'data.language must be a string or null';
	}
	if (!Array.isArray(data.orderedItems)) {
		return 'data.orderedItems must be an array';
	}
	if (typeof data.minimumScore !== 'number') {
		return 'data.minimumScore must be a number';
	}
	if (typeof data.upgradeUntilScore !== 'number') {
		return 'data.upgradeUntilScore must be a number';
	}
	if (typeof data.upgradeScoreIncrement !== 'number') {
		return 'data.upgradeScoreIncrement must be a number';
	}
	if (!Array.isArray(data.customFormatScores)) {
		return 'data.customFormatScores must be an array';
	}
	return null;
}

function validateRadarrNaming(data: Record<string, unknown>): string | null {
	const nameError = requireName(data);
	if (nameError) return nameError;
	if (typeof data.rename !== 'boolean') {
		return 'data.rename must be a boolean';
	}
	if (typeof data.movieFormat !== 'string') {
		return 'data.movieFormat must be a string';
	}
	if (typeof data.movieFolderFormat !== 'string') {
		return 'data.movieFolderFormat must be a string';
	}
	if (typeof data.replaceIllegalCharacters !== 'boolean') {
		return 'data.replaceIllegalCharacters must be a boolean';
	}
	if (!VALID_COLON_FORMATS.has(data.colonReplacementFormat as string)) {
		return `data.colonReplacementFormat must be one of: ${[...VALID_COLON_FORMATS].join(', ')}`;
	}
	return null;
}

function validateSonarrNaming(data: Record<string, unknown>): string | null {
	const nameError = requireName(data);
	if (nameError) return nameError;
	if (typeof data.rename !== 'boolean') {
		return 'data.rename must be a boolean';
	}
	if (typeof data.standardEpisodeFormat !== 'string') {
		return 'data.standardEpisodeFormat must be a string';
	}
	if (typeof data.dailyEpisodeFormat !== 'string') {
		return 'data.dailyEpisodeFormat must be a string';
	}
	if (typeof data.animeEpisodeFormat !== 'string') {
		return 'data.animeEpisodeFormat must be a string';
	}
	if (typeof data.seriesFolderFormat !== 'string') {
		return 'data.seriesFolderFormat must be a string';
	}
	if (typeof data.seasonFolderFormat !== 'string') {
		return 'data.seasonFolderFormat must be a string';
	}
	if (typeof data.replaceIllegalCharacters !== 'boolean') {
		return 'data.replaceIllegalCharacters must be a boolean';
	}
	if (!VALID_COLON_FORMATS.has(data.colonReplacementFormat as string)) {
		return `data.colonReplacementFormat must be one of: ${[...VALID_COLON_FORMATS].join(', ')}`;
	}
	if (
		data.customColonReplacementFormat !== null &&
		typeof data.customColonReplacementFormat !== 'string'
	) {
		return 'data.customColonReplacementFormat must be a string or null';
	}
	if (!VALID_MULTI_EPISODE_STYLES.has(data.multiEpisodeStyle as string)) {
		return `data.multiEpisodeStyle must be one of: ${[...VALID_MULTI_EPISODE_STYLES].join(', ')}`;
	}
	return null;
}

function validateMediaSettings(data: Record<string, unknown>): string | null {
	const nameError = requireName(data);
	if (nameError) return nameError;
	if (!VALID_PROPERS_REPACKS.has(data.propersRepacks as string)) {
		return `data.propersRepacks must be one of: ${[...VALID_PROPERS_REPACKS].join(', ')}`;
	}
	if (typeof data.enableMediaInfo !== 'boolean') {
		return 'data.enableMediaInfo must be a boolean';
	}
	return null;
}

function validateQualityDefinitions(data: Record<string, unknown>): string | null {
	const nameError = requireName(data);
	if (nameError) return nameError;
	if (!Array.isArray(data.entries)) {
		return 'data.entries must be an array';
	}
	for (const entry of data.entries as Record<string, unknown>[]) {
		if (typeof entry.quality_name !== 'string') {
			return 'Each entry must have a quality_name string';
		}
		if (typeof entry.min_size !== 'number') {
			return 'Each entry must have a min_size number';
		}
		if (typeof entry.max_size !== 'number') {
			return 'Each entry must have a max_size number';
		}
		if (typeof entry.preferred_size !== 'number') {
			return 'Each entry must have a preferred_size number';
		}
	}
	return null;
}
