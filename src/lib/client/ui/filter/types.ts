export type FilterFieldType = 'text' | 'number';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- field defs describe items of any shape
export interface FilterFieldDef<T = any> {
	key: string;
	label: string;
	description?: string;
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
