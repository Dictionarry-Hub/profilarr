/**
 * Local changes for an entity page: the last build's upstream snapshot, the
 * entity's current state, and its live ops, assembled into rows. Read after a
 * build completes, so it uses the finished cache.
 */

import type { LiveOpEntityRow, OpDetails } from '$db/queries/pcdOpEntities.ts';
import { pcdOpEntitiesQueries } from '$db/queries/pcdOpEntities.ts';
import type { PCDCache } from '$pcd/index.ts';
import type { PortableQualityProfile } from '$shared/pcd/portable.ts';
import { serializeQualityProfile } from '../entities/serialize.ts';
import type { UpstreamSnapshot } from './capture.ts';
import { entityKey } from './opEntities.ts';
import {
	qualityProfileScoringChanges,
	type ScoringChanges,
	type ScoringOp
} from './qualityProfileScoring.ts';
import { resolveAliases } from './touched.ts';

export interface QualityProfileScoringLocalChanges extends ScoringChanges {
	/** none: no local changes anywhere. unavailable: capture failed for this profile; rows are empty. */
	snapshot: UpstreamSnapshot['status'];
	/** null: no upstream identity (created locally under a renamed-away name). */
	upstreamName: string | null;
	/** Current name -> upstream name, for local renames of custom formats upstream has. */
	customFormatRenames: Record<string, string>;
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

function customFormatRenames(
	snapshot: UpstreamSnapshot,
	live: LiveOpEntityRow[],
	upstreamNameOf: (entity: string, name: string) => string | null
): Record<string, string> {
	const renames: Record<string, string> = {};
	for (const row of live) {
		if (row.role !== 'target' || row.entity !== 'custom_format' || !row.previousName) continue;
		// Intermediate names resolve to null; a rename back resolves to itself.
		const upstream = upstreamNameOf('custom_format', row.name);
		if (upstream === null || upstream === row.name) continue;
		// Created locally, then renamed: its earliest name was never upstream.
		if (!snapshot.entities.get(entityKey('custom_format', upstream))) continue;
		renames[row.name] = upstream;
	}
	return renames;
}

export function assembleQualityProfileScoringChanges(input: {
	snapshot: UpstreamSnapshot;
	live: LiveOpEntityRow[];
	opDetails: (opIds: number[]) => OpDetails[];
	current: PortableQualityProfile | null;
	profileName: string;
}): QualityProfileScoringLocalChanges {
	const { snapshot, live, current, profileName } = input;
	const { upstreamNameOf, rowUpstreamName } = resolveAliases(live);
	const upstreamName = upstreamNameOf('quality_profile', profileName);

	if (snapshot.status !== 'captured') {
		return {
			snapshot: snapshot.status,
			upstreamName,
			customFormatRenames: {},
			status: 'unchanged',
			rows: []
		};
	}
	const renames = customFormatRenames(snapshot, live, upstreamNameOf);
	// Its upstream failed to serialize: without it, every row would be a guess.
	const failed = snapshot.failures.some(
		(f) => f.entity === 'quality_profile' && f.name === upstreamName
	);
	if (failed) {
		return {
			snapshot: 'unavailable',
			upstreamName,
			customFormatRenames: renames,
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
		upstreamName,
		customFormatRenames: renames,
		...qualityProfileScoringChanges({
			upstream,
			current,
			cfUpstreamNameOf: (name) => upstreamNameOf('custom_format', name),
			ops
		})
	};
}

export async function qualityProfileScoringLocalChanges(
	cache: PCDCache,
	databaseId: number,
	profileName: string
): Promise<QualityProfileScoringLocalChanges> {
	// Serializers throw on a missing entity; only that case means "deleted".
	const exists = await cache.kb
		.selectFrom('quality_profiles')
		.select('name')
		.where('name', '=', profileName)
		.executeTakeFirst();

	return assembleQualityProfileScoringChanges({
		snapshot: cache.getUpstreamSnapshot(),
		live: pcdOpEntitiesQueries.listLive(databaseId),
		opDetails: (ids) => pcdOpEntitiesQueries.listOpDetails(ids),
		current: exists ? await serializeQualityProfile(cache, profileName) : null,
		profileName
	});
}
