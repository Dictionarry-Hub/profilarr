/**
 * Local changes to the custom formats and regexes a profile depends on: they
 * change what the profile does without changing its own rows. Only condition,
 * pattern and deletion changes count; a rename's knock-on condition updates don't.
 */

import type { LiveOpEntityRow, OpDetails } from '$db/queries/pcdOpEntities.ts';
import type { DriftDisplayChange } from '$shared/drift.ts';
import {
	CONDITION_FIELD_LABELS,
	conditionFieldValue,
	conditionSummary
} from '$shared/pcd/conditionFormat.ts';
import type { ConditionData } from '$shared/pcd/display.ts';
import type { PortableCustomFormat, PortableRegularExpression } from '$shared/pcd/portable.ts';
import { reach, type EntityEdge } from './edges.ts';
import { didNotApply, parseOpMetadata } from './opEntities.ts';
import {
	customFormatConditionDefaults,
	normalizeCondition,
	type CustomFormatDefaults
} from './entityDefaults.ts';

export type RelatedChangeField = 'conditions' | 'pattern' | 'deleted';

export interface RelatedChange {
	entity: 'custom_format' | 'regular_expression';
	/** Current name; for a deleted custom format, its name in the defaults. */
	name: string;
	/** Row id in the cache, for linking; filled in by the caller. */
	id: number | null;
	/** For a regex: the custom formats this profile scores that use it. */
	via: string[];
	changed: RelatedChangeField[];
	/** One line on what changed, e.g. "2 Conditions Changed". */
	summary: string;
	/** Default against yours, one row per difference; empty when there's nothing to compare. */
	details: DriftDisplayChange[];
	/** At least one of its changes didn't apply. */
	pending: boolean;
	opIds: number[];
}

interface OpInfo {
	changedFields: string[];
	generated: boolean;
	groupId: string | null;
	pending: boolean;
}

function isTestDeletion(d: OpDetails): boolean {
	try {
		const state = JSON.parse(d.desiredState ?? 'null');
		return !!state && typeof state === 'object' && 'test_title' in state;
	} catch {
		return false;
	}
}

function parseOp(d: OpDetails): OpInfo {
	const { changedFields, generated, groupId } = parseOpMetadata(d.metadata);
	return {
		// Deleting a custom format test is written as a 'deleted' change on its format.
		changedFields: isTestDeletion(d) ? changedFields.filter((f) => f !== 'deleted') : changedFields,
		generated,
		groupId,
		pending: didNotApply(d.status)
	};
}

function fieldsOf(entity: string, changedFields: string[]): RelatedChangeField[] {
	if (changedFields.includes('deleted')) return ['deleted'];
	if (entity === 'custom_format') {
		return changedFields.some((f) => f === 'conditions' || f.startsWith('condition:'))
			? ['conditions']
			: [];
	}
	return changedFields.includes('pattern') ? ['pattern'] : [];
}

export function relatedChanges(input: {
	profileName: string;
	/** Edges of the finished cache: what the profile depends on now. */
	edges: EntityEdge[];
	live: LiveOpEntityRow[];
	/** Upstream identity of a current name, or null when it has none. */
	upstreamNameOf: (entity: string, name: string) => string | null;
	/** Upstream identity of a live row, as of its own op. */
	rowUpstreamName: (row: LiveOpEntityRow) => string | null;
	opDetails: (opIds: number[]) => OpDetails[];
	/** Custom formats the profile scores in its defaults, by default name. */
	defaultScored?: string[];
	/** Whether an entity exists now; without it, every deletion is taken as current. */
	exists?: (entity: RelatedChange['entity'], name: string) => boolean;
}): RelatedChange[] {
	const { edges, live, upstreamNameOf, rowUpstreamName } = input;
	const reached = reach([{ entity: 'quality_profile', name: input.profileName }], edges, 'up');

	const scored = new Set(reached.filter((r) => r.entity === 'custom_format').map((r) => r.name));
	// A name with no upstream identity can only match rows written under it.
	const identity = (entity: string, upstream: string | null, name: string) =>
		upstream === null ? `${entity}:l:${name}` : `${entity}:u:${upstream}`;

	const byIdentity = new Map(
		reached.map((r) => [identity(r.entity, upstreamNameOf(r.entity, r.name), r.name), r])
	);
	// A custom format the defaults score but nothing reaches now may have been
	// deleted: only a deletion makes it a related change.
	const onlyInDefaults = new Set<string>();
	for (const name of input.defaultScored ?? []) {
		const key = identity('custom_format', name, name);
		if (byIdentity.has(key)) continue;
		byIdentity.set(key, { entity: 'custom_format', name });
		onlyInDefaults.add(key);
	}
	const opsByEntity = new Map<string, Set<number>>();
	const renameOps = new Set<number>();
	for (const row of live) {
		if (row.role !== 'target') continue;
		if (row.previousName) renameOps.add(row.opId);
		const key = identity(row.entity, rowUpstreamName(row), row.name);
		if (!byIdentity.has(key)) continue;
		if (!opsByEntity.has(key)) opsByEntity.set(key, new Set());
		opsByEntity.get(key)!.add(row.opId);
	}
	if (opsByEntity.size === 0) return [];

	const allIds = [...new Set([...opsByEntity.values()].flatMap((s) => [...s]))];
	const details = new Map(
		input.opDetails([...new Set([...allIds, ...renameOps])]).map((d) => [d.opId, parseOp(d)])
	);
	const renameGroups = new Set(
		[...renameOps].map((id) => details.get(id)?.groupId).filter((g): g is string => !!g)
	);

	const changes: RelatedChange[] = [];
	for (const [key, ids] of opsByEntity) {
		const ref = byIdentity.get(key)!;
		let changed = new Set<RelatedChangeField>();
		const opIds: number[] = [];
		let pending = false;
		let deletionFailed = false;
		for (const id of [...ids].sort((a, b) => a - b)) {
			const op = details.get(id);
			if (!op) continue;
			if (op.generated && op.groupId && renameGroups.has(op.groupId)) continue;
			const fields = fieldsOf(ref.entity, op.changedFields);
			if (fields.length === 0) continue;
			fields.forEach((f) => changed.add(f));
			opIds.push(id);
			if (fields.includes('deleted')) {
				deletionFailed = op.pending;
				// Ops before a deletion that applied were on the entity it removed.
				if (!op.pending) pending = false;
			}
			pending ||= op.pending;
		}
		if (changed.has('deleted')) {
			const entity = ref.entity as RelatedChange['entity'];
			if (deletionFailed || !input.exists?.(entity, ref.name)) {
				changed = new Set(['deleted']);
				pending = deletionFailed;
			} else {
				// Recreated since: compare it like any other change.
				changed = new Set([entity === 'custom_format' ? 'conditions' : 'pattern']);
			}
		}
		if (changed.size === 0 || (onlyInDefaults.has(key) && !changed.has('deleted'))) continue;
		changes.push({
			entity: ref.entity as RelatedChange['entity'],
			name: ref.name,
			id: null,
			via:
				ref.entity === 'regular_expression'
					? edges
							.filter(
								(e) =>
									e.parentEntity === 'regular_expression' &&
									e.parentName === ref.name &&
									scored.has(e.childName)
							)
							.map((e) => e.childName)
							.sort()
					: [],
			changed: [...changed],
			summary: changed.has('deleted')
				? 'Deleted'
				: `${[...changed].map((f) => f[0].toUpperCase() + f.slice(1)).join(', ')} Changed`,
			details: [],
			pending,
			opIds
		});
	}
	return changes.sort((a, b) => a.entity.localeCompare(b.entity) || a.name.localeCompare(b.name));
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A custom format's condition differences as diff rows, plus a one-line summary. */
function conditionDifferences(
	d: CustomFormatDefaults,
	current: ConditionData[]
): { summary: string; details: DriftDisplayChange[] } {
	// Yours shows regexes by their current names.
	const mine = new Map(current.map((c) => [c.name, normalizeCondition(c, (name) => name)]));
	const details: DriftDisplayChange[] = [];
	let modified = 0;
	let added = 0;
	for (const [name, cd] of Object.entries(d.conditions)) {
		const now = mine.get(name);
		if (!now) continue;
		if (cd.status === 'added') {
			added++;
			details.push({
				id: `${name}:added`,
				label: name,
				detail: 'Added',
				actual: { text: conditionSummary(now) },
				tone: 'success'
			});
		} else if (cd.status === 'modified' && cd.default) {
			modified++;
			for (const field of cd.changed) {
				details.push({
					id: `${name}:${field}`,
					label: name,
					detail: CONDITION_FIELD_LABELS[field],
					expected: { text: conditionFieldValue(field, cd.default) },
					actual: { text: conditionFieldValue(field, now) },
					tone: 'warning'
				});
			}
		}
	}
	for (const r of d.removed) {
		details.push({
			id: `${r.name}:removed`,
			label: r.name,
			detail: 'Removed',
			expected: { text: conditionSummary(r.condition) },
			tone: 'danger'
		});
	}
	const summary = [
		modified && `${plural(modified, 'Condition')} Changed`,
		added && `${plural(added, 'Condition')} Added`,
		d.removed.length && `${plural(d.removed.length, 'Condition')} Removed`
	]
		.filter(Boolean)
		.join(', ');
	return { summary, details };
}

/**
 * Keeps the related changes that still differ from their defaults, with what
 * differs, and any that didn't apply. One whose default wasn't captured stays as
 * it is; one created locally has no default and isn't a related change.
 */
export function remainingRelatedChanges(input: {
	changes: RelatedChange[];
	/** null: not in upstream. undefined: not captured. */
	defaultOf: (
		change: RelatedChange
	) => PortableCustomFormat | PortableRegularExpression | null | undefined;
	/** Current pattern by regex name, and current conditions by custom format name. */
	currentPatterns: Map<string, string>;
	currentConditions: Map<string, ConditionData[]>;
	regexUpstreamName: (name: string) => string | null;
}): RelatedChange[] {
	const kept: RelatedChange[] = [];
	for (const change of input.changes) {
		const def = input.defaultOf(change);
		if (def === undefined || change.changed.includes('deleted')) {
			kept.push(change);
			continue;
		}
		if (def === null) continue;
		if (change.entity === 'regular_expression') {
			const pattern = (def as PortableRegularExpression).pattern;
			const current = input.currentPatterns.get(change.name);
			if (current === pattern) {
				if (change.pending) kept.push(change);
				continue;
			}
			kept.push({
				...change,
				details: [
					{
						id: 'pattern',
						label: 'Pattern',
						expected: { text: pattern, mono: true },
						actual: current === undefined ? undefined : { text: current, mono: true },
						tone: 'warning'
					}
				]
			});
			continue;
		}
		const current = input.currentConditions.get(change.name) ?? [];
		const { summary, details } = conditionDifferences(
			customFormatConditionDefaults({
				upstream: def as PortableCustomFormat,
				current,
				regexUpstreamName: input.regexUpstreamName,
				pendingConditions: new Set()
			}),
			current
		);
		if (details.length === 0) {
			if (change.pending) kept.push(change);
			continue;
		}
		kept.push({ ...change, summary, details });
	}
	return kept;
}
