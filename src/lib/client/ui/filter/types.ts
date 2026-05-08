export type FilterFieldType = 'text' | 'number';

// deno-lint-ignore no-explicit-any
export interface FilterFieldDef<T = any> {
	key: string;
	label: string;
	type: FilterFieldType;
	accessor: (item: T) => string | number | string[] | null;
	suggestions?: (items: T[]) => string[];
	isDefault?: boolean;
}

export interface FilterTag {
	id: string;
	field: string;
	value: string;
	negated: boolean;
}

export type SerializedFilterTag = Omit<FilterTag, 'id'>;
