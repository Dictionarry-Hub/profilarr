/**
 * PCD Database Schema Types
 *
 * AUTO-GENERATED - DO NOT EDIT MANUALLY
 *
 * Generated from: https://github.com/Dictionarry-Hub/schema/blob/local/ops/0.schema.sql
 * Generated at: 2026-03-11T23:10:47.284Z
 *
 * To regenerate: deno task generate:pcd-types --version=local
 */

import type { Generated } from 'kysely';

// ============================================================================
// KYSELY TABLE INTERFACES
// ============================================================================
// Use these with Kysely for type-safe queries with Generated<T> support

// QUALITY PROFILES

export interface QualityProfilesTable {
	id: Generated<number>;
	name: string;
	description: string | null;
	upgrades_allowed: Generated<number>;
	minimum_custom_format_score: Generated<number>;
	upgrade_until_score: Generated<number>;
	upgrade_score_increment: Generated<number>;
	created_at: Generated<string>;
	updated_at: Generated<string>;
}

export interface QualityProfileTagsTable {
	quality_profile_name: string;
	tag_name: string;
}

export interface QualityGroupsTable {
	id: Generated<number>;
	quality_profile_name: string;
	name: string;
	created_at: Generated<string>;
	updated_at: Generated<string>;
}

export interface QualityGroupMembersTable {
	quality_profile_name: string;
	quality_group_name: string;
	quality_name: string;
	position: Generated<number>;
}

export interface QualityProfileQualitiesTable {
	id: Generated<number>;
	quality_profile_name: string;
	quality_name: string | null;
	quality_group_name: string | null;
	position: number;
	enabled: Generated<number>;
	upgrade_until: Generated<number>;
}

export interface QualityProfileLanguagesTable {
	quality_profile_name: string;
	language_name: string;
	type: Generated<string>;
}

export interface QualityProfileCustomFormatsTable {
	quality_profile_name: string;
	custom_format_name: string;
	arr_type: string;
	score: number;
}

export interface TestEntitiesTable {
	id: Generated<number>;
	type: string;
	tmdb_id: number;
	title: string;
	year: number | null;
	poster_path: string | null;
	created_at: Generated<string>;
	updated_at: Generated<string>;
}

export interface TestReleasesTable {
	id: Generated<number>;
	entity_type: string;
	entity_tmdb_id: number;
	title: string;
	size_bytes: number | null;
	languages: Generated<string>;
	indexers: Generated<string>;
	flags: Generated<string>;
	created_at: Generated<string>;
	updated_at: Generated<string>;
}

// CUSTOM FORMATS

export interface CustomFormatsTable {
	id: Generated<number>;
	name: string;
	description: string | null;
	include_in_rename: Generated<number>;
	created_at: Generated<string>;
	updated_at: Generated<string>;
}

export interface CustomFormatTagsTable {
	custom_format_name: string;
	tag_name: string;
}

export interface CustomFormatConditionsTable {
	id: Generated<number>;
	custom_format_name: string;
	name: string;
	type: string;
	arr_type: Generated<string>;
	negate: Generated<number>;
	required: Generated<number>;
	created_at: Generated<string>;
	updated_at: Generated<string>;
}

export interface CustomFormatTestsTable {
	id: Generated<number>;
	custom_format_name: string;
	title: string;
	type: string;
	should_match: number;
	description: string | null;
	created_at: Generated<string>;
}

export interface ConditionIndexerFlagsTable {
	custom_format_name: string;
	condition_name: string;
	flag: string;
}

export interface ConditionLanguagesTable {
	custom_format_name: string;
	condition_name: string;
	language_name: string;
	except_language: Generated<number>;
}

export interface ConditionPatternsTable {
	custom_format_name: string;
	condition_name: string;
	regular_expression_name: string;
}

export interface ConditionQualityModifiersTable {
	custom_format_name: string;
	condition_name: string;
	quality_modifier: string;
}

export interface ConditionReleaseTypesTable {
	custom_format_name: string;
	condition_name: string;
	release_type: string;
}

export interface ConditionResolutionsTable {
	custom_format_name: string;
	condition_name: string;
	resolution: string;
}

export interface ConditionSizesTable {
	custom_format_name: string;
	condition_name: string;
	min_bytes: number | null;
	max_bytes: number | null;
}

export interface ConditionSourcesTable {
	custom_format_name: string;
	condition_name: string;
	source: string;
}

export interface ConditionYearsTable {
	custom_format_name: string;
	condition_name: string;
	min_year: number | null;
	max_year: number | null;
}

// REGULAR EXPRESSIONS

export interface RegularExpressionsTable {
	id: Generated<number>;
	name: string;
	pattern: string;
	regex101_id: string | null;
	description: string | null;
	created_at: Generated<string>;
	updated_at: Generated<string>;
}

export interface RegularExpressionTagsTable {
	regular_expression_name: string;
	tag_name: string;
}

// DELAY PROFILES

export interface DelayProfilesTable {
	id: Generated<number>;
	name: string;
	preferred_protocol: string;
	usenet_delay: number | null;
	torrent_delay: number | null;
	bypass_if_highest_quality: Generated<number>;
	bypass_if_above_custom_format_score: Generated<number>;
	minimum_custom_format_score: number | null;
	created_at: Generated<string>;
	updated_at: Generated<string>;
}

// MEDIA MANAGEMENT

export interface RadarrNamingTable {
	name: string;
	rename: Generated<number>;
	movie_format: string;
	movie_folder_format: string;
	replace_illegal_characters: Generated<number>;
	colon_replacement_format: Generated<string>;
	created_at: Generated<string>;
	updated_at: Generated<string>;
}

export interface SonarrNamingTable {
	name: string;
	rename: Generated<number>;
	standard_episode_format: string;
	daily_episode_format: string;
	anime_episode_format: string;
	series_folder_format: string;
	season_folder_format: string;
	replace_illegal_characters: Generated<number>;
	colon_replacement_format: Generated<number>;
	custom_colon_replacement_format: string | null;
	multi_episode_style: Generated<number>;
	created_at: Generated<string>;
	updated_at: Generated<string>;
}

export interface RadarrMediaSettingsTable {
	name: string;
	propers_repacks: Generated<string>;
	enable_media_info: Generated<number>;
	created_at: Generated<string>;
	updated_at: Generated<string>;
}

export interface SonarrMediaSettingsTable {
	name: string;
	propers_repacks: Generated<string>;
	enable_media_info: Generated<number>;
	created_at: Generated<string>;
	updated_at: Generated<string>;
}

export interface RadarrQualityDefinitionsTable {
	name: string;
	quality_name: string;
	min_size: Generated<number>;
	max_size: number;
	preferred_size: number;
	created_at: Generated<string>;
	updated_at: Generated<string>;
}

export interface SonarrQualityDefinitionsTable {
	name: string;
	quality_name: string;
	min_size: Generated<number>;
	max_size: number;
	preferred_size: number;
	created_at: Generated<string>;
	updated_at: Generated<string>;
}

// CORE

export interface TagsTable {
	id: Generated<number>;
	name: string;
	created_at: Generated<string>;
}

export interface LanguagesTable {
	id: Generated<number>;
	name: string;
	created_at: Generated<string>;
	updated_at: Generated<string>;
}

export interface QualitiesTable {
	id: Generated<number>;
	name: string;
	created_at: Generated<string>;
	updated_at: Generated<string>;
}

export interface QualityApiMappingsTable {
	quality_name: string;
	arr_type: string;
	api_name: string;
	created_at: Generated<string>;
}

// ============================================================================
// DATABASE INTERFACE
// ============================================================================

export interface PCDDatabase {
	condition_indexer_flags: ConditionIndexerFlagsTable;
	condition_languages: ConditionLanguagesTable;
	condition_patterns: ConditionPatternsTable;
	condition_quality_modifiers: ConditionQualityModifiersTable;
	condition_release_types: ConditionReleaseTypesTable;
	condition_resolutions: ConditionResolutionsTable;
	condition_sizes: ConditionSizesTable;
	condition_sources: ConditionSourcesTable;
	condition_years: ConditionYearsTable;
	custom_format_conditions: CustomFormatConditionsTable;
	custom_format_tags: CustomFormatTagsTable;
	custom_format_tests: CustomFormatTestsTable;
	custom_formats: CustomFormatsTable;
	delay_profiles: DelayProfilesTable;
	languages: LanguagesTable;
	qualities: QualitiesTable;
	quality_api_mappings: QualityApiMappingsTable;
	quality_group_members: QualityGroupMembersTable;
	quality_groups: QualityGroupsTable;
	quality_profile_custom_formats: QualityProfileCustomFormatsTable;
	quality_profile_languages: QualityProfileLanguagesTable;
	quality_profile_qualities: QualityProfileQualitiesTable;
	quality_profile_tags: QualityProfileTagsTable;
	quality_profiles: QualityProfilesTable;
	radarr_media_settings: RadarrMediaSettingsTable;
	radarr_naming: RadarrNamingTable;
	radarr_quality_definitions: RadarrQualityDefinitionsTable;
	regular_expression_tags: RegularExpressionTagsTable;
	regular_expressions: RegularExpressionsTable;
	sonarr_media_settings: SonarrMediaSettingsTable;
	sonarr_naming: SonarrNamingTable;
	sonarr_quality_definitions: SonarrQualityDefinitionsTable;
	tags: TagsTable;
	test_entities: TestEntitiesTable;
	test_releases: TestReleasesTable;
}

// ============================================================================
// ROW TYPES (Query Results)
// ============================================================================
// Use these for query result types (no Generated<T> wrapper)

// QUALITY PROFILES

export interface QualityProfilesRow {
	id: number;
	name: string;
	description: string | null;
	upgrades_allowed: boolean;
	minimum_custom_format_score: number;
	upgrade_until_score: number;
	upgrade_score_increment: number;
	created_at: string;
	updated_at: string;
}

export interface QualityProfileTagsRow {
	quality_profile_name: string;
	tag_name: string;
}

export interface QualityGroupsRow {
	id: number;
	quality_profile_name: string;
	name: string;
	created_at: string;
	updated_at: string;
}

export interface QualityGroupMembersRow {
	quality_profile_name: string;
	quality_group_name: string;
	quality_name: string;
	position: number;
}

export interface QualityProfileQualitiesRow {
	id: number;
	quality_profile_name: string;
	quality_name: string | null;
	quality_group_name: string | null;
	position: number;
	enabled: boolean;
	upgrade_until: number;
}

export interface QualityProfileLanguagesRow {
	quality_profile_name: string;
	language_name: string;
	type: string;
}

export interface QualityProfileCustomFormatsRow {
	quality_profile_name: string;
	custom_format_name: string;
	arr_type: string;
	score: number;
}

export interface TestEntitiesRow {
	id: number;
	type: 'movie' | 'series';
	tmdb_id: number;
	title: string;
	year: number | null;
	poster_path: string | null;
	created_at: string;
	updated_at: string;
}

export interface TestReleasesRow {
	id: number;
	entity_type: 'movie' | 'series';
	entity_tmdb_id: number;
	title: string;
	size_bytes: number | null;
	languages: string;
	indexers: string;
	flags: string;
	created_at: string;
	updated_at: string;
}

// CUSTOM FORMATS

export interface CustomFormatsRow {
	id: number;
	name: string;
	description: string | null;
	include_in_rename: boolean;
	created_at: string;
	updated_at: string;
}

export interface CustomFormatTagsRow {
	custom_format_name: string;
	tag_name: string;
}

export interface CustomFormatConditionsRow {
	id: number;
	custom_format_name: string;
	name: string;
	type: string;
	arr_type: string;
	negate: boolean;
	required: boolean;
	created_at: string;
	updated_at: string;
}

export interface CustomFormatTestsRow {
	id: number;
	custom_format_name: string;
	title: string;
	type: string;
	should_match: boolean;
	description: string | null;
	created_at: string;
}

export interface ConditionIndexerFlagsRow {
	custom_format_name: string;
	condition_name: string;
	flag: string;
}

export interface ConditionLanguagesRow {
	custom_format_name: string;
	condition_name: string;
	language_name: string;
	except_language: boolean;
}

export interface ConditionPatternsRow {
	custom_format_name: string;
	condition_name: string;
	regular_expression_name: string;
}

export interface ConditionQualityModifiersRow {
	custom_format_name: string;
	condition_name: string;
	quality_modifier: string;
}

export interface ConditionReleaseTypesRow {
	custom_format_name: string;
	condition_name: string;
	release_type: string;
}

export interface ConditionResolutionsRow {
	custom_format_name: string;
	condition_name: string;
	resolution: string;
}

export interface ConditionSizesRow {
	custom_format_name: string;
	condition_name: string;
	min_bytes: number | null;
	max_bytes: number | null;
}

export interface ConditionSourcesRow {
	custom_format_name: string;
	condition_name: string;
	source: string;
}

export interface ConditionYearsRow {
	custom_format_name: string;
	condition_name: string;
	min_year: number | null;
	max_year: number | null;
}

// REGULAR EXPRESSIONS

export interface RegularExpressionsRow {
	id: number;
	name: string;
	pattern: string;
	regex101_id: string | null;
	description: string | null;
	created_at: string;
	updated_at: string;
}

export interface RegularExpressionTagsRow {
	regular_expression_name: string;
	tag_name: string;
}

// DELAY PROFILES

export interface DelayProfilesRow {
	id: number;
	name: string;
	preferred_protocol: 'prefer_usenet' | 'prefer_torrent' | 'only_usenet' | 'only_torrent';
	usenet_delay: number | null;
	torrent_delay: number | null;
	bypass_if_highest_quality: boolean;
	bypass_if_above_custom_format_score: boolean;
	minimum_custom_format_score: number | null;
	created_at: string;
	updated_at: string;
}

// MEDIA MANAGEMENT

export interface RadarrNamingRow {
	name: string;
	rename: boolean;
	movie_format: string;
	movie_folder_format: string;
	replace_illegal_characters: boolean;
	colon_replacement_format: 'delete' | 'dash' | 'spaceDash' | 'spaceDashSpace' | 'smart';
	created_at: string;
	updated_at: string;
}

export interface SonarrNamingRow {
	name: string;
	rename: boolean;
	standard_episode_format: string;
	daily_episode_format: string;
	anime_episode_format: string;
	series_folder_format: string;
	season_folder_format: string;
	replace_illegal_characters: boolean;
	colon_replacement_format: 'delete' | 'dash' | 'spaceDash' | 'spaceDashSpace' | 'smart' | 'custom';
	custom_colon_replacement_format: string | null;
	multi_episode_style: 'extend' | 'duplicate' | 'repeat' | 'scene' | 'range' | 'prefixedRange';
	created_at: string;
	updated_at: string;
}

export interface RadarrMediaSettingsRow {
	name: string;
	propers_repacks: 'doNotPrefer' | 'preferAndUpgrade' | 'doNotUpgradeAutomatically';
	enable_media_info: boolean;
	created_at: string;
	updated_at: string;
}

export interface SonarrMediaSettingsRow {
	name: string;
	propers_repacks: 'doNotPrefer' | 'preferAndUpgrade' | 'doNotUpgradeAutomatically';
	enable_media_info: boolean;
	created_at: string;
	updated_at: string;
}

export interface RadarrQualityDefinitionsRow {
	name: string;
	quality_name: string;
	min_size: number;
	max_size: number;
	preferred_size: number;
	created_at: string;
	updated_at: string;
}

export interface SonarrQualityDefinitionsRow {
	name: string;
	quality_name: string;
	min_size: number;
	max_size: number;
	preferred_size: number;
	created_at: string;
	updated_at: string;
}

// CORE

export interface TagsRow {
	id: number;
	name: string;
	created_at: string;
}

export interface LanguagesRow {
	id: number;
	name: string;
	created_at: string;
	updated_at: string;
}

export interface QualitiesRow {
	id: number;
	name: string;
	created_at: string;
	updated_at: string;
}

export interface QualityApiMappingsRow {
	quality_name: string;
	arr_type: string;
	api_name: string;
	created_at: string;
}

// ============================================================================
// COMMON TYPES
// ============================================================================

/** Which arr application the data applies to */
export type ArrType = 'radarr' | 'sonarr' | 'all';

// ============================================================================
// HELPER TYPES
// ============================================================================

/** Extract insertable type from a table (Generated fields become optional) */
export type Insertable<T> = {
	[K in keyof T]: T[K] extends Generated<infer U>
		? U | undefined
		: T[K] extends Generated<infer U> | null
			? U | null | undefined
			: T[K];
};

/** Extract selectable type from a table (Generated<T> becomes T) */
export type Selectable<T> = {
	[K in keyof T]: T[K] extends Generated<infer U>
		? U
		: T[K] extends Generated<infer U> | null
			? U | null
			: T[K];
};
