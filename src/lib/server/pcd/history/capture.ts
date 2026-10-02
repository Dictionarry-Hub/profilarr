/**
 * Snapshots every entity the user layer touches at the base/user boundary
 * of a compile, so local changes can be diffed against upstream.
 *
 * Never throws: a failed build disables the database, so capture problems
 * only degrade history. A failing entity lands in `failures`; anything
 * worse makes the snapshot `unavailable`.
 */

import type { LiveOpEntityRow } from '$db/queries/pcdOpEntities.ts';
import { ENTITY_EDGES_SQL, type EntityEdge } from './edges.ts';
import { entityKey } from './opEntities.ts';
import { computeTouchedSet, type TouchedSet } from './touched.ts';

/** Entity types with a snapshot serializer. */
export const SNAPSHOT_ENTITIES = [
	'quality_profile',
	'custom_format',
	'regular_expression'
] as const;
export type SnapshotEntity = (typeof SNAPSHOT_ENTITIES)[number];

export const SNAPSHOT_TABLES: Readonly<Record<SnapshotEntity, string>> = {
	quality_profile: 'quality_profiles',
	custom_format: 'custom_formats',
	regular_expression: 'regular_expressions'
};

export function isSnapshotEntity(entity: string): entity is SnapshotEntity {
	return (SNAPSHOT_ENTITIES as readonly string[]).includes(entity);
}

export interface SnapshotFailure {
	entity: string;
	name: string;
	error: string;
}

export interface UpstreamSnapshot {
	/**
	 * none: no live user changes, nothing captured.
	 * captured: entities holds every touched snapshot entity.
	 * unavailable: capture failed as a whole; see error.
	 */
	status: 'none' | 'captured' | 'unavailable';
	/** Keyed by entityKey(entity, upstreamName). null = not in upstream. */
	entities: ReadonlyMap<string, unknown>;
	edges: readonly EntityEdge[];
	touched: TouchedSet | null;
	failures: readonly SnapshotFailure[];
	unplaced: number;
	error: string | null;
}

export function emptySnapshot(): UpstreamSnapshot {
	return {
		status: 'none',
		entities: new Map(),
		edges: [],
		touched: null,
		failures: [],
		unplaced: 0,
		error: null
	};
}

export interface CaptureDeps {
	listLive: () => LiveOpEntityRow[];
	countUnplaced: () => number;
	readEdges: () => EntityEdge[];
	exists: (entity: SnapshotEntity, name: string) => boolean;
	serialize: (entity: SnapshotEntity, name: string) => Promise<unknown>;
}

export interface RawSqlite {
	prepare(sql: string): {
		all(...params: unknown[]): unknown[];
		get(...params: unknown[]): unknown;
	};
}

export function sqliteReaders(db: RawSqlite): Pick<CaptureDeps, 'readEdges' | 'exists'> {
	return {
		readEdges: () => db.prepare(ENTITY_EDGES_SQL).all() as EntityEdge[],
		exists: (entity, name) =>
			db.prepare(`SELECT 1 FROM ${SNAPSHOT_TABLES[entity]} WHERE name = ? LIMIT 1`).get(name) !==
			undefined
	};
}

export async function captureUpstream(deps: CaptureDeps): Promise<UpstreamSnapshot> {
	try {
		const live = deps.listLive();
		const unplaced = deps.countUnplaced();
		if (live.length === 0) return { ...emptySnapshot(), unplaced };

		const edges = deps.readEdges();
		const touched = computeTouchedSet(live, edges);
		const entities = new Map<string, unknown>();
		const failures: SnapshotFailure[] = [];

		for (const ref of touched.all) {
			if (!isSnapshotEntity(ref.entity)) continue;
			const key = entityKey(ref.entity, ref.name);
			try {
				// Serializers throw on a missing entity, so check first: absent
				// upstream (created locally) is a valid answer, not a failure.
				if (!deps.exists(ref.entity, ref.name)) {
					entities.set(key, null);
					continue;
				}
				entities.set(key, await deps.serialize(ref.entity, ref.name));
			} catch (error) {
				failures.push({ entity: ref.entity, name: ref.name, error: String(error) });
			}
		}

		return { status: 'captured', entities, edges, touched, failures, unplaced, error: null };
	} catch (error) {
		return { ...emptySnapshot(), status: 'unavailable', error: String(error) };
	}
}
