/** Wording for a condition's default, shown in its hover hint. */

import type { PageData } from '../$types';

type ConditionDefault = PageData['defaults']['conditions'][string];
type Normalized = NonNullable<ConditionDefault['default']>;
type Field = ConditionDefault['changed'][number];

const ARR_LABELS: Record<string, string> = {
	all: 'Radarr and Sonarr',
	radarr: 'Radarr',
	sonarr: 'Sonarr'
};

const LIST_LABELS: Partial<Record<Field, string>> = {
	patterns: 'patterns',
	languages: 'languages',
	sources: 'sources',
	resolutions: 'resolutions',
	qualityModifiers: 'quality modifiers',
	releaseTypes: 'release types',
	indexerFlags: 'indexer flags'
};

const gb = (bytes: number | null) => (bytes === null ? 'any' : `${+(bytes / 1e9).toFixed(2)} GB`);

function describeField(field: Field, def: Normalized): string {
	switch (field) {
		case 'negate':
			return def.negate ? 'negated' : 'not negated';
		case 'required':
			return def.required ? 'required' : 'not required';
		case 'arrType':
			return `applies to ${ARR_LABELS[def.arrType] ?? def.arrType}`;
		case 'type':
			return `type ${def.type.replaceAll('_', ' ')}`;
		case 'size':
			return `size ${gb(def.size?.minBytes ?? null)} to ${gb(def.size?.maxBytes ?? null)}`;
		case 'years':
			return `years ${def.years?.minYear ?? 'any'} to ${def.years?.maxYear ?? 'any'}`;
		default: {
			const values = def[field] as string[];
			return `${LIST_LABELS[field] ?? field} ${values.length > 0 ? values.join(', ') : 'none'}`;
		}
	}
}

export function describeConditionDefault(d: ConditionDefault): string {
	const notApplied = "your change didn't apply";
	if (d.status === 'added')
		return d.pending ? `Not in the defaults · ${notApplied}` : 'Not in the defaults';
	if (d.status === 'unchanged' || !d.default) return `Matches the default · ${notApplied}`;
	const text = `Default: ${d.changed.map((f) => describeField(f, d.default!)).join(', ')}`;
	return d.pending ? `${text} · ${notApplied}` : text;
}
