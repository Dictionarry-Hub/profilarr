/**
 * PCD Value Conversions
 *
 * Runtime conversion functions for columns that store integers in the DB
 * but need semantic string values for the API/UI.
 *
 * Note: These are only needed for Sonarr's quirky integer-based enums.
 * Radarr stores strings directly.
 */

// ============================================================================
// SONARR COLON REPLACEMENT FORMAT
// ============================================================================
// DB stores: 0, 1, 2, 3, 4, 5
// API expects: 'delete', 'dash', 'spaceDash', 'spaceDashSpace', 'smart', 'custom'

export type SonarrColonReplacementFormat =
	'delete' | 'dash' | 'spaceDash' | 'spaceDashSpace' | 'smart' | 'custom';

const COLON_REPLACEMENT_FROM_DB: Record<number, SonarrColonReplacementFormat> = {
	0: 'delete',
	1: 'dash',
	2: 'spaceDash',
	3: 'spaceDashSpace',
	4: 'smart',
	5: 'custom'
};

const COLON_REPLACEMENT_TO_DB: Record<SonarrColonReplacementFormat, number> = {
	delete: 0,
	dash: 1,
	spaceDash: 2,
	spaceDashSpace: 3,
	smart: 4,
	custom: 5
};

export function colonReplacementFromDb(value: number): SonarrColonReplacementFormat {
	return COLON_REPLACEMENT_FROM_DB[value] ?? 'delete';
}

export function colonReplacementToDb(value: SonarrColonReplacementFormat): number {
	return COLON_REPLACEMENT_TO_DB[value] ?? 0;
}

// UI options for Sonarr colon replacement
export const SONARR_COLON_REPLACEMENT_OPTIONS: {
	value: SonarrColonReplacementFormat;
	label: string;
}[] = [
	{ value: 'delete', label: 'Delete' },
	{ value: 'dash', label: 'Replace with Dash' },
	{ value: 'spaceDash', label: 'Replace with Space Dash' },
	{ value: 'spaceDashSpace', label: 'Replace with Space Dash Space' },
	{ value: 'smart', label: 'Smart Replace' },
	{ value: 'custom', label: 'Custom' }
];

export function getColonReplacementLabel(value: SonarrColonReplacementFormat): string {
	const option = SONARR_COLON_REPLACEMENT_OPTIONS.find((o) => o.value === value);
	return option?.label ?? value;
}

// ============================================================================
// SONARR MULTI-EPISODE STYLE
// ============================================================================
// DB stores: 0, 1, 2, 3, 4, 5
// API expects: 'extend', 'duplicate', 'repeat', 'scene', 'range', 'prefixedRange'

export type MultiEpisodeStyle =
	'extend' | 'duplicate' | 'repeat' | 'scene' | 'range' | 'prefixedRange';

const MULTI_EPISODE_FROM_DB: Record<number, MultiEpisodeStyle> = {
	0: 'extend',
	1: 'duplicate',
	2: 'repeat',
	3: 'scene',
	4: 'range',
	5: 'prefixedRange'
};

const MULTI_EPISODE_TO_DB: Record<MultiEpisodeStyle, number> = {
	extend: 0,
	duplicate: 1,
	repeat: 2,
	scene: 3,
	range: 4,
	prefixedRange: 5
};

export function multiEpisodeStyleFromDb(value: number): MultiEpisodeStyle {
	return MULTI_EPISODE_FROM_DB[value] ?? 'extend';
}

export function multiEpisodeStyleToDb(value: MultiEpisodeStyle): number {
	return MULTI_EPISODE_TO_DB[value] ?? 0;
}

// UI options for multi-episode style
export const MULTI_EPISODE_STYLE_OPTIONS: {
	value: MultiEpisodeStyle;
	label: string;
}[] = [
	{ value: 'extend', label: 'Extend' },
	{ value: 'duplicate', label: 'Duplicate' },
	{ value: 'repeat', label: 'Repeat' },
	{ value: 'scene', label: 'Scene' },
	{ value: 'range', label: 'Range' },
	{ value: 'prefixedRange', label: 'Prefixed Range' }
];

export function getMultiEpisodeStyleLabel(value: MultiEpisodeStyle): string {
	const option = MULTI_EPISODE_STYLE_OPTIONS.find((o) => o.value === value);
	return option?.label ?? value;
}

// ============================================================================
// RADARR COLON REPLACEMENT FORMAT
// ============================================================================
// Radarr stores as strings directly in the DB, but we still need UI options

export type RadarrColonReplacementFormat =
	'delete' | 'dash' | 'spaceDash' | 'spaceDashSpace' | 'smart';

export const RADARR_COLON_REPLACEMENT_OPTIONS: {
	value: RadarrColonReplacementFormat;
	label: string;
}[] = [
	{ value: 'delete', label: 'Delete' },
	{ value: 'dash', label: 'Replace with Dash' },
	{ value: 'spaceDash', label: 'Replace with Space Dash' },
	{ value: 'spaceDashSpace', label: 'Replace with Space Dash Space' },
	{ value: 'smart', label: 'Smart Replace' }
];

export function getRadarrColonReplacementLabel(value: RadarrColonReplacementFormat): string {
	const option = RADARR_COLON_REPLACEMENT_OPTIONS.find((o) => o.value === value);
	return option?.label ?? value;
}

// ============================================================================
// PROPERS AND REPACKS
// ============================================================================
// Both Radarr and Sonarr store as strings - no conversion needed, just UI options

export type PropersRepacks = 'doNotPrefer' | 'preferAndUpgrade' | 'doNotUpgradeAutomatically';

export const PROPERS_REPACKS_OPTIONS: {
	value: PropersRepacks;
	label: string;
	description: string;
}[] = [
	{
		value: 'doNotPrefer',
		label: 'Do Not Prefer',
		description: 'Propers and repacks are not preferred over existing files'
	},
	{
		value: 'preferAndUpgrade',
		label: 'Prefer and Upgrade',
		description: 'Automatically upgrade to propers and repacks when available'
	},
	{
		value: 'doNotUpgradeAutomatically',
		label: 'Do Not Upgrade Automatically',
		description: 'Prefer propers/repacks but do not automatically upgrade'
	}
];

export function getPropersRepacksLabel(value: PropersRepacks): string {
	const option = PROPERS_REPACKS_OPTIONS.find((o) => o.value === value);
	return option?.label ?? value;
}
