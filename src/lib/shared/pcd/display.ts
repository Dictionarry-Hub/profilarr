/**
 * PCD Display Types
 *
 * Types for query results that include JOINed data or need semantic naming.
 * Simple aliases to generated Row types are provided for cleaner API.
 */

import type { RegularExpressionsRow } from './types.ts';
import type { DelayProfilesRow } from './types.ts';

// ============================================================================
// COMMON
// ============================================================================

/** Tag with metadata */
export interface Tag {
	name: string;
	created_at: string;
}

// ============================================================================
// REGULAR EXPRESSIONS
// ============================================================================

/** Regular expression with tags (from JOIN) */
export type RegularExpressionWithTags = RegularExpressionsRow & {
	tags: Tag[];
};

// ============================================================================
// DELAY PROFILES
// ============================================================================
// No JOINs needed - the generated Row type is already semantic (booleans, unions).
// Re-exported here for consistent import pattern across all entities.

export type { DelayProfilesRow } from './types.ts';

/** Preferred protocol options - extracted for use in mutations */
export type PreferredProtocol = DelayProfilesRow['preferred_protocol'];

// ============================================================================
// MEDIA MANAGEMENT
// ============================================================================

import type { ArrType } from './types.ts';

// Naming
export type { RadarrNamingRow, SonarrNamingRow } from './types.ts';

export interface NamingListItem {
	name: string;
	arr_type: Exclude<ArrType, 'all'>;
	rename: boolean;
	updated_at: string;
}

// Media Settings
export type { RadarrMediaSettingsRow, SonarrMediaSettingsRow } from './types.ts';

export interface MediaSettingsListItem {
	name: string;
	arr_type: Exclude<ArrType, 'all'>;
	propers_repacks: string;
	enable_media_info: boolean;
	updated_at: string;
}

// Quality Definitions
export type { RadarrQualityDefinitionsRow, SonarrQualityDefinitionsRow } from './types.ts';

export interface QualityDefinitionListItem {
	name: string;
	arr_type: Exclude<ArrType, 'all'>;
	quality_count: number;
	updated_at: string;
}

/** Single quality entry (Row without the config name) */
export interface QualityDefinitionEntry {
	quality_name: string;
	min_size: number;
	max_size: number;
	preferred_size: number;
}

/** Aggregate config with all its entries */
export interface QualityDefinitionsConfig {
	name: string;
	entries: QualityDefinitionEntry[];
}

// ============================================================================
// ENTITY TESTS
// ============================================================================

import type { TestEntitiesRow, TestReleasesRow } from './types.ts';

/** Test release with parsed arrays (JSON strings → string[]) */
export type TestRelease = Omit<
	TestReleasesRow,
	| 'entity_type'
	| 'entity_tmdb_id'
	| 'languages'
	| 'indexers'
	| 'flags'
	| 'created_at'
	| 'updated_at'
> & {
	languages: string[];
	indexers: string[];
	flags: string[];
};

/** Test entity with nested releases */
export type TestEntity = Omit<TestEntitiesRow, 'created_at' | 'updated_at'> & {
	releases: TestRelease[];
};

// ============================================================================
// CUSTOM FORMATS
// ============================================================================

import type { CustomFormatsRow, CustomFormatConditionsRow, CustomFormatTestsRow } from './types.ts';

/** Condition reference for display (minimal info) */
export type ConditionRef = Pick<CustomFormatConditionsRow, 'name' | 'type' | 'required' | 'negate'>;

/** Condition item for list display */
export type ConditionListItem = ConditionRef;

/** Custom format basic info */
export type CustomFormatBasic = Omit<CustomFormatsRow, 'created_at' | 'updated_at'>;

/** Custom format test case */
export type CustomFormatTest = Omit<CustomFormatTestsRow, 'id' | 'created_at'>;

/** Custom format data for table/card views (with JOINed data) */
export type CustomFormatTableRow = Omit<
	CustomFormatsRow,
	'include_in_rename' | 'created_at' | 'updated_at'
> & {
	tags: Tag[];
	conditions: ConditionRef[];
	testCount: number;
};

/** Custom format general information (for general tab) */
export type CustomFormatGeneral = Omit<
	CustomFormatsRow,
	'description' | 'created_at' | 'updated_at'
> & {
	description: string; // non-nullable for form
	tags: Tag[];
};

/** Full condition data for evaluation and editing (assembled from multiple tables) */
export interface ConditionData {
	name: string;
	type: string;
	arrType: 'all' | 'radarr' | 'sonarr' | '';
	negate: boolean;
	required: boolean;
	// Type-specific data (only one populated based on `type`)
	patterns?: { name: string; pattern: string }[];
	languages?: { name: string; except: boolean }[];
	sources?: string[];
	resolutions?: string[];
	qualityModifiers?: string[];
	releaseTypes?: string[];
	indexerFlags?: string[];
	size?: { minBytes: number | null; maxBytes: number | null };
	years?: { minYear: number | null; maxYear: number | null };
}

/** Single condition evaluation result */
export interface ConditionResult {
	conditionName: string;
	conditionType: string;
	matched: boolean;
	required: boolean;
	negate: boolean;
	/** Final result after applying negate */
	passes: boolean;
	/** What the condition expected */
	expected: string;
	/** What was actually found in the parsed title */
	actual: string;
}

/** Full evaluation result of all conditions */
export interface EvaluationResult {
	/** Whether the custom format matches overall */
	matches: boolean;
	/** Individual condition results */
	conditions: ConditionResult[];
}

/** Serializable parsed info for frontend display */
export interface ParsedInfo {
	source: string;
	resolution: string;
	modifier: string;
	languages: string[];
	languageSource: 'Indexer' | 'Title';
	releaseGroup: string | null;
	year: number;
	edition: string | null;
	releaseType: string | null;
}

/** Custom format with conditions for batch evaluation */
export interface CustomFormatWithConditions {
	name: string;
	conditions: ConditionData[];
}

// ============================================================================
// QUALITY PROFILES
// ============================================================================

import type { QualityProfilesRow } from './types.ts';

// --- Select/Dropdown ---

/** Quality profile option for select/dropdown */
export type QualityProfileOption = Pick<QualityProfilesRow, 'id' | 'name'>;

// --- List/Table View Helpers ---

/** Quality/group item in the hierarchy */
export interface QualityItem {
	position: number;
	type: 'quality' | 'group';
	name: string;
	is_upgrade_until: boolean;
}

/** Language configuration */
export interface ProfileLanguage {
	name: string;
	type: 'must' | 'only' | 'not' | 'simple';
}

/** Custom format counts by arr type */
export interface CustomFormatCounts {
	all: number;
	radarr: number;
	sonarr: number;
	total: number;
}

/** Quality profile data for table/card views (with JOINed data) */
export type QualityProfileTableRow = Omit<
	QualityProfilesRow,
	'description' | 'upgrade_until_score' | 'upgrade_score_increment' | 'created_at' | 'updated_at'
> & {
	description: string; // Parsed HTML from markdown (non-nullable)
	tags: Tag[];
	upgrade_until_score?: number; // Only if upgrades_allowed
	upgrade_score_increment?: number; // Only if upgrades_allowed
	custom_formats: CustomFormatCounts;
	qualities: QualityItem[];
	language?: ProfileLanguage;
};

// --- General Tab ---

/** Quality profile general information */
export type QualityProfileGeneral = Pick<QualityProfilesRow, 'id' | 'name'> & {
	description: string; // Raw markdown (non-nullable for form)
	tags: Tag[];
	language: string | null; // Language name, null means "Any"
};

/** Language configuration for a quality profile */
export interface QualityProfileLanguage {
	name: string;
	type: 'must' | 'only' | 'not' | 'simple';
}

/** Quality profile languages information */
export interface QualityProfileLanguages {
	languages: QualityProfileLanguage[];
}

// --- Qualities Tab ---

/** Single quality item for display */
export interface QualitySingle {
	name: string;
	position: number;
	enabled: boolean;
	isUpgradeUntil: boolean;
}

/** Quality group with members for display */
export interface QualityGroup {
	name: string;
	position: number;
	enabled: boolean;
	isUpgradeUntil: boolean;
	members: { name: string }[];
}

/** Quality profile qualities information */
export interface QualityProfileQualities {
	singles: QualitySingle[];
	groups: QualityGroup[];
}

/** Simple quality member (name only) */
export interface QualityMember {
	name: string;
}

/** Ordered quality/group item for qualities page */
export interface OrderedItem {
	type: 'quality' | 'group';
	name: string;
	position: number;
	enabled: boolean;
	upgradeUntil: boolean;
	members?: QualityMember[];
}

/** Group with members (for qualities page) */
export interface QualitiesGroup {
	name: string;
	members: QualityMember[];
}

/** Qualities page data */
export interface QualitiesPageData {
	orderedItems: OrderedItem[];
	availableQualities: QualityMember[];
	allQualities: QualityMember[];
	groups: QualitiesGroup[];
}

// --- Scoring Tab ---

/** Custom format scoring entry */
export interface CustomFormatScoring {
	name: string;
	tags: string[];
	scores: Record<string, number | null>;
}

/** Quality profile scoring data for the scoring page */
export interface QualityProfileScoring {
	databaseId: number;
	arrTypes: string[];
	customFormats: CustomFormatScoring[];
	minimum_custom_format_score: number;
	upgrade_until_score: number;
	upgrade_score_increment: number;
}

// --- Entity Testing ---

/** CF scores for a single profile */
export interface ProfileCfScores {
	profileName: string;
	/** Map of custom format name to score (by arr type) */
	scores: Record<string, { radarr: number | null; sonarr: number | null }>;
}

/** All CF scores result for entity testing */
export interface AllCfScoresResult {
	/** All custom formats with their names */
	customFormats: Array<{ name: string }>;
	/** CF scores per profile */
	profiles: ProfileCfScores[];
}
