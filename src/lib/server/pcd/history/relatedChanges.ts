/**
 * Local changes to the custom formats and regexes a profile depends on: they
 * change what the profile does without changing its own rows. Only conditions
 * and patterns count, and a rename's knock-on condition updates don't.
 */

import type { LiveOpEntityRow, OpDetails } from '$db/queries/pcdOpEntities.ts';
import { reach, type EntityEdge } from './edges.ts';

export type RelatedChangeField = 'conditions' | 'pattern';

export interface RelatedChange {
	entity: 'custom_format' | 'regular_expression';
	/** Current name. */
	name: string;
	/** Row id in the cache, for linking; filled in by the caller. */
	id: number | null;
	/** For a regex: the custom formats this profile scores that use it. */
	via: string[];
	changed: RelatedChangeField[];
	/** At least one of its changes conflicted and didn't apply. */
	pending: boolean;
	opIds: number[];
}

interface OpInfo {
	changedFields: string[];
	generated: boolean;
	groupId: string | null;
	pending: boolean;
}

function parseOp(d: OpDetails): OpInfo {
	let metadata: Record<string, unknown> = {};
	try {
		const value = JSON.parse(d.metadata ?? '{}');
		if (value && typeof value === 'object') metadata = value;
	} catch {
		// Malformed metadata contributes nothing.
	}
	const changed = metadata.changed_fields;
	return {
		changedFields: Array.isArray(changed) ? changed.filter((f) => typeof f === 'string') : [],
		generated: metadata.generated === true,
		groupId: typeof metadata.group_id === 'string' ? metadata.group_id : null,
		pending: d.status === 'conflicted_pending' || d.status === 'conflicted' || d.status === 'error'
	};
}

function fieldsOf(entity: string, changedFields: string[]): RelatedChangeField[] {
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
}): RelatedChange[] {
	const { edges, live, upstreamNameOf, rowUpstreamName } = input;
	const reached = reach([{ entity: 'quality_profile', name: input.profileName }], edges, 'up');
	if (reached.length === 0) return [];

	const scored = new Set(reached.filter((r) => r.entity === 'custom_format').map((r) => r.name));
	// A name with no upstream identity can only match rows written under it.
	const identity = (entity: string, upstream: string | null, name: string) =>
		upstream === null ? `${entity}:l:${name}` : `${entity}:u:${upstream}`;

	const byIdentity = new Map(
		reached.map((r) => [identity(r.entity, upstreamNameOf(r.entity, r.name), r.name), r])
	);
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
		const changed = new Set<RelatedChangeField>();
		const opIds: number[] = [];
		let pending = false;
		for (const id of [...ids].sort((a, b) => a - b)) {
			const op = details.get(id);
			if (!op) continue;
			if (op.generated && op.groupId && renameGroups.has(op.groupId)) continue;
			const fields = fieldsOf(ref.entity, op.changedFields);
			if (fields.length === 0) continue;
			fields.forEach((f) => changed.add(f));
			opIds.push(id);
			pending ||= op.pending;
		}
		if (changed.size === 0) continue;
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
			pending,
			opIds
		});
	}
	return changes.sort((a, b) => a.entity.localeCompare(b.entity) || a.name.localeCompare(b.name));
}
