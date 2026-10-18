/**
 * The upstream names of every entity the user layer affects. Renames resolve
 * here over live ops, not at write time, so dropping a rename op un-resolves
 * the names it aliased.
 */

import type { LiveOpEntityRow } from '$db/queries/pcdOpEntities.ts';
import { expandOneHop, type EntityEdge, type EntityRef } from './edges.ts';
import { entityKey } from './opEntities.ts';

export type { LiveOpEntityRow } from '$db/queries/pcdOpEntities.ts';

export interface AliasResolution {
	/** Current upstream name for `name`; null if it was renamed away. */
	upstreamNameOf: (entity: string, name: string) => string | null;
	/** Upstream name a row referred to, as of its own op. */
	rowUpstreamName: (row: LiveOpEntityRow) => string | null;
	/** Upstream name `name` referred to just before op `opId`; null if renamed away by then. */
	upstreamNameBefore: (entity: string, name: string, opId: number) => string | null;
}

/**
 * Resolves names through live renames that applied, in op order. Each row resolves as of
 * its own op, and a rename vacates its old name (null) until a later rename
 * takes it again, so reused names map to the right entity.
 * Chains (A -> B -> C) resolve C to A; cycles (A -> B -> A) resolve A to A.
 */
export function resolveAliases(rows: LiveOpEntityRow[]): AliasResolution {
	// Names a rename has touched: carried name -> upstream name (null = vacated).
	const state = new Map<string, string | null>();
	// Every change to a name's state, in op order, for lookups as of an earlier op.
	const history = new Map<string, Array<[number, string | null]>>();
	const lookup = (entity: string, name: string): string | null => {
		const key = entityKey(entity, name);
		return state.has(key) ? (state.get(key) as string | null) : name;
	};
	const assign = (key: string, value: string | null, opId: number) => {
		state.set(key, value);
		if (!history.has(key)) history.set(key, []);
		history.get(key)!.push([opId, value]);
	};
	const upstreamNameBefore = (entity: string, name: string, opId: number): string | null => {
		let value: string | null = name;
		for (const [at, v] of history.get(entityKey(entity, name)) ?? []) {
			if (at >= opId) break;
			value = v;
		}
		return value;
	};
	const perRow = new Map<LiveOpEntityRow, string | null>();
	const isRename = (r: LiveOpEntityRow) => r.role === 'target' && !!r.previousName;

	const ordered = rows
		.map((row, index) => ({ row, index }))
		.sort((a, b) => a.row.opId - b.row.opId || a.index - b.index)
		.map(({ row }) => row);

	for (let i = 0; i < ordered.length;) {
		const opId = ordered[i].opId;
		const group: LiveOpEntityRow[] = [];
		while (i < ordered.length && ordered[i].opId === opId) group.push(ordered[i++]);

		for (const row of group) {
			perRow.set(
				row,
				isRename(row)
					? lookup(row.entity, row.previousName as string)
					: lookup(row.entity, row.name)
			);
		}
		// A rename that didn't apply still aims at its old name, but moves nothing.
		for (const row of group) {
			if (!isRename(row) || row.failed) continue;
			const origin = lookup(row.entity, row.previousName as string);
			assign(entityKey(row.entity, row.previousName as string), null, opId);
			assign(entityKey(row.entity, row.name), origin, opId);
		}
	}

	return {
		upstreamNameOf: lookup,
		rowUpstreamName: (row) => (perRow.has(row) ? (perRow.get(row) as string | null) : row.name),
		upstreamNameBefore
	};
}

/**
 * Every name a target was written with or renamed from, plus one hop down the
 * upstream tree. Capture runs before replay, so which of those names an
 * upstream entity carries this compile isn't settled yet (a rename that applied
 * last time can fail now); collecting them all covers every outcome, and
 * capture's existence check drops the ones upstream doesn't have.
 */
export function computeTouchedSet(
	rows: LiveOpEntityRow[],
	upstreamEdges: EntityEdge[]
): EntityRef[] {
	const direct = new Map<string, EntityRef>();
	for (const r of rows) {
		if (r.role !== 'target') continue;
		for (const name of [r.name, r.previousName]) {
			if (name) direct.set(entityKey(r.entity, name), { entity: r.entity, name });
		}
	}

	const all = new Map(direct);
	for (const ref of expandOneHop([...direct.values()], upstreamEdges)) {
		all.set(entityKey(ref.entity, ref.name), ref);
	}

	return [...all.values()];
}
