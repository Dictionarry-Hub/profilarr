/**
 * Local changes for an entity page: the last build's upstream snapshot, the
 * entity's current state, and its live ops, assembled into rows. Read after a
 * build completes, so it uses the finished cache.
 */

import type { LiveOpEntityRow, OpDetails } from '$db/queries/pcdOpEntities.ts';
import type { ConditionData } from '$shared/pcd/display.ts';
import { pcdOpEntitiesQueries } from '$db/queries/pcdOpEntities.ts';
import type { PCDCache } from '$pcd/index.ts';
import type {
	PortableCustomFormat,
	PortableQualityProfile,
	PortableRegularExpression
} from '$shared/pcd/portable.ts';
import { getConditionsForEvaluation } from '../entities/customFormats/conditions/read.ts';
import { serializeQualityProfile } from '../entities/serialize.ts';
import { SNAPSHOT_TABLES, type UpstreamSnapshot } from './capture.ts';
import { ENTITY_EDGES_SQL, type EntityEdge } from './edges.ts';
import { entityKey, parseOpMetadata } from './opEntities.ts';
import {
	qualityProfileScoringChanges,
	type ScoringChanges,
	type ScoringOp
} from './qualityProfileScoring.ts';
import { relatedChanges, remainingRelatedChanges, type RelatedChange } from './relatedChanges.ts';
import { resolveAliases, type AliasResolution } from './touched.ts';

export interface QualityProfileScoringLocalChanges extends ScoringChanges {
	/** none: no local changes anywhere. unavailable: rows are empty; unavailableReason says why. */
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

/** Nothing to compare against: no snapshot, or not this profile's. */
function nothingToShow(
	snapshot: UpstreamSnapshot['status'],
	unavailableReason: QualityProfileScoringLocalChanges['unavailableReason']
): QualityProfileScoringLocalChanges {
	return { snapshot, unavailableReason, relatedChanges: [], status: 'unchanged', rows: [] };
}

const uncaptured = (status: UpstreamSnapshot['status']) =>
	nothingToShow(status, status === 'unavailable' ? 'database' : null);

export function assembleQualityProfileScoringChanges(input: {
	snapshot: UpstreamSnapshot;
	live: LiveOpEntityRow[];
	opDetails: (opIds: number[]) => OpDetails[];
	current: PortableQualityProfile;
	profileName: string;
	/** Edges of the finished cache. */
	edges: EntityEdge[];
	/** Name resolution over `live`; resolved here when the caller hasn't already. */
	aliases?: AliasResolution;
	exists?: (entity: RelatedChange['entity'], name: string) => boolean;
}): QualityProfileScoringLocalChanges {
	const { snapshot, live, current, profileName } = input;
	if (snapshot.status !== 'captured') return uncaptured(snapshot.status);
	const { upstreamNameOf, rowUpstreamName, upstreamNameBefore } =
		input.aliases ?? resolveAliases(live);
	const upstreamName = upstreamNameOf('quality_profile', profileName);
	// Its upstream failed to serialize: without it, every row would be a guess.
	if (snapshot.failures.some((f) => f.entity === 'quality_profile' && f.name === upstreamName)) {
		return nothingToShow('unavailable', 'profile');
	}
	const upstreamProfile =
		upstreamName === null
			? null
			: (snapshot.entities.get(entityKey('quality_profile', upstreamName)) as
					PortableQualityProfile | null | undefined);
	const defaultScored = [
		...new Set((upstreamProfile?.customFormatScores ?? []).map((s) => s.customFormatName))
	];
	const related = relatedChanges({
		profileName,
		edges: input.edges,
		live,
		upstreamNameOf,
		rowUpstreamName,
		opDetails: input.opDetails,
		defaultScored,
		exists: input.exists
	});

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

	// Without defaults to compare against, its ops have nothing to explain.
	const ops: ScoringOp[] = upstreamProfile
		? input.opDetails([...opIds]).map((d) => {
				const { changedFields, generated } = parseOpMetadata(d.metadata);
				return {
					opId: d.opId,
					changedFields,
					generated,
					desiredState: parseJson(d.desiredState),
					status: d.status,
					replacesOpId: d.replacesOpId
				};
			})
		: [];

	return {
		snapshot: snapshot.status,
		unavailableReason: null,
		relatedChanges: related,
		...qualityProfileScoringChanges({
			upstream: upstreamProfile,
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
	if (snapshot.status !== 'captured') return uncaptured(snapshot.status);
	// One request context: names resolve once, and each op is read at most once.
	const live = pcdOpEntitiesQueries.listLive(databaseId);
	const aliases = resolveAliases(live);
	const opDetailsRead = new Map<number, OpDetails>();
	const opDetails = (ids: number[]) => {
		const missing = ids.filter((id) => !opDetailsRead.has(id));
		for (const d of pcdOpEntitiesQueries.listOpDetails(missing)) opDetailsRead.set(d.opId, d);
		return ids.flatMap((id) => opDetailsRead.get(id) ?? []);
	};
	const changes = assembleQualityProfileScoringChanges({
		snapshot,
		live,
		opDetails,
		current: await serializeQualityProfile(cache, profileName),
		profileName,
		edges: cache.query<EntityEdge>(ENTITY_EDGES_SQL),
		aliases,
		exists: (entity, name) =>
			cache.queryOne(`SELECT 1 FROM ${SNAPSHOT_TABLES[entity]} WHERE name = ? LIMIT 1`, name) !==
			undefined
	});

	// Related changes come from op history; keep only what still differs from its default.
	if (changes.relatedChanges.length > 0) {
		const { upstreamNameOf } = aliases;
		const named = (entity: RelatedChange['entity']) =>
			changes.relatedChanges
				.filter((c) => c.entity === entity && !c.changed.includes('deleted'))
				.map((c) => c.name);
		const regexNames = named('regular_expression');
		const patterns =
			regexNames.length === 0
				? []
				: await cache.kb
						.selectFrom('regular_expressions')
						.select(['name', 'pattern'])
						.where('name', 'in', regexNames)
						.execute();
		const currentConditions = new Map<string, ConditionData[]>();
		for (const name of named('custom_format')) {
			currentConditions.set(name, await getConditionsForEvaluation(cache, name));
		}
		changes.relatedChanges = remainingRelatedChanges({
			changes: changes.relatedChanges,
			defaultOf: (change) => {
				// A vacated name taken again belongs to an entity created locally.
				const upstreamName = upstreamNameOf(change.entity, change.name);
				if (upstreamName === null) return null;
				return snapshot.entities.get(entityKey(change.entity, upstreamName)) as
					PortableCustomFormat | PortableRegularExpression | null | undefined;
			},
			currentPatterns: new Map(patterns.map((p) => [p.name, p.pattern])),
			currentConditions,
			regexUpstreamName: (name) => upstreamNameOf('regular_expression', name)
		});
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
