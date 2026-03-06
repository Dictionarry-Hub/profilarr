import type { OperationType } from '../core/types.ts';
import type { QualityDefinitionEntry } from '$shared/pcd/display.ts';
import { pcdOpsQueries } from '$db/queries/pcdOps.ts';

type ParsedMetadata = {
	operation?: OperationType;
	entity?: string;
	name?: string;
	previousName?: string;
	summary?: string;
	title?: string;
	changed_fields?: string[];
	stable_key?: { key: string; value: string };
	depends_on?: Array<{ entity?: string; key?: string; value?: string }>;
	group_id?: string;
	generated?: boolean;
};

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

type FieldAggregate = {
	field: string;
	label: string;
	before?: unknown;
	after?: unknown;
	add?: unknown[];
	remove?: unknown[];
	items?: unknown[];
	beforeItems?: unknown[];
	afterItems?: unknown[];
	conditions?: ConditionDiff[];
	tests?: TestDiff[];
};

type ConditionSnapshot = {
	type?: string;
	arrType?: string;
	negate?: boolean;
	required?: boolean;
	values?: Record<string, unknown> | null;
};

type ConditionDiff = {
	name: string;
	change: 'added' | 'removed' | 'updated';
	before?: ConditionSnapshot;
	after?: ConditionSnapshot;
};

type TestSnapshot = {
	title?: string;
	type?: string;
	shouldMatch?: boolean;
	description?: string | null;
};

type TestDiff = {
	name: string;
	change: 'added' | 'removed' | 'updated';
	before?: TestSnapshot;
	after?: TestSnapshot;
};

export type DraftEntitySectionRow =
	| {
			kind: 'field';
			field: string;
			label: string;
			before?: unknown;
			after?: unknown;
			add?: unknown[];
			remove?: unknown[];
	  }
	| {
			kind: 'quality_definition_entries';
			field: string;
			label: string;
			beforeEntries?: QualityDefinitionEntry[];
			afterEntries?: QualityDefinitionEntry[];
	  }
	| {
			kind: 'conditions';
			field: string;
			label: string;
			rows: ConditionDiff[];
	  }
	| {
			kind: 'tests';
			field: string;
			label: string;
			rows: TestDiff[];
	  }
	| {
			kind: 'custom_format_scores';
			field: string;
			label: string;
			rows: Array<{
				custom_format_name: string;
				arr_type: string;
				before: number | null;
				after: number | null;
			}>;
	  }
	| {
			kind: 'ordered_items';
			field: string;
			label: string;
			beforeItems?: Array<{
				type: string;
				name: string;
				position: number;
				enabled: boolean;
				upgradeUntil: boolean;
				members?: Array<{ name: string }>;
			}>;
			afterItems?: Array<{
				type: string;
				name: string;
				position: number;
				enabled: boolean;
				upgradeUntil: boolean;
				members?: Array<{ name: string }>;
			}>;
	  };

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
};

const FIELD_LABELS: Record<string, string> = {
	quality_profile_name: 'Quality profile',
	custom_format_name: 'Custom format',
	delay_profile_name: 'Delay profile',
	regular_expression_name: 'Regular expression',
	regex101_id: 'Regex101 ID',
	ordered_items: 'Ordered items',
	conditions: 'Conditions',
	tests: 'Tests',
	tags: 'Tags',
	include_in_rename: 'Include in rename',
	preferred_protocol: 'Preferred protocol',
	usenet_delay: 'Usenet delay',
	torrent_delay: 'Torrent delay',
	bypass_if_highest_quality: 'Bypass if highest quality',
	bypass_if_above_custom_format_score: 'Bypass if above score',
	minimum_custom_format_score: 'Minimum score',
	upgrade_until_score: 'Upgrade until score',
	upgrade_score_increment: 'Upgrade score increment'
};

const ENTITY_BY_STABLE_KEY: Record<string, string> = {
	custom_format_name: 'custom_format',
	quality_profile_name: 'quality_profile',
	regular_expression_name: 'regular_expression'
};

function parseJson<T>(value: string | null): T | null {
	if (!value) return null;
	try {
		return JSON.parse(value) as T;
	} catch {
		return null;
	}
}

function humanizeKey(value: string): string {
	const trimmed = value.replace(/[_-]+/g, ' ').trim();
	return trimmed.replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatFieldLabel(field: string): string {
	return FIELD_LABELS[field] ?? humanizeKey(field);
}

function buildSummary(operation: OperationType, fields: string[]): string {
	if (operation === 'create') return 'Created';
	if (operation === 'delete') return 'Deleted';
	if (fields.length === 0) return 'Updated';
	if (fields.length === 1) return `Updated ${formatFieldLabel(fields[0])}`;
	if (fields.length === 2) {
		return `Updated ${formatFieldLabel(fields[0])} + ${formatFieldLabel(fields[1])}`;
	}
	return `Updated ${fields.length} fields`;
}

function ensureField(map: Map<string, FieldAggregate>, field: string): FieldAggregate {
	const existing = map.get(field);
	if (existing) return existing;
	const created: FieldAggregate = { field, label: formatFieldLabel(field) };
	map.set(field, created);
	return created;
}

function mergeValues(target: FieldAggregate, value: unknown) {
	if (target.field === 'tags' && Array.isArray(value)) {
		target.add = Array.from(new Set(value.map((tag) => String(tag))));
		return;
	}

	if (value && typeof value === 'object' && !Array.isArray(value)) {
		const record = value as Record<string, unknown>;
		if ('from' in record || 'to' in record) {
			if (target.before === undefined && record.from !== undefined) {
				target.before = record.from;
			}
			if (record.to !== undefined) {
				target.after = record.to;
			}
			return;
		}
		if ('add' in record || 'remove' in record) {
			const addValues = Array.isArray(record.add) ? record.add : record.add ? [record.add] : [];
			const removeValues = Array.isArray(record.remove)
				? record.remove
				: record.remove
					? [record.remove]
					: [];
			target.add = Array.from(new Set([...(target.add ?? []), ...addValues]));
			target.remove = Array.from(new Set([...(target.remove ?? []), ...removeValues]));
			return;
		}
	}

	target.after = value;
	if (target.before === undefined) {
		target.before = undefined;
	}
}

function mergeCustomFormatScores(target: FieldAggregate, value: unknown) {
	if (!Array.isArray(value)) return;
	const map = new Map<
		string,
		{ custom_format_name: string; arr_type: string; before: number | null; after: number | null }
	>();
	if (Array.isArray(target.items)) {
		for (const item of target.items as Array<{
			custom_format_name: string;
			arr_type: string;
			before: number | null;
			after: number | null;
		}>) {
			map.set(`${item.custom_format_name}::${item.arr_type}`, { ...item });
		}
	}

	for (const entry of value) {
		if (!entry || typeof entry !== 'object') continue;
		const record = entry as Record<string, unknown>;
		if (!record.custom_format_name || !record.arr_type) continue;
		const key = `${record.custom_format_name}::${record.arr_type}`;
		const current = map.get(key);
		const next = {
			custom_format_name: record.custom_format_name as string,
			arr_type: record.arr_type as string,
			before: (record.from ?? current?.before ?? null) as number | null,
			after: (record.to ?? current?.after ?? null) as number | null
		};
		map.set(key, next);
	}

	target.items = Array.from(map.values());
}

function mergeOrderedItems(target: FieldAggregate, value: unknown) {
	if (Array.isArray(value)) {
		target.afterItems = value as Array<{
			type: string;
			name: string;
			position: number;
			enabled: boolean;
			upgradeUntil: boolean;
			members?: Array<{ name: string }>;
		}>;
		return;
	}

	if (value && typeof value === 'object' && !Array.isArray(value)) {
		const record = value as Record<string, unknown>;
		if (Array.isArray(record.from)) {
			target.beforeItems = record.from as Array<{
				type: string;
				name: string;
				position: number;
				enabled: boolean;
				upgradeUntil: boolean;
				members?: Array<{ name: string }>;
			}>;
		}
		if (Array.isArray(record.to)) {
			target.afterItems = record.to as Array<{
				type: string;
				name: string;
				position: number;
				enabled: boolean;
				upgradeUntil: boolean;
				members?: Array<{ name: string }>;
			}>;
		}
	}
}

function isTestPayload(desiredState: Record<string, unknown>): boolean {
	return (
		'test_title' in desiredState ||
		'test_type' in desiredState ||
		'test_should_match' in desiredState ||
		'test_description' in desiredState
	);
}

function extractChangeValue<T>(
	value: unknown,
	mode: 'added' | 'removed' | 'updated'
): { before?: T; after?: T } {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		const record = value as Record<string, unknown>;
		if ('from' in record || 'to' in record) {
			return {
				before: record.from as T | undefined,
				after: record.to as T | undefined
			};
		}
	}

	if (value === undefined) return {};

	if (mode === 'removed') {
		return { before: value as T };
	}
	return { after: value as T };
}

function mergeTests(target: FieldAggregate, value: Record<string, unknown>) {
	const rowsMap = new Map<string, TestDiff>((target.tests ?? []).map((row) => [row.name, row]));

	const mode: 'added' | 'removed' | 'updated' = value.deleted
		? 'removed'
		: Object.values(value).some(
					(entry) =>
						entry &&
						typeof entry === 'object' &&
						!Array.isArray(entry) &&
						('from' in (entry as Record<string, unknown>) ||
							'to' in (entry as Record<string, unknown>))
			  )
			? 'updated'
			: 'added';

	const titleValue = 'title' in value ? value.title : value.test_title;
	const typeValue = 'type' in value ? value.type : value.test_type;
	const matchValue = 'should_match' in value ? value.should_match : value.test_should_match;
	const descriptionValue = 'description' in value ? value.description : value.test_description;

	const titleChange = extractChangeValue<string>(titleValue, mode);
	const typeChange = extractChangeValue<string>(typeValue, mode);
	const matchChange = extractChangeValue<boolean>(matchValue, mode);
	const descriptionChange = extractChangeValue<string | null>(descriptionValue, mode);

	const before: TestSnapshot = {};
	const after: TestSnapshot = {};

	if (titleChange.before !== undefined) before.title = titleChange.before;
	if (titleChange.after !== undefined) after.title = titleChange.after;
	if (typeChange.before !== undefined) before.type = typeChange.before;
	if (typeChange.after !== undefined) after.type = typeChange.after;
	if (matchChange.before !== undefined) before.shouldMatch = matchChange.before;
	if (matchChange.after !== undefined) after.shouldMatch = matchChange.after;
	if (descriptionChange.before !== undefined) before.description = descriptionChange.before;
	if (descriptionChange.after !== undefined) after.description = descriptionChange.after;

	const name = String(titleChange.after ?? titleChange.before ?? 'Test');

	rowsMap.set(name, {
		name,
		change: mode,
		before: Object.keys(before).length > 0 ? before : undefined,
		after: Object.keys(after).length > 0 ? after : undefined
	});

	target.tests = Array.from(rowsMap.values());
}

function extractConditionSnapshot(value: unknown): ConditionSnapshot | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const record = value as Record<string, unknown>;
	const base = (record.base as Record<string, unknown>) ?? {};
	return {
		type: base.type as string | undefined,
		arrType: base.arrType as string | undefined,
		negate: base.negate as boolean | undefined,
		required: base.required as boolean | undefined,
		values: (record.values as Record<string, unknown>) ?? null
	};
}

function mergeConditions(target: FieldAggregate, value: unknown) {
	if (!value || typeof value !== 'object') return;
	const record = value as Record<string, unknown>;
	const rowsMap = new Map<string, ConditionDiff>(
		(target.conditions ?? []).map((row) => [row.name, row])
	);

	const added = Array.isArray(record.added) ? record.added : [];
	for (const entry of added) {
		if (!entry) continue;
		if (typeof entry === 'string') {
			rowsMap.set(entry, { name: entry, change: 'added' });
			continue;
		}
		const snapshot = extractConditionSnapshot(entry);
		const name = (entry as Record<string, unknown>).name as string | undefined;
		if (!name) continue;
		rowsMap.set(name, { name, change: 'added', after: snapshot });
	}

	const removed = Array.isArray(record.removed) ? record.removed : [];
	for (const entry of removed) {
		if (!entry) continue;
		if (typeof entry === 'string') {
			rowsMap.set(entry, { name: entry, change: 'removed' });
			continue;
		}
		const snapshot = extractConditionSnapshot(entry);
		const name = (entry as Record<string, unknown>).name as string | undefined;
		if (!name) continue;
		rowsMap.set(name, { name, change: 'removed', before: snapshot });
	}

	const updated = Array.isArray(record.updated) ? record.updated : [];
	for (const entry of updated) {
		if (!entry || typeof entry !== 'object') continue;
		const name = (entry as Record<string, unknown>).name as string | undefined;
		if (!name) continue;
		const existing = rowsMap.get(name);
		if (existing && (existing.change === 'added' || existing.change === 'removed')) {
			continue;
		}
		const base = (entry as Record<string, unknown>).base as Record<string, unknown> | undefined;
		const values = (entry as Record<string, unknown>).values as Record<string, unknown> | undefined;
		const before: ConditionSnapshot = {
			type: (base?.from as Record<string, unknown> | undefined)?.type as string | undefined,
			arrType: (base?.from as Record<string, unknown> | undefined)?.arrType as string | undefined,
			negate: (base?.from as Record<string, unknown> | undefined)?.negate as boolean | undefined,
			required: (base?.from as Record<string, unknown> | undefined)?.required as
				| boolean
				| undefined,
			values: (values?.from as Record<string, unknown>) ?? null
		};
		const after: ConditionSnapshot = {
			type: (base?.to as Record<string, unknown> | undefined)?.type as string | undefined,
			arrType: (base?.to as Record<string, unknown> | undefined)?.arrType as string | undefined,
			negate: (base?.to as Record<string, unknown> | undefined)?.negate as boolean | undefined,
			required: (base?.to as Record<string, unknown> | undefined)?.required as boolean | undefined,
			values: (values?.to as Record<string, unknown>) ?? null
		};
		rowsMap.set(name, { name, change: 'updated', before, after });
	}

	target.conditions = Array.from(rowsMap.values());
}

function buildSections(
	entity: string,
	aggregates: Map<string, FieldAggregate>
): DraftEntitySection[] {
	if (aggregates.size === 0) return [];

	if (entity === 'quality_profile') {
		const generalFields = ['name', 'description', 'tags', 'language'];
		const scoringFields = [
			'minimum_custom_format_score',
			'upgrade_until_score',
			'upgrade_score_increment',
			'custom_format_scores'
		];
		const qualitiesFields = ['ordered_items'];

		const sections: DraftEntitySection[] = [];

		const buildSectionRows = (fields: string[]): DraftEntitySectionRow[] => {
			const rows: DraftEntitySectionRow[] = [];
			for (const field of fields) {
				const aggregate = aggregates.get(field);
				if (!aggregate) continue;
				if (field === 'custom_format_scores') {
					rows.push({
						kind: 'custom_format_scores',
						field,
						label: aggregate.label,
						rows: (aggregate.items ?? []) as Array<{
							custom_format_name: string;
							arr_type: string;
							before: number | null;
							after: number | null;
						}>
					});
					continue;
				}
				if (field === 'ordered_items') {
					rows.push({
						kind: 'ordered_items',
						field,
						label: aggregate.label,
						beforeItems: (aggregate.beforeItems ?? []) as Array<{
							type: string;
							name: string;
							position: number;
							enabled: boolean;
							upgradeUntil: boolean;
							members?: Array<{ name: string }>;
						}>,
						afterItems: (aggregate.afterItems ?? []) as Array<{
							type: string;
							name: string;
							position: number;
							enabled: boolean;
							upgradeUntil: boolean;
							members?: Array<{ name: string }>;
						}>
					});
					continue;
				}
				rows.push({
					kind: 'field',
					field,
					label: aggregate.label,
					before: aggregate.before,
					after: aggregate.after,
					add: aggregate.add,
					remove: aggregate.remove
				});
			}
			return rows;
		};

		const generalRows = buildSectionRows(generalFields);
		if (generalRows.length > 0)
			sections.push({ id: 'general', title: 'General', rows: generalRows });

		const scoringRows = buildSectionRows(scoringFields);
		if (scoringRows.length > 0)
			sections.push({ id: 'scoring', title: 'Scoring', rows: scoringRows });

		const qualitiesRows = buildSectionRows(qualitiesFields);
		if (qualitiesRows.length > 0)
			sections.push({ id: 'qualities', title: 'Qualities', rows: qualitiesRows });

		return sections;
	}

	if (entity === 'custom_format') {
		const generalFields = ['name', 'description', 'include_in_rename', 'tags'];
		const sections: DraftEntitySection[] = [];
		const buildSectionRows = (fields: string[]): DraftEntitySectionRow[] => {
			const rows: DraftEntitySectionRow[] = [];
			for (const field of fields) {
				const aggregate = aggregates.get(field);
				if (!aggregate) continue;
				rows.push({
					kind: 'field',
					field,
					label: aggregate.label,
					before: aggregate.before,
					after: aggregate.after,
					add: aggregate.add,
					remove: aggregate.remove
				});
			}
			return rows;
		};

		const generalRows = buildSectionRows(generalFields);
		if (generalRows.length > 0)
			sections.push({ id: 'general', title: 'General', rows: generalRows });

		const conditionsAggregate = aggregates.get('conditions');
		if (conditionsAggregate?.conditions && conditionsAggregate.conditions.length > 0) {
			sections.push({
				id: 'conditions',
				title: 'Conditions',
				rows: [
					{
						kind: 'conditions',
						field: 'conditions',
						label: 'Conditions',
						rows: conditionsAggregate.conditions
					}
				]
			});
		}

		const testsAggregate = aggregates.get('tests');
		if (testsAggregate?.tests && testsAggregate.tests.length > 0) {
			sections.push({
				id: 'tests',
				title: 'Tests',
				rows: [
					{
						kind: 'tests',
						field: 'tests',
						label: 'Tests',
						rows: testsAggregate.tests
					}
				]
			});
		}

		return sections;
	}

	if (entity === 'regular_expression') {
		const sections: DraftEntitySection[] = [];
		const generalFields = ['name', 'pattern', 'description', 'regex101_id', 'tags'];

		const generalRows: DraftEntitySectionRow[] = [];
		for (const field of generalFields) {
			const aggregate = aggregates.get(field);
			if (!aggregate) continue;
			generalRows.push({
				kind: 'field',
				field,
				label: aggregate.label,
				before: aggregate.before,
				after: aggregate.after,
				add: aggregate.add,
				remove: aggregate.remove
			});
		}
		if (generalRows.length > 0) {
			sections.push({ id: 'general', title: 'General', rows: generalRows });
		}

		return sections;
	}

	if (entity === 'radarr_quality_definitions' || entity === 'sonarr_quality_definitions') {
		const sections: DraftEntitySection[] = [];
		const generalFields = ['name'];

		const generalRows: DraftEntitySectionRow[] = [];
		for (const field of generalFields) {
			const aggregate = aggregates.get(field);
			if (!aggregate) continue;
			generalRows.push({
				kind: 'field',
				field,
				label: aggregate.label,
				before: aggregate.before,
				after: aggregate.after,
				add: aggregate.add,
				remove: aggregate.remove
			});
		}
		if (generalRows.length > 0) {
			sections.push({ id: 'general', title: 'General', rows: generalRows });
		}

		const entriesAggregate = aggregates.get('entries');
		if (entriesAggregate) {
			sections.push({
				id: 'entries',
				title: 'Entries',
				rows: [
					{
						kind: 'quality_definition_entries',
						field: 'entries',
						label: entriesAggregate.label,
						beforeEntries: entriesAggregate.before as QualityDefinitionEntry[] | undefined,
						afterEntries: entriesAggregate.after as QualityDefinitionEntry[] | undefined
					}
				]
			});
		}

		return sections;
	}

	const fallbackRows: DraftEntitySectionRow[] = [];
	for (const aggregate of aggregates.values()) {
		fallbackRows.push({
			kind: 'field',
			field: aggregate.field,
			label: aggregate.label,
			before: aggregate.before,
			after: aggregate.after,
			add: aggregate.add,
			remove: aggregate.remove
		});
	}

	return [{ id: 'changes', title: 'Changes', rows: fallbackRows }];
}

export function listDraftEntityChanges(databaseId: number): DraftEntityChange[] {
	const ops = pcdOpsQueries.listByDatabaseAndOrigin(databaseId, 'base', { states: ['draft'] });
	const parsedOps = ops.map((op) => ({
		op,
		metadata: parseJson<ParsedMetadata>(op.metadata)
	}));
	// Map every name an entity has had back to its original (pre-draft) name.
	// Handles chains (A→B→C) and cycles (A→B→A) correctly.
	const originalName = new Map<string, string>();
	for (const { metadata } of parsedOps) {
		if (!metadata?.name || !metadata?.entity || !metadata.previousName) continue;
		const key = (n: string) => `${metadata.entity}:${n}`;
		const origin = originalName.get(key(metadata.previousName)) ?? metadata.previousName;
		originalName.set(key(metadata.name), origin);
		originalName.set(key(metadata.previousName), origin);
	}

	const resolveAlias = (entity: string, value: string): string => {
		return originalName.get(`${entity}:${value}`) ?? value;
	};
	const groups = new Map<string, DraftEntityChange>();
	const aggregates = new Map<string, Map<string, FieldAggregate>>();
	const entityCreates = new Map<string, boolean>();
	const entityDeletes = new Map<string, boolean>();
	const dependencies = new Map<string, Set<string>>();

	for (const { op, metadata } of parsedOps) {
		if (!metadata?.entity || !metadata?.name || !metadata.operation) {
			continue;
		}

		const desiredState = parseJson<Record<string, unknown>>(op.desired_state);
		const stableKey = metadata.stable_key?.value ?? metadata.name;
		const baseKey = `${metadata.entity}:${resolveAlias(metadata.entity, stableKey)}`;
		const groupKey =
			metadata.generated && metadata.group_id ? `${baseKey}::${metadata.group_id}` : baseKey;

		if (metadata.depends_on && metadata.depends_on.length > 0) {
			const depSet = dependencies.get(groupKey) ?? new Set<string>();
			for (const dependency of metadata.depends_on) {
				const depEntity =
					dependency.entity ?? (dependency.key ? ENTITY_BY_STABLE_KEY[dependency.key] : undefined);
				const depValue = dependency.value;
				if (!depEntity || !depValue) continue;
				const depKey = `${depEntity}:${resolveAlias(depEntity, depValue)}`;
				if (depKey === groupKey) continue;
				depSet.add(depKey);
			}
			if (depSet.size > 0) {
				dependencies.set(groupKey, depSet);
			}
		}

		const hasNameField = desiredState && Object.prototype.hasOwnProperty.call(desiredState, 'name');
		if (metadata.operation === 'create' && hasNameField) {
			entityCreates.set(groupKey, true);
		}
		if (metadata.operation === 'delete' && hasNameField && desiredState?.deleted === true) {
			entityDeletes.set(groupKey, true);
		}

		const existing = groups.get(groupKey);
		const updatedAt = op.updated_at ?? op.created_at;

		const opDetails: DraftOpDetails = {
			id: op.id,
			operation: metadata.operation,
			title: metadata.title ?? `${humanizeKey(metadata.operation)} ${metadata.entity}`,
			summary: metadata.summary ?? undefined,
			createdAt: op.created_at,
			sequence: op.sequence,
			groupId: metadata.group_id,
			generated: metadata.generated === true
		};

		if (!existing) {
			groups.set(groupKey, {
				key: groupKey,
				entity: metadata.entity,
				name: metadata.name,
				operation: metadata.operation,
				summary: '',
				changedFields: [],
				updatedAt,
				ops: [opDetails],
				sections: []
			});
		} else {
			existing.ops.push(opDetails);
			existing.updatedAt = existing.updatedAt > updatedAt ? existing.updatedAt : updatedAt;
			existing.name = metadata.name;
		}

		if (desiredState) {
			let fieldMap = aggregates.get(groupKey);
			if (!fieldMap) {
				fieldMap = new Map();
				aggregates.set(groupKey, fieldMap);
			}

			if (isTestPayload(desiredState)) {
				const aggregate = ensureField(fieldMap, 'tests');
				mergeTests(aggregate, desiredState);
				continue;
			}

			for (const [field, value] of Object.entries(desiredState)) {
				const aggregate = ensureField(fieldMap, field);
				if (field === 'conditions') {
					mergeConditions(aggregate, value);
					continue;
				}
				if (field === 'custom_format_scores') {
					mergeCustomFormatScores(aggregate, value);
					continue;
				}
				if (field === 'ordered_items') {
					mergeOrderedItems(aggregate, value);
					continue;
				}
				mergeValues(aggregate, value);
			}
		}
	}

	const results: DraftEntityChange[] = [];

	for (const group of groups.values()) {
		group.ops.sort((a, b) => {
			const aSeq = a.sequence ?? a.id;
			const bSeq = b.sequence ?? b.id;
			return aSeq - bSeq;
		});

		const groupIds = new Set(group.ops.map((op) => op.groupId).filter(Boolean));
		if (groupIds.size === 1) {
			group.groupId = Array.from(groupIds)[0];
		}
		group.generated = group.ops.length > 0 && group.ops.every((op) => op.generated);

		const hasCreate = entityCreates.get(group.key) ?? false;
		const hasDelete = entityDeletes.get(group.key) ?? false;
		group.operation = hasCreate ? 'create' : hasDelete ? 'delete' : 'update';

		const fieldMap = aggregates.get(group.key);
		const fieldSet = new Set<string>();
		if (fieldMap) {
			for (const field of fieldMap.keys()) {
				fieldSet.add(field);
			}
		}
		group.changedFields = Array.from(fieldSet);
		group.summary = buildSummary(group.operation, group.changedFields);
		group.sections = buildSections(group.entity, fieldMap ?? new Map());

		const depSet = dependencies.get(group.key);
		if (depSet) {
			const requires: Array<{ key: string; entity: string; name: string }> = [];
			for (const depKey of depSet) {
				const dependency = groups.get(depKey);
				if (!dependency) continue;
				requires.push({
					key: depKey,
					entity: dependency.entity,
					name: dependency.name
				});
			}
			requires.sort((a, b) => {
				if (a.entity === b.entity) return a.name.localeCompare(b.name);
				return a.entity.localeCompare(b.entity);
			});
			if (requires.length > 0) {
				group.requires = requires;
			}
		}

		results.push(group);
	}

	results.sort((a, b) => {
		if (a.groupId && a.groupId === b.groupId && a.generated !== b.generated) {
			return a.generated ? 1 : -1;
		}
		if (a.updatedAt === b.updatedAt) {
			return a.key.localeCompare(b.key);
		}
		return a.updatedAt < b.updatedAt ? 1 : -1;
	});
	return results;
}
