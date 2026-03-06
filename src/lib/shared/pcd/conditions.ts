/**
 * Condition types and their valid values for custom formats
 */

import type { ArrType } from './types.ts';

// Condition type definitions (ordered for display sorting)
export const CONDITION_TYPES = [
	{ value: 'resolution', label: 'Resolution', arrType: 'all' as ArrType },
	{ value: 'source', label: 'Source', arrType: 'all' as ArrType },
	{ value: 'quality_modifier', label: 'Quality Modifier', arrType: 'radarr' as ArrType },
	{ value: 'release_title', label: 'Release Title', arrType: 'all' as ArrType },
	{ value: 'release_group', label: 'Release Group', arrType: 'all' as ArrType },
	{ value: 'edition', label: 'Edition', arrType: 'radarr' as ArrType },
	{ value: 'language', label: 'Language', arrType: 'all' as ArrType },
	{ value: 'release_type', label: 'Release Type', arrType: 'sonarr' as ArrType },
	{ value: 'indexer_flag', label: 'Indexer Flag', arrType: 'all' as ArrType },
	{ value: 'size', label: 'Size', arrType: 'all' as ArrType },
	{ value: 'year', label: 'Year', arrType: 'all' as ArrType }
] as const;

// Type order index for sorting
const TYPE_ORDER: Map<string, number> = new Map(CONDITION_TYPES.map((t, i) => [t.value, i]));

/**
 * Get the status priority for sorting: required=0, negated=1, optional=2
 */
function getStatusPriority(required: boolean, negate: boolean): number {
	if (required && !negate) return 0; // Required
	if (negate) return 1; // Negated (includes required+negate)
	return 2; // Optional
}

/**
 * Sort conditions by: required/negated/optional, then type order, then alphabetical
 */
export function sortConditions<
	T extends { required: boolean; negate: boolean; type: string; name: string }
>(conditions: T[]): T[] {
	return [...conditions].sort((a, b) => {
		// Primary: status (required -> negated -> optional)
		const statusA = getStatusPriority(a.required, a.negate);
		const statusB = getStatusPriority(b.required, b.negate);
		if (statusA !== statusB) return statusA - statusB;

		// Secondary: type order
		const typeA = TYPE_ORDER.get(a.type) ?? 999;
		const typeB = TYPE_ORDER.get(b.type) ?? 999;
		if (typeA !== typeB) return typeA - typeB;

		// Tertiary: alphabetical by name
		return a.name.localeCompare(b.name);
	});
}

// Pattern-based types (use regex patterns as values)
export const PATTERN_TYPES = ['release_title', 'release_group', 'edition'] as const;

export type ConditionType = (typeof CONDITION_TYPES)[number]['value'];

// Source values
export const SOURCE_VALUES = [
	{ value: 'unknown', label: 'Unknown', arrType: 'all' as ArrType },
	{ value: 'television', label: 'Television', arrType: 'all' as ArrType },
	{ value: 'television_raw', label: 'Television Raw', arrType: 'sonarr' as ArrType },
	{ value: 'web_dl', label: 'WEB-DL', arrType: 'all' as ArrType },
	{ value: 'webrip', label: 'WEBRip', arrType: 'all' as ArrType },
	{ value: 'dvd', label: 'DVD', arrType: 'all' as ArrType },
	{ value: 'bluray', label: 'Bluray', arrType: 'all' as ArrType },
	{ value: 'bluray_raw', label: 'Bluray Raw', arrType: 'sonarr' as ArrType },
	{ value: 'cam', label: 'CAM', arrType: 'all' as ArrType },
	{ value: 'telesync', label: 'Telesync', arrType: 'all' as ArrType },
	{ value: 'telecine', label: 'Telecine', arrType: 'all' as ArrType },
	{ value: 'workprint', label: 'Workprint', arrType: 'all' as ArrType }
] as const;

// Resolution values
export const RESOLUTION_VALUES = [
	{ value: '360p', label: '360p', arrType: 'all' as ArrType },
	{ value: '480p', label: '480p', arrType: 'all' as ArrType },
	{ value: '540p', label: '540p', arrType: 'all' as ArrType },
	{ value: '576p', label: '576p', arrType: 'all' as ArrType },
	{ value: '720p', label: '720p', arrType: 'all' as ArrType },
	{ value: '1080p', label: '1080p', arrType: 'all' as ArrType },
	{ value: '2160p', label: '2160p', arrType: 'all' as ArrType }
] as const;

// Quality modifier values (Radarr only)
export const QUALITY_MODIFIER_VALUES = [
	{ value: 'none', label: 'None', arrType: 'radarr' as ArrType },
	{ value: 'regional', label: 'Regional', arrType: 'radarr' as ArrType },
	{ value: 'screener', label: 'Screener', arrType: 'radarr' as ArrType },
	{ value: 'rawhd', label: 'RawHD', arrType: 'radarr' as ArrType },
	{ value: 'brdisk', label: 'BRDISK', arrType: 'radarr' as ArrType },
	{ value: 'remux', label: 'REMUX', arrType: 'radarr' as ArrType }
] as const;

// Release type values (Sonarr only)
export const RELEASE_TYPE_VALUES = [
	{ value: 'single_episode', label: 'Single Episode', arrType: 'sonarr' as ArrType },
	{ value: 'multi_episode', label: 'Multi Episode', arrType: 'sonarr' as ArrType },
	{ value: 'season_pack', label: 'Season Pack', arrType: 'sonarr' as ArrType }
] as const;

// Indexer flag values
export const INDEXER_FLAG_VALUES = [
	{ value: 'freeleech', label: 'Freeleech', arrType: 'all' as ArrType },
	{ value: 'halfleech', label: 'Halfleech', arrType: 'all' as ArrType },
	{ value: 'double_upload', label: 'Double Upload', arrType: 'all' as ArrType },
	{ value: 'internal', label: 'Internal', arrType: 'all' as ArrType },
	{ value: 'scene', label: 'Scene', arrType: 'all' as ArrType },
	{ value: 'freeleech_75', label: 'Freeleech 75%', arrType: 'all' as ArrType },
	{ value: 'freeleech_25', label: 'Freeleech 25%', arrType: 'all' as ArrType },
	{ value: 'nuked', label: 'Nuked', arrType: 'all' as ArrType },
	{ value: 'ptp_golden', label: 'PTP Golden', arrType: 'radarr' as ArrType },
	{ value: 'ptp_approved', label: 'PTP Approved', arrType: 'radarr' as ArrType }
] as const;
