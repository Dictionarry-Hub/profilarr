/**
 * Shared filter types for both backend and frontend
 * Defines all available filter fields for upgrade filtering
 */

import { Cron } from 'croner';
import { uuid } from '../utils/uuid.ts';

/** App types relevant to upgrade filters */
export type UpgradeAppType = 'radarr' | 'sonarr';

export interface FilterOperator {
	id: string;
	label: string;
	description?: string;
}

export type FilterValueType = string | number | boolean | null;

export interface FilterValue {
	value: FilterValueType;
	label: string;
}

export interface FilterField {
	id: string;
	label: string;
	description: string;
	operators: FilterOperator[];
	valueType: 'boolean' | 'select' | 'text' | 'number' | 'date';
	values?: FilterValue[];
}

export interface FilterRule {
	type: 'rule';
	field: string;
	operator: string;
	value: FilterValueType;
}

export interface FilterGroup {
	type: 'group';
	match: 'all' | 'any';
	children: (FilterRule | FilterGroup)[];
}

export interface FilterConfig {
	id: string;
	name: string;
	enabled: boolean;
	group: FilterGroup;
	selector: string;
	count: number;
	cutoff: number;
	/** Custom tag name for cooldown tracking. If empty/undefined, auto-generated from filter name. */
	tag?: string;
}

export type FilterMode = 'round_robin' | 'random';

export interface UpgradeConfig {
	id?: number;
	arrInstanceId: number;
	enabled: boolean;
	cron: string;
	nextRunAt: string | null;
	filterMode: FilterMode;
	filters: FilterConfig[];
	currentFilterIndex: number;
	lastRunAt?: string | null;
	createdAt?: string;
	updatedAt?: string;
}

export const filterModes: { id: FilterMode; label: string; description: string }[] = [
	{
		id: 'round_robin',
		label: 'Round Robin',
		description: 'Cycle through filters in order, one per run'
	},
	{
		id: 'random',
		label: 'Random Shuffle',
		description: 'Shuffle filters, cycle through all before repeating'
	}
];

/**
 * Common operator sets
 */
const booleanOperators: FilterOperator[] = [
	{ id: 'is', label: 'is', description: 'Exact match' },
	{ id: 'is_not', label: 'is not', description: 'Does not match' }
];

const numberOperators: FilterOperator[] = [
	{ id: 'eq', label: 'equals', description: 'Exactly equals the value' },
	{ id: 'neq', label: 'does not equal', description: 'Does not equal the value' },
	{ id: 'gt', label: 'is greater than', description: 'Greater than the value' },
	{
		id: 'gte',
		label: 'is greater than or equal',
		description: 'Greater than or equal to the value'
	},
	{ id: 'lt', label: 'is less than', description: 'Less than the value' },
	{ id: 'lte', label: 'is less than or equal', description: 'Less than or equal to the value' }
];

const textOperators: FilterOperator[] = [
	{ id: 'contains', label: 'contains', description: 'Contains the text (case-insensitive)' },
	{ id: 'not_contains', label: 'does not contain', description: 'Does not contain the text' },
	{ id: 'starts_with', label: 'starts with', description: 'Starts with the text' },
	{ id: 'ends_with', label: 'ends with', description: 'Ends with the text' },
	{ id: 'eq', label: 'equals', description: 'Exactly equals the text (case-insensitive)' },
	{ id: 'neq', label: 'does not equal', description: 'Does not equal the text' }
];

const dateOperators: FilterOperator[] = [
	{ id: 'before', label: 'is before', description: 'The date is before the specified date' },
	{ id: 'after', label: 'is after', description: 'The date is after the specified date' },
	{ id: 'in_last', label: 'in the last', description: 'Within the last N days' },
	{ id: 'not_in_last', label: 'not in the last', description: 'Not within the last N days' }
];

const ordinalOperators: FilterOperator[] = [
	{ id: 'eq', label: 'is exactly', description: 'Exactly matches the status' },
	{ id: 'neq', label: 'is not', description: 'Does not match the status' },
	{
		id: 'gte',
		label: 'has reached',
		description: 'Has reached this status or further in the progression'
	},
	{
		id: 'lte',
		label: "hasn't passed",
		description: 'Has not passed this status in the progression'
	},
	{ id: 'gt', label: 'is past', description: 'Is past this status (further along)' },
	{ id: 'lt', label: 'is before', description: 'Is before this status (not yet reached)' }
];

// =============================================================================
// Ordinal mappings
// =============================================================================

export const availabilityOrder: Record<string, number> = {
	tba: 0,
	announced: 1,
	inCinemas: 2,
	released: 3
};

export const statusOrder: Record<string, number> = {
	// Radarr movie status (progression: tba → announced → inCinemas → released)
	tba: 0,
	announced: 1,
	inCinemas: 2,
	released: 3,
	// Sonarr series status (progression: upcoming → continuing → ended)
	upcoming: 0,
	continuing: 1,
	ended: 2,
	// Both: deleted is the terminal state
	deleted: 4
};

/** Fields that use ordinal comparison and their order maps */
const ordinalFields: Record<string, Record<string, number>> = {
	minimum_availability: availabilityOrder,
	status: statusOrder
};

// =============================================================================
// Filter field definitions (split by app type)
// =============================================================================

const sharedFilterFields: FilterField[] = [
	// Boolean fields
	{
		id: 'monitored',
		label: 'Monitored',
		description: 'Whether the item is being monitored for upgrades',
		operators: booleanOperators,
		valueType: 'boolean',
		values: [
			{ value: true, label: 'True' },
			{ value: false, label: 'False' }
		]
	},
	{
		id: 'cutoff_met',
		label: 'Cutoff Met',
		description: "Whether the item's quality score meets the filter's cutoff percentage",
		operators: booleanOperators,
		valueType: 'boolean',
		values: [
			{ value: true, label: 'True' },
			{ value: false, label: 'False' }
		]
	},

	// Text fields
	{
		id: 'title',
		label: 'Title',
		description: 'The title of the item',
		operators: textOperators,
		valueType: 'text'
	},
	{
		id: 'quality_profile',
		label: 'Quality Profile',
		description: 'The assigned quality profile name',
		operators: textOperators,
		valueType: 'text'
	},
	{
		id: 'original_language',
		label: 'Original Language',
		description: 'The original language (e.g., "English", "Japanese")',
		operators: textOperators,
		valueType: 'text'
	},
	{
		id: 'genres',
		label: 'Genres',
		description: 'Genres (Action, Comedy, Drama, etc.)',
		operators: textOperators,
		valueType: 'text'
	},
	{
		id: 'tags',
		label: 'Tags',
		description: 'Tags applied to the item',
		operators: textOperators,
		valueType: 'text'
	},

	// Number fields
	{
		id: 'rating',
		label: 'Rating',
		description: 'Rating score (Radarr: TMDb, Sonarr: combined rating)',
		operators: numberOperators,
		valueType: 'number'
	},
	{
		id: 'year',
		label: 'Year',
		description: 'The release year',
		operators: numberOperators,
		valueType: 'number'
	},
	{
		id: 'runtime',
		label: 'Runtime',
		description: 'Runtime in minutes',
		operators: numberOperators,
		valueType: 'number'
	},
	{
		id: 'size_on_disk',
		label: 'Size on Disk',
		description: 'Current file size in GB',
		operators: numberOperators,
		valueType: 'number'
	},

	// Date fields
	{
		id: 'date_added',
		label: 'Date Added',
		description: 'When the item was added to your library',
		operators: dateOperators,
		valueType: 'date'
	}
];

const radarrFilterFields: FilterField[] = [
	// Ordinal
	{
		id: 'status',
		label: 'Status',
		description:
			'The actual release status of the movie. Progresses: TBA → Announced → In Cinemas → Released',
		operators: ordinalOperators,
		valueType: 'select',
		values: [
			{ value: 'tba', label: 'TBA' },
			{ value: 'announced', label: 'Announced' },
			{ value: 'inCinemas', label: 'In Cinemas' },
			{ value: 'released', label: 'Released' }
		]
	},
	{
		id: 'minimum_availability',
		label: 'Minimum Availability',
		description:
			'The configured minimum availability setting. Progresses: TBA → Announced → In Cinemas → Released',
		operators: ordinalOperators,
		valueType: 'select',
		values: [
			{ value: 'tba', label: 'TBA' },
			{ value: 'announced', label: 'Announced' },
			{ value: 'inCinemas', label: 'In Cinemas' },
			{ value: 'released', label: 'Released' }
		]
	},

	// Text
	{
		id: 'collection',
		label: 'Collection',
		description: 'The collection the movie belongs to (e.g., "Marvel Cinematic Universe")',
		operators: textOperators,
		valueType: 'text'
	},
	{
		id: 'studio',
		label: 'Studio',
		description: 'The production studio',
		operators: textOperators,
		valueType: 'text'
	},
	{
		id: 'keywords',
		label: 'Keywords',
		description: 'TMDb keywords associated with the movie',
		operators: textOperators,
		valueType: 'text'
	},
	{
		id: 'release_group',
		label: 'Release Group',
		description: 'The release group of the current file',
		operators: textOperators,
		valueType: 'text'
	},

	// Number
	{
		id: 'popularity',
		label: 'Popularity',
		description: 'TMDb popularity score',
		operators: numberOperators,
		valueType: 'number'
	},
	{
		id: 'tmdb_rating',
		label: 'TMDb Rating',
		description: 'TMDb rating (0-10)',
		operators: numberOperators,
		valueType: 'number'
	},
	{
		id: 'imdb_rating',
		label: 'IMDb Rating',
		description: 'IMDb rating (0-10)',
		operators: numberOperators,
		valueType: 'number'
	},
	{
		id: 'tomato_rating',
		label: 'Rotten Tomatoes',
		description: 'Rotten Tomatoes score (0-100)',
		operators: numberOperators,
		valueType: 'number'
	},
	{
		id: 'trakt_rating',
		label: 'Trakt Rating',
		description: 'Trakt rating (0-100)',
		operators: numberOperators,
		valueType: 'number'
	},

	// Date
	{
		id: 'digital_release',
		label: 'Digital Release',
		description: 'The digital release date from TMDb',
		operators: dateOperators,
		valueType: 'date'
	},
	{
		id: 'physical_release',
		label: 'Physical Release',
		description: 'The physical release date from TMDb',
		operators: dateOperators,
		valueType: 'date'
	}
];

const sonarrFilterFields: FilterField[] = [
	// Ordinal
	{
		id: 'status',
		label: 'Status',
		description: 'The series status. Progresses: Upcoming → Continuing → Ended → Deleted',
		operators: ordinalOperators,
		valueType: 'select',
		values: [
			{ value: 'upcoming', label: 'Upcoming' },
			{ value: 'continuing', label: 'Continuing' },
			{ value: 'ended', label: 'Ended' },
			{ value: 'deleted', label: 'Deleted' }
		]
	},

	// Text
	{
		id: 'network',
		label: 'Network',
		description: 'The TV network (e.g., "CBS", "Apple TV+")',
		operators: textOperators,
		valueType: 'text'
	},
	{
		id: 'series_type',
		label: 'Series Type',
		description: 'The type of series',
		operators: [
			{ id: 'eq', label: 'is', description: 'Exactly matches' },
			{ id: 'neq', label: 'is not', description: 'Does not match' }
		],
		valueType: 'select',
		values: [
			{ value: 'standard', label: 'Standard' },
			{ value: 'daily', label: 'Daily' },
			{ value: 'anime', label: 'Anime' }
		]
	},
	{
		id: 'certification',
		label: 'Certification',
		description: 'Content rating (e.g., "TV-MA", "TV-PG")',
		operators: textOperators,
		valueType: 'text'
	},

	// Number
	{
		id: 'season_count',
		label: 'Season Count',
		description: 'Number of seasons',
		operators: numberOperators,
		valueType: 'number'
	},
	{
		id: 'episode_count',
		label: 'Episode Count',
		description: 'Number of available episodes',
		operators: numberOperators,
		valueType: 'number'
	},
	{
		id: 'episode_file_count',
		label: 'Episode File Count',
		description: 'Number of downloaded episodes',
		operators: numberOperators,
		valueType: 'number'
	},

	// Date
	{
		id: 'first_aired',
		label: 'First Aired',
		description: 'When the first episode aired',
		operators: dateOperators,
		valueType: 'date'
	},
	{
		id: 'last_aired',
		label: 'Last Aired',
		description: 'When the last episode aired',
		operators: dateOperators,
		valueType: 'date'
	}
];

// =============================================================================
// Public API
// =============================================================================

/**
 * Get filter fields for a specific app type
 */
export function getFilterFields(appType: UpgradeAppType): FilterField[] {
	switch (appType) {
		case 'radarr':
			return [...sharedFilterFields, ...radarrFilterFields];
		case 'sonarr':
			return [...sharedFilterFields, ...sonarrFilterFields];
		default:
			return sharedFilterFields;
	}
}

/**
 * Get a filter field by ID, scoped to app type when provided
 */
export function getFilterField(id: string, appType?: UpgradeAppType): FilterField | undefined {
	if (appType) {
		return getFilterFields(appType).find((f) => f.id === id);
	}
	return [...sharedFilterFields, ...radarrFilterFields, ...sonarrFilterFields].find(
		(f) => f.id === id
	);
}

/**
 * Create an empty filter group
 */
export function createEmptyGroup(): FilterGroup {
	return {
		type: 'group',
		match: 'all',
		children: []
	};
}

/**
 * Create a default filter group with sensible rules per app type
 * - Radarr: monitored is true, minimum_availability has reached released
 * - Sonarr: monitored is true, status is continuing
 */
export function createDefaultGroup(appType: UpgradeAppType = 'radarr'): FilterGroup {
	if (appType === 'sonarr') {
		return {
			type: 'group',
			match: 'all',
			children: [
				{
					type: 'rule',
					field: 'monitored',
					operator: 'is',
					value: true
				},
				{
					type: 'group',
					match: 'any',
					children: [
						{
							type: 'rule',
							field: 'status',
							operator: 'eq',
							value: 'continuing'
						},
						{
							type: 'rule',
							field: 'status',
							operator: 'eq',
							value: 'ended'
						}
					]
				}
			]
		};
	}

	return {
		type: 'group',
		match: 'all',
		children: [
			{
				type: 'rule',
				field: 'monitored',
				operator: 'is',
				value: true
			},
			{
				type: 'rule',
				field: 'status',
				operator: 'eq',
				value: 'released'
			}
		]
	};
}

/**
 * Create a filter config with sensible defaults
 */
export function createEmptyFilterConfig(
	name: string = 'New Filter',
	appType: UpgradeAppType = 'radarr'
): FilterConfig {
	return {
		id: uuid(),
		name,
		enabled: true,
		group: createDefaultGroup(appType),
		selector: 'random',
		count: appType === 'sonarr' ? 1 : 2,
		cutoff: 100
	};
}

/**
 * Create an empty upgrade config for an arr instance
 */
export function createEmptyUpgradeConfig(arrInstanceId: number): UpgradeConfig {
	return {
		arrInstanceId,
		enabled: false,
		cron: '0 */6 * * *',
		nextRunAt: null,
		filterMode: 'round_robin',
		filters: [],
		currentFilterIndex: 0
	};
}

/**
 * Create an empty filter rule with defaults
 */
export function createEmptyRule(appType: UpgradeAppType = 'radarr'): FilterRule {
	const fields = getFilterFields(appType);
	const firstField = fields[0];
	return {
		type: 'rule',
		field: firstField.id,
		operator: firstField.operators[0].id,
		value: firstField.values?.[0]?.value ?? null
	};
}

/**
 * Check if a child is a rule
 */
export function isRule(child: FilterRule | FilterGroup): child is FilterRule {
	return child.type === 'rule';
}

/**
 * Check if a child is a group
 */
export function isGroup(child: FilterRule | FilterGroup): child is FilterGroup {
	return child.type === 'group';
}

/**
 * Evaluate a single filter rule against an item
 */
export function evaluateRule(item: Record<string, unknown>, rule: FilterRule): boolean {
	const fieldValue = item[rule.field];
	const ruleValue = rule.value;

	// Handle null/undefined field values
	if (fieldValue === null || fieldValue === undefined) {
		// For 'is_not' or negation operators, null means "not equal" so return true
		if (['is_not', 'neq', 'not_contains'].includes(rule.operator)) {
			return true;
		}
		return false;
	}

	// Check if this field uses ordinal comparison
	const ordinalMap = ordinalFields[rule.field];

	switch (rule.operator) {
		// Boolean operators
		case 'is':
			return fieldValue === ruleValue;
		case 'is_not':
			return fieldValue !== ruleValue;

		// Number/text/ordinal operators
		case 'eq':
			if (typeof fieldValue === 'string' && typeof ruleValue === 'string') {
				return fieldValue.toLowerCase() === ruleValue.toLowerCase();
			}
			return fieldValue === ruleValue;
		case 'neq':
			if (typeof fieldValue === 'string' && typeof ruleValue === 'string') {
				return fieldValue.toLowerCase() !== ruleValue.toLowerCase();
			}
			return fieldValue !== ruleValue;

		// Text operators (case-insensitive)
		case 'contains': {
			const strField = String(fieldValue).toLowerCase();
			const strRule = String(ruleValue).toLowerCase();
			return strField.includes(strRule);
		}
		case 'not_contains': {
			const strField = String(fieldValue).toLowerCase();
			const strRule = String(ruleValue).toLowerCase();
			return !strField.includes(strRule);
		}
		case 'starts_with': {
			const strField = String(fieldValue).toLowerCase();
			const strRule = String(ruleValue).toLowerCase();
			return strField.startsWith(strRule);
		}
		case 'ends_with': {
			const strField = String(fieldValue).toLowerCase();
			const strRule = String(ruleValue).toLowerCase();
			return strField.endsWith(strRule);
		}

		// Ordinal / number comparison operators
		case 'gte': {
			if (ordinalMap) {
				const fieldOrdinal = ordinalMap[fieldValue as string] ?? -1;
				const ruleOrdinal = ordinalMap[ruleValue as string] ?? -1;
				return fieldOrdinal >= ruleOrdinal;
			}
			return (
				typeof fieldValue === 'number' && typeof ruleValue === 'number' && fieldValue >= ruleValue
			);
		}
		case 'lte': {
			if (ordinalMap) {
				const fieldOrdinal = ordinalMap[fieldValue as string] ?? -1;
				const ruleOrdinal = ordinalMap[ruleValue as string] ?? -1;
				return fieldOrdinal <= ruleOrdinal;
			}
			return (
				typeof fieldValue === 'number' && typeof ruleValue === 'number' && fieldValue <= ruleValue
			);
		}
		case 'gt': {
			if (ordinalMap) {
				const fieldOrdinal = ordinalMap[fieldValue as string] ?? -1;
				const ruleOrdinal = ordinalMap[ruleValue as string] ?? -1;
				return fieldOrdinal > ruleOrdinal;
			}
			return (
				typeof fieldValue === 'number' && typeof ruleValue === 'number' && fieldValue > ruleValue
			);
		}
		case 'lt': {
			if (ordinalMap) {
				const fieldOrdinal = ordinalMap[fieldValue as string] ?? -1;
				const ruleOrdinal = ordinalMap[ruleValue as string] ?? -1;
				return fieldOrdinal < ruleOrdinal;
			}
			return (
				typeof fieldValue === 'number' && typeof ruleValue === 'number' && fieldValue < ruleValue
			);
		}

		// Date operators
		case 'before': {
			const fieldDate = new Date(fieldValue as string);
			const ruleDate = new Date(ruleValue as string);
			return fieldDate < ruleDate;
		}
		case 'after': {
			const fieldDate = new Date(fieldValue as string);
			const ruleDate = new Date(ruleValue as string);
			return fieldDate > ruleDate;
		}
		case 'in_last': {
			// ruleValue is number of days/hours depending on context
			const fieldDate = new Date(fieldValue as string);
			const now = new Date();
			const diffMs = now.getTime() - fieldDate.getTime();
			const diffDays = diffMs / (1000 * 60 * 60 * 24);
			return diffDays <= (ruleValue as number);
		}
		case 'not_in_last': {
			const fieldDate = new Date(fieldValue as string);
			const now = new Date();
			const diffMs = now.getTime() - fieldDate.getTime();
			const diffDays = diffMs / (1000 * 60 * 60 * 24);
			return diffDays > (ruleValue as number);
		}

		default:
			return false;
	}
}

/**
 * Evaluate a filter group against an item
 * Supports nested groups with AND/OR logic
 */
export function evaluateGroup(item: Record<string, unknown>, group: FilterGroup): boolean {
	if (group.children.length === 0) {
		// Empty group matches everything
		return true;
	}

	if (group.match === 'all') {
		// AND logic: all children must match
		return group.children.every((child) => {
			if (isRule(child)) {
				return evaluateRule(item, child);
			} else {
				return evaluateGroup(item, child);
			}
		});
	} else {
		// OR logic: any child must match
		return group.children.some((child) => {
			if (isRule(child)) {
				return evaluateRule(item, child);
			} else {
				return evaluateGroup(item, child);
			}
		});
	}
}

/**
 * Search rate limits by app type
 */
export const searchRateLimits: Record<string, { maxPerHour: number; minIntervalMinutes: number }> =
	{
		radarr: { maxPerHour: 10, minIntervalMinutes: 10 },
		sonarr: { maxPerHour: 1, minIntervalMinutes: 60 }
	};

/**
 * Calculate max searches per run that stays within the hourly rate limit.
 *
 * maxCount = floor(maxPerHour / runsPerHour)
 *
 * This guarantees: runsPerHour × maxCount ≤ maxPerHour
 */
export function calculateMaxCount(appType: string, runsPerHour: number): number {
	const limit = searchRateLimits[appType];
	if (!limit) return 5;
	const effective = Math.max(runsPerHour, 0.001);
	// Cap at maxPerHour: even if runs are infrequent, all searches fire in one burst
	return Math.max(1, Math.min(limit.maxPerHour, Math.floor(limit.maxPerHour / effective)));
}

/**
 * Count how many times a cron expression fires per hour.
 *
 * For `*\/N * * * *` patterns: ceil(60/N)
 * For all other patterns: simulates a 24-hour window and averages.
 */
export function getRunsPerHour(cronExpr: string): number | null {
	if (!cronExpr) return null;
	try {
		// Fast path for */N * * * * (every-N-minutes pattern)
		const everyMatch = cronExpr.trim().match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
		if (everyMatch) {
			const n = parseInt(everyMatch[1], 10);
			if (n > 0 && n <= 60) return Math.ceil(60 / n);
		}

		// Fast path for N * * * * (hourly at fixed minute): exactly 1 run/hour
		const hourlyMatch = cronExpr.trim().match(/^(\d+)\s+\*\s+\*\s+\*\s+\*$/);
		if (hourlyMatch) {
			const m = parseInt(hourlyMatch[1], 10);
			if (m >= 0 && m <= 59) return 1;
		}

		// For all other patterns: count runs in a 28-day window and average
		// (28 days = 4 full weeks, handles weekly patterns correctly)
		const cron = new Cron(cronExpr);
		const start = new Date('2025-06-02T00:00:00Z'); // Monday
		const end = new Date('2025-06-30T00:00:00Z'); // 28 days later
		const windowHours = 28 * 24;
		let count = 0;
		let cursor = start;
		while (count < 100000) {
			const next = cron.nextRun(cursor);
			if (!next || next >= end) break;
			count++;
			cursor = new Date(next.getTime() + 1000);
		}
		return count / windowHours;
	} catch {
		return null;
	}
}

// =============================================================================
// Tag label utilities
// =============================================================================

const FILTER_TAG_PREFIX = 'profilarr-';

function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/['']/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 50);
}

/**
 * Get the auto-generated tag label for a filter name
 */
export function getFilterTagLabel(filterName: string): string {
	return `${FILTER_TAG_PREFIX}${slugify(filterName)}`;
}

/**
 * Resolve the effective tag label for a filter.
 * Uses custom tag if set, otherwise auto-generates from filter name.
 */
export function resolveTagLabel(filter: Pick<FilterConfig, 'name' | 'tag'>): string {
	if (filter.tag?.trim()) {
		return filter.tag.trim();
	}
	return getFilterTagLabel(filter.name);
}
