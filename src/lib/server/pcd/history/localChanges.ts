/**
 * Local changes for an entity page: the last build's upstream snapshot, the
 * entity's current state, and its live ops, assembled into rows. Read after a
 * build completes, so it uses the finished cache.
 */

import type { LiveOpEntityRow, OpDetails } from '$db/queries/pcdOpEntities.ts';
import { pcdOpEntitiesQueries } from '$db/queries/pcdOpEntities.ts';
import type { PCDCache } from '$pcd/index.ts';
import type {
	PortableCustomFormat,
	PortableQualityProfile,
	PortableRegularExpression
} from '$shared/pcd/portable.ts';
import { getConditionsForEvaluation } from '../entities/customFormats/conditions/read.ts';
import { serializeQualityProfile } from '../entities/serialize.ts';
import type { UpstreamSnapshot } from './capture.ts';
import { ENTITY_EDGES_SQL, type EntityEdge } from './edges.ts';
import { customFormatConditionDefaults } from './entityDefaults.ts';
import { entityKey } from './opEntities.ts';
import {
	qualityProfileScoringChanges,
	type ScoringChanges,
	type ScoringOp
} from './qualityProfileScoring.ts';
import { relatedChanges, remainingRelatedChanges, type RelatedChange } from './relatedChanges.ts';
import { resolveAliases } from './touched.ts';

export interface QualityProfileScoringLocalChanges extends ScoringChanges {
	/** none: no local changes anywhere. unavailable: capture failed for this profile; rows are empty. */
	snapshot: UpstreamSnapshot['status'];
	/** database: capture failed as a whole. profile: only this profile's. load: reading failed. */
	unavailableReason: 'database' | 'profile' | 'load' | null;
	relatedChanges: RelatedChange[];
}

function parseJson(raw: string | null): Record<string, unknown> | null {
	if (!raw) return null;
	try {
		const value = JSON.parse(raw);
		return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
	} catch {
		return null;
	}
}

export function assembleQualityProfileScoringChanges(input: {
	snapshot: UpstreamSnapshot;
	live: LiveOpEntityRow[];
	opDetails: (opIds: number[]) => OpDetails[];
	current: PortableQualityProfile;
	profileName: string;
	/** Edges of the finished cache. */
	edges: EntityEdge[];
}): QualityProfileScoringLocalChanges {
	const { snapshot, live, current, profileName } = input;
	const { upstreamNameOf, rowUpstreamName, upstreamNameBefore } = resolveAliases(live);
	const upstreamName = upstreamNameOf('quality_profile', profileName);
	const related = relatedChanges({
		profileName,
		edges: input.edges,
		live,
		upstreamNameOf,
		rowUpstreamName,
		opDetails: input.opDetails
	});

	if (snapshot.status !== 'captured') {
		return {
			snapshot: snapshot.status,
			unavailableReason: snapshot.status === 'unavailable' ? 'database' : null,
			relatedChanges: related,
			status: 'unchanged',
			rows: []
		};
	}
	// Its upstream failed to serialize: without it, every row would be a guess.
	const failed = snapshot.failures.some(
		(f) => f.entity === 'quality_profile' && f.name === upstreamName
	);
	if (failed) {
		return {
			snapshot: 'unavailable',
			unavailableReason: 'profile',
			relatedChanges: related,
			status: 'unchanged',
			rows: []
		};
	}

	const identity = (row: LiveOpEntityRow) =>
		upstreamName !== null
			? rowUpstreamName(row) === upstreamName
			: rowUpstreamName(row) === null && row.name === profileName;

	const opIds = new Set<number>();
	for (const row of live) {
		if (row.role === 'target' && row.entity === 'quality_profile' && identity(row)) {
			opIds.add(row.opId);
		}
	}

	// A score op depends on its CF; that row resolves the CF's name as of the op.
	const cfUpstreamNameByOp = new Map<number, string | null>();
	for (const row of live) {
		if (opIds.has(row.opId) && row.role === 'prerequisite' && row.entity === 'custom_format') {
			cfUpstreamNameByOp.set(row.opId, rowUpstreamName(row));
		}
	}

	const ops: ScoringOp[] = input.opDetails([...opIds]).map((d) => {
		const metadata = parseJson(d.metadata);
		return {
			opId: d.opId,
			changedFields: Array.isArray(metadata?.changed_fields)
				? (metadata.changed_fields as string[])
				: [],
			generated: metadata?.generated === true,
			desiredState: parseJson(d.desiredState),
			status: d.status,
			replacesOpId: d.replacesOpId,
			cfUpstreamName: cfUpstreamNameByOp.get(d.opId) ?? null
		};
	});

	const upstream =
		upstreamName === null
			? null
			: (snapshot.entities.get(entityKey('quality_profile', upstreamName)) as
					PortableQualityProfile | null | undefined);

	return {
		snapshot: snapshot.status,
		unavailableReason: null,
		relatedChanges: related,
		...qualityProfileScoringChanges({
			upstream,
			current,
			cfUpstreamNameOf: (name) => upstreamNameOf('custom_format', name),
			cfUpstreamNameBefore: (name, opId) => upstreamNameBefore('custom_format', name, opId),
			ops
		})
	};
}

export async function qualityProfileScoringLocalChanges(
	cache: PCDCache,
	databaseId: number,
	profileName: string
): Promise<QualityProfileScoringLocalChanges> {
	const snapshot = cache.getUpstreamSnapshot();
	const live = pcdOpEntitiesQueries.listLive(databaseId);
	const changes = assembleQualityProfileScoringChanges({
		snapshot,
		live,
		opDetails: (ids) => pcdOpEntitiesQueries.listOpDetails(ids),
		current: await serializeQualityProfile(cache, profileName),
		profileName,
		edges: cache.query<EntityEdge>(ENTITY_EDGES_SQL)
	});

	// Related changes come from op history; keep only what still differs from its default.
	if (snapshot.status === 'captured') {
		const { upstreamNameOf } = resolveAliases(live);
		const differs = new Map<RelatedChange, boolean>();
		for (const change of changes.relatedChanges) {
			const upstreamName = upstreamNameOf(change.entity, change.name);
			const upstream =
				upstreamName === null
					? undefined
					: snapshot.entities.get(entityKey(change.entity, upstreamName));
			if (!upstream) continue;
			if (change.entity === 'regular_expression') {
				const row = await cache.kb
					.selectFrom('regular_expressions')
					.select('pattern')
					.where('name', '=', change.name)
					.executeTakeFirst();
				differs.set(change, row?.pattern !== (upstream as PortableRegularExpression).pattern);
			} else {
				const d = customFormatConditionDefaults({
					upstream: upstream as PortableCustomFormat,
					current: await getConditionsForEvaluation(cache, change.name),
					regexUpstreamName: (name) => upstreamNameOf('regular_expression', name),
					pendingConditions: new Set()
				});
				differs.set(change, Object.keys(d.conditions).length > 0 || d.removed.length > 0);
			}
		}
		changes.relatedChanges = remainingRelatedChanges(changes.relatedChanges, (c) => differs.get(c));
	}

	for (const entity of ['custom_format', 'regular_expression'] as const) {
		const related = changes.relatedChanges.filter((c) => c.entity === entity);
		if (related.length === 0) continue;
		const rows = await cache.kb
			.selectFrom(entity === 'custom_format' ? 'custom_formats' : 'regular_expressions')
			.select(['id', 'name'])
			.where(
				'name',
				'in',
				related.map((c) => c.name)
			)
			.execute();
		const ids = new Map(rows.map((r) => [r.name, r.id]));
		for (const change of related) change.id = ids.get(change.name) ?? null;
	}
	return changes;
}
