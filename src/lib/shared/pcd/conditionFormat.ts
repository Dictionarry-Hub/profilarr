/**
 * Display wording for custom format condition fields, shared by default hints
 * and related changes. Values read as the condition editor shows them.
 */

import {
	CONDITION_TYPES,
	INDEXER_FLAG_VALUES,
	QUALITY_MODIFIER_VALUES,
	RELEASE_TYPE_VALUES,
	RESOLUTION_VALUES,
	SOURCE_VALUES
} from './conditions.ts';

/** A condition reduced to what decides matching, with lists sorted. */
export interface NormalizedCondition {
	type: string;
	arrType: string;
	negate: boolean;
	required: boolean;
	patterns: string[];
	languages: string[];
	sources: string[];
	resolutions: string[];
	qualityModifiers: string[];
	releaseTypes: string[];
	indexerFlags: string[];
	size: { minBytes: number | null; maxBytes: number | null } | null;
	years: { minYear: number | null; maxYear: number | null } | null;
}

export type ConditionField = keyof NormalizedCondition;

export const CONDITION_FIELD_LABELS: Record<ConditionField, string> = {
	type: 'Type',
	arrType: 'Applies to',
	negate: 'Negate',
	required: 'Required',
	patterns: 'Patterns',
	languages: 'Languages',
	sources: 'Sources',
	resolutions: 'Resolutions',
	qualityModifiers: 'Quality modifiers',
	releaseTypes: 'Release types',
	indexerFlags: 'Indexer flags',
	size: 'Size',
	years: 'Years'
};

const ARR_LABELS: Record<string, string> = {
	all: 'Radarr and Sonarr',
	radarr: 'Radarr',
	sonarr: 'Sonarr'
};

const LISTS = [
	'patterns',
	'languages',
	'sources',
	'resolutions',
	'qualityModifiers',
	'releaseTypes',
	'indexerFlags'
] as const;

type ListField = (typeof LISTS)[number];

const labelsOf = (values: ReadonlyArray<{ value: string; label: string }>) =>
	new Map(values.map((v) => [v.value, v.label]));

const TYPE_LABELS = labelsOf(CONDITION_TYPES);

const VALUE_LABELS: Partial<Record<ListField, Map<string, string>>> = {
	sources: labelsOf(SOURCE_VALUES),
	resolutions: labelsOf(RESOLUTION_VALUES),
	qualityModifiers: labelsOf(QUALITY_MODIFIER_VALUES),
	releaseTypes: labelsOf(RELEASE_TYPE_VALUES),
	indexerFlags: labelsOf(INDEXER_FLAG_VALUES)
};

const listValues = (field: ListField, c: NormalizedCondition) =>
	c[field].map((v) => VALUE_LABELS[field]?.get(v) ?? v).join(', ');

// The condition editor and sync count a GB as 1024³ bytes.
const BYTES_PER_GB = 1024 ** 3;
const gb = (bytes: number | null) =>
	bytes === null ? 'any' : `${+(bytes / BYTES_PER_GB).toFixed(2)} GB`;

/** A field's value as display text. */
export function conditionFieldValue(field: ConditionField, c: NormalizedCondition): string {
	switch (field) {
		case 'negate':
		case 'required':
			return c[field] ? 'Yes' : 'No';
		case 'arrType':
			return ARR_LABELS[c.arrType] ?? c.arrType;
		case 'type':
			return TYPE_LABELS.get(c.type) ?? c.type.replaceAll('_', ' ');
		case 'size':
			return c.size ? `${gb(c.size.minBytes)} to ${gb(c.size.maxBytes)}` : 'None';
		case 'years':
			return c.years ? `${c.years.minYear ?? 'any'} to ${c.years.maxYear ?? 'any'}` : 'None';
		default:
			return c[field].length > 0 ? listValues(field, c) : 'None';
	}
}

/** A whole condition on one line, for one that was added or removed. */
export function conditionSummary(c: NormalizedCondition): string {
	const list = LISTS.find((field) => c[field].length > 0);
	const values = list
		? listValues(list, c)
		: c.size
			? conditionFieldValue('size', c)
			: c.years
				? conditionFieldValue('years', c)
				: '';
	const flags = [c.negate && 'negated', c.required && 'required'].filter(Boolean).join(', ');
	return [conditionFieldValue('type', c) + (values ? `: ${values}` : ''), flags]
		.filter(Boolean)
		.join(' · ');
}
