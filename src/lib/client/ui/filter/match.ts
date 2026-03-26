import type { FilterTag, FilterFieldDef } from './types';

interface NumberCondition {
	operator: '>' | '<' | '>=' | '<=' | '=' | 'range';
	value: number;
	upperValue?: number;
}

export function parseNumberCondition(raw: string): NumberCondition | null {
	const trimmed = raw.trim();
	if (!trimmed) return null;

	// Range: 100-500
	const rangeMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/);
	if (rangeMatch) {
		return {
			operator: 'range',
			value: parseFloat(rangeMatch[1]),
			upperValue: parseFloat(rangeMatch[2])
		};
	}

	// Operators: >=, <=, >, <
	const opMatch = trimmed.match(/^(>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/);
	if (opMatch) {
		return {
			operator: opMatch[1] as '>' | '<' | '>=' | '<=',
			value: parseFloat(opMatch[2])
		};
	}

	// Plain number: exact match
	const num = parseFloat(trimmed);
	if (!isNaN(num)) {
		return { operator: '=', value: num };
	}

	return null;
}

function matchesNumberCondition(actual: number, condition: NumberCondition): boolean {
	switch (condition.operator) {
		case '>':
			return actual > condition.value;
		case '<':
			return actual < condition.value;
		case '>=':
			return actual >= condition.value;
		case '<=':
			return actual <= condition.value;
		case '=':
			return actual === condition.value;
		case 'range':
			return actual >= condition.value && actual <= (condition.upperValue ?? condition.value);
	}
}

export function applySmartFilters<T>(
	items: T[],
	tags: FilterTag[],
	fields: FilterFieldDef<T>[]
): T[] {
	if (tags.length === 0) return items;

	const fieldMap = new Map(fields.map((f) => [f.key, f]));

	return items.filter((item) => {
		return tags.every((tag) => {
			const field = fieldMap.get(tag.field);
			if (!field) return true;

			const rawValue = field.accessor(item);

			let matches: boolean;

			if (field.type === 'number') {
				const condition = parseNumberCondition(tag.value);
				if (!condition || rawValue == null) return !tag.negated;
				matches = matchesNumberCondition(Number(rawValue), condition);
			} else {
				const tagLower = tag.value.toLowerCase();
				if (rawValue == null) {
					matches = false;
				} else if (Array.isArray(rawValue)) {
					matches = rawValue.some((v) => v.toLowerCase().includes(tagLower));
				} else {
					matches = String(rawValue).toLowerCase().includes(tagLower);
				}
			}

			return tag.negated ? !matches : matches;
		});
	});
}
