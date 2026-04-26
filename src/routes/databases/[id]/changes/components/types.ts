import type { QualityProfileCustomFormatsRow } from '$shared/pcd/types';
import type { OrderedItem, QualityDefinitionEntry } from '$shared/pcd/display';

export type OperationType = 'create' | 'update' | 'delete';

export type DraftOpDetails = {
	id: number;
	operation: OperationType;
	title: string;
	summary?: string;
	createdAt: string;
	sequence: number | null;
	groupId?: string;
	generated?: boolean;
};

export type FieldRow = {
	kind: 'field';
	field: string;
	label: string;
	before?: unknown;
	after?: unknown;
	add?: unknown[];
	remove?: unknown[];
};

export type ConditionSnapshot = {
	type?: string;
	arrType?: string;
	required?: boolean;
	negate?: boolean;
	values?: Record<string, unknown> | null;
};

export type ConditionDiff = {
	name: string;
	change: 'added' | 'removed' | 'updated';
	before?: ConditionSnapshot;
	after?: ConditionSnapshot;
};

export type ConditionsRow = {
	kind: 'conditions';
	field: string;
	label: string;
	rows: ConditionDiff[];
};

export type TestSnapshot = {
	title?: string;
	type?: string;
	shouldMatch?: boolean;
	description?: string | null;
};

export type TestDiff = {
	name: string;
	change: 'added' | 'removed' | 'updated';
	before?: TestSnapshot;
	after?: TestSnapshot;
};

export type TestsRow = {
	kind: 'tests';
	field: string;
	label: string;
	rows: TestDiff[];
};

export type CustomFormatScoreDiff = Pick<
	QualityProfileCustomFormatsRow,
	'custom_format_name' | 'arr_type'
> & {
	before: number | null;
	after: number | null;
};

export type CustomFormatScoresRow = {
	kind: 'custom_format_scores';
	field: string;
	label: string;
	rows: CustomFormatScoreDiff[];
};

export type OrderedItemsRow = {
	kind: 'ordered_items';
	field: string;
	label: string;
	beforeItems?: OrderedItem[];
	afterItems?: OrderedItem[];
};

export type QualityDefinitionEntriesRow = {
	kind: 'quality_definition_entries';
	field: string;
	label: string;
	beforeEntries?: QualityDefinitionEntry[];
	afterEntries?: QualityDefinitionEntry[];
};

export type DraftEntitySectionRow =
	| FieldRow
	| ConditionsRow
	| TestsRow
	| CustomFormatScoresRow
	| OrderedItemsRow
	| QualityDefinitionEntriesRow;

export type DraftEntitySection = {
	id: string;
	title: string;
	rows: DraftEntitySectionRow[];
};

export type DraftEntityChange = {
	key: string;
	entity: string;
	name: string;
	operation: OperationType;
	summary: string;
	changedFields: string[];
	updatedAt: string;
	ops: DraftOpDetails[];
	sections: DraftEntitySection[];
	requires?: Array<{ key: string; entity: string; name: string }>;
	groupId?: string;
	generated?: boolean;
	// Set on file-backed rows (entity 'file' or 'announcement') so commit
	// flow can collect filepaths regardless of displayed entity.
	path?: string;
};

export type { QualityDefinitionEntry };
