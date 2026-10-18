/** Display wording for custom format condition fields, shared by default hints and related changes. */

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

const gb = (bytes: number | null) => (bytes === null ? 'any' : `${+(bytes / 1e9).toFixed(2)} GB`);

/** A field's value as display text. */
export function conditionFieldValue(field: ConditionField, c: NormalizedCondition): string {
	switch (field) {
		case 'negate':
		case 'required':
			return c[field] ? 'Yes' : 'No';
		case 'arrType':
			return ARR_LABELS[c.arrType] ?? c.arrType;
		case 'type':
			return c.type.replaceAll('_', ' ');
		case 'size':
			return `${gb(c.size?.minBytes ?? null)} to ${gb(c.size?.maxBytes ?? null)}`;
		case 'years':
			return `${c.years?.minYear ?? 'any'} to ${c.years?.maxYear ?? 'any'}`;
		default:
			return c[field].length > 0 ? c[field].join(', ') : 'None';
	}
}

/** A whole condition on one line, for one that was added or removed. */
export function conditionSummary(c: NormalizedCondition): string {
	const list = LISTS.find((field) => c[field].length > 0);
	const values = list
		? c[list].join(', ')
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
