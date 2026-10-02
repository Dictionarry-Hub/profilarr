/**
 * The upstream names of every entity the user layer affects. Renames resolve
 * here over live ops, not at write time, so dropping a rename op un-resolves
 * the names it aliased.
 */

import type { LiveOpEntityRow } from '$db/queries/pcdOpEntities.ts';
import { expandOneHop, type EntityEdge, type EntityRef } from './edges.ts';
import { entityKey } from './opEntities.ts';

export type { LiveOpEntityRow } from '$db/queries/pcdOpEntities.ts';

export interface TouchedSet {
	/** Entities user ops target directly, by upstream name. */
	direct: EntityRef[];
	/** `direct` plus one hop down the upstream tree. */
	all: EntityRef[];
	/** Current upstream name for `name`; null if it was renamed away. */
	upstreamNameOf: (entity: string, name: string) => string | null;
	/** Upstream name a row referred to, as of its own op (see resolveAliases). */
	rowUpstreamName: (row: LiveOpEntityRow) => string | null;
}

export interface AliasResolution {
	upstreamNameOf: TouchedSet['upstreamNameOf'];
	rowUpstreamName: TouchedSet['rowUpstreamName'];
}

/**
 * Resolves names through live renames in op order. Each row resolves as of
 * its own op, and a rename vacates its old name (null) until a later rename
 * takes it again, so reused names map to the right entity.
 * Chains (A -> B -> C) resolve C to A; cycles (A -> B -> A) resolve A to A.
 */
export function resolveAliases(rows: LiveOpEntityRow[]): AliasResolution {
	// Names a rename has touched: carried name -> upstream name (null = vacated).
	const state = new Map<string, string | null>();
	const lookup = (entity: string, name: string): string | null => {
		const key = entityKey(entity, name);
		return state.has(key) ? (state.get(key) as string | null) : name;
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
		for (const row of group) {
			if (!isRename(row)) continue;
			const origin = lookup(row.entity, row.previousName as string);
			state.set(entityKey(row.entity, row.previousName as string), null);
			state.set(entityKey(row.entity, row.name), origin);
		}
	}

	return {
		upstreamNameOf: lookup,
		rowUpstreamName: (row) => (perRow.has(row) ? (perRow.get(row) as string | null) : row.name)
	};
}

export function computeTouchedSet(
	rows: LiveOpEntityRow[],
	upstreamEdges: EntityEdge[]
): TouchedSet {
	const { upstreamNameOf, rowUpstreamName } = resolveAliases(rows);

	const direct = new Map<string, EntityRef>();
	for (const r of rows) {
		if (r.role !== 'target') continue;
		const name = rowUpstreamName(r);
		// No upstream identity: nothing upstream to snapshot for this row.
		if (name === null) continue;
		direct.set(entityKey(r.entity, name), { entity: r.entity, name });
	}

	const all = new Map(direct);
	for (const ref of expandOneHop([...direct.values()], upstreamEdges)) {
		all.set(entityKey(ref.entity, ref.name), ref);
	}

	return {
		direct: [...direct.values()],
		all: [...all.values()],
		upstreamNameOf,
		rowUpstreamName
	};
}
