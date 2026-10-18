/** Wording for a condition's default, shown in its hover hint. */

import { CONDITION_FIELD_LABELS, conditionFieldValue } from '$shared/pcd/conditionFormat.ts';
import type { PageData } from '../$types';

type ConditionDefault = PageData['defaults']['conditions'][string];
type Normalized = NonNullable<ConditionDefault['default']>;
type Field = ConditionDefault['changed'][number];

function describeField(field: Field, def: Normalized): string {
	switch (field) {
		case 'negate':
			return def.negate ? 'negated' : 'not negated';
		case 'required':
			return def.required ? 'required' : 'not required';
		default:
			return `${CONDITION_FIELD_LABELS[field].toLowerCase()} ${conditionFieldValue(field, def)}`;
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
