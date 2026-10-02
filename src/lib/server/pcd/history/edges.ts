/**
 * Entity relationship tree.
 * Three levels, derived from the compiled cache, never stored:
 *   regular_expression -> custom_format   (condition_patterns)
 *   custom_format      -> quality_profile (quality_profile_custom_formats)
 * No other schema table links these entities: CF tests are the CF's own rows,
 * and tags, qualities and languages are global.
 * A query constant, not a view, so the cache schema matches the PCD schema.
 */

import { entityKey } from './opEntities.ts';

export interface EntityEdge {
	parentEntity: string;
	parentName: string;
	childEntity: string;
	childName: string;
}

// UNION (not UNION ALL) deduplicates: one edge per pair, however many arr
// types a score row has or conditions a regex appears in.
export const ENTITY_EDGES_SQL = `
	SELECT
		'regular_expression' AS parentEntity, regular_expression_name AS parentName,
		'custom_format' AS childEntity, custom_format_name AS childName
	FROM condition_patterns
	UNION
	SELECT
		'custom_format', custom_format_name,
		'quality_profile', quality_profile_name
	FROM quality_profile_custom_formats
`;

export interface EntityRef {
	entity: string;
	name: string;
}

export interface ReachedEntity extends EntityRef {
	/** Hops from the nearest start entity (1 = direct parent or child). */
	depth: number;
	/** The start entity this was reached from (nearest one, first found on ties). */
	via: EntityRef;
}

type Direction = 'down' | 'up';

function indexEdges(edges: EntityEdge[], direction: Direction): Map<string, EntityRef[]> {
	const index = new Map<string, EntityRef[]>();
	for (const e of edges) {
		const from =
			direction === 'down'
				? entityKey(e.parentEntity, e.parentName)
				: entityKey(e.childEntity, e.childName);
		const to: EntityRef =
			direction === 'down'
				? { entity: e.childEntity, name: e.childName }
				: { entity: e.parentEntity, name: e.parentName };
		const list = index.get(from);
		if (list) list.push(to);
		else index.set(from, [to]);
	}
	return index;
}

/**
 * Breadth-first walk from `start` along `edges`, down (what these reach) or up
 * (what reaches these). Start entities are never returned.
 */
export function reach(
	start: EntityRef[],
	edges: EntityEdge[],
	direction: Direction,
	maxDepth = Number.POSITIVE_INFINITY
): ReachedEntity[] {
	const index = indexEdges(edges, direction);
	const startKeys = new Set(start.map((s) => entityKey(s.entity, s.name)));
	const found = new Map<string, ReachedEntity>();
	let frontier: Array<{ ref: EntityRef; via: EntityRef }> = start.map((ref) => ({ ref, via: ref }));

	for (let depth = 1; frontier.length > 0 && depth <= maxDepth; depth++) {
		const next: typeof frontier = [];
		for (const { ref, via } of frontier) {
			for (const to of index.get(entityKey(ref.entity, ref.name)) ?? []) {
				const key = entityKey(to.entity, to.name);
				if (startKeys.has(key) || found.has(key)) continue;
				found.set(key, { ...to, depth, via });
				next.push({ ref: to, via });
			}
		}
		frontier = next;
	}
	return [...found.values()];
}

/** One hop down: entities whose own rows change when a start entity changes. */
export function expandOneHop(start: EntityRef[], edges: EntityEdge[]): EntityRef[] {
	return reach(start, edges, 'down', 1).map(({ entity, name }) => ({ entity, name }));
}
