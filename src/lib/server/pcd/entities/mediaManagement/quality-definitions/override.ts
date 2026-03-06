import { getCache } from '$pcd/index.ts';
import type { PCDCache, WriteResult } from '$pcd/index.ts';
import type { QualityDefinitionEntry } from '$shared/pcd/display.ts';
import { getRadarrByName, getSonarrByName } from './read.ts';
import { updateRadarrQualityDefinitions, updateSonarrQualityDefinitions } from './update.ts';
import type { StoredOpMetadata, StoredDesiredState } from '$pcd/conflicts/overrideUtils.ts';
import { getDesiredTo, followRenameChain } from '$pcd/conflicts/overrideUtils.ts';

type QdTable = 'radarr_quality_definitions' | 'sonarr_quality_definitions';

async function resolveName(
	cache: PCDCache,
	databaseId: number,
	table: QdTable,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<string | null> {
	const candidates = [
		metadata?.stable_key?.value,
		metadata?.name,
		getDesiredTo<string>(desiredState?.name),
		typeof desiredState?.name === 'string' ? (desiredState.name as string) : null
	].filter((v): v is string => typeof v === 'string' && v.length > 0);

	if (candidates.length === 0) return null;

	for (const name of candidates) {
		const row = await cache.kb
			.selectFrom(table)
			.select('name')
			.where('name', '=', name)
			.executeTakeFirst();
		if (row) return row.name;
	}

	const entityType =
		table === 'radarr_quality_definitions'
			? 'radarr_quality_definitions'
			: 'sonarr_quality_definitions';
	const resolved = followRenameChain(databaseId, entityType, candidates[0]);
	if (resolved !== candidates[0]) {
		const row = await cache.kb
			.selectFrom(table)
			.select('name')
			.where('name', '=', resolved)
			.executeTakeFirst();
		if (row) return row.name;
	}

	return null;
}

function resolveEntries(desiredState: StoredDesiredState): QualityDefinitionEntry[] | null {
	const field = desiredState.entries;
	if (!field) return null;

	// { from, to } diff — take the "to" side
	if (typeof field === 'object' && 'to' in (field as Record<string, unknown>)) {
		const to = (field as { to: unknown }).to;
		if (Array.isArray(to)) return to as QualityDefinitionEntry[];
	}

	// Flat array
	if (Array.isArray(field)) return field as QualityDefinitionEntry[];

	return null;
}

function entriesEqual(a: QualityDefinitionEntry[], b: QualityDefinitionEntry[]): boolean {
	const normalize = (entries: QualityDefinitionEntry[]) =>
		entries
			.map((e) => ({
				quality_name: e.quality_name,
				min_size: e.min_size,
				max_size: e.max_size,
				preferred_size: e.preferred_size
			}))
			.sort((x, y) => x.quality_name.localeCompare(y.quality_name));

	return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

async function overrideRadarr(
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<WriteResult> {
	if (!desiredState) {
		return {
			success: false,
			error: 'Missing desired state for radarr quality definitions override'
		};
	}

	const cache = getCache(databaseId);
	if (!cache) {
		return { success: false, error: 'Cache not available' };
	}

	const name = await resolveName(
		cache,
		databaseId,
		'radarr_quality_definitions',
		metadata,
		desiredState
	);
	if (!name) {
		return { success: false, error: 'Radarr quality definitions not found for override' };
	}

	const current = await getRadarrByName(cache, name);
	if (!current) {
		return { success: false, error: 'Radarr quality definitions not found for override' };
	}

	const desiredName =
		getDesiredTo<string>(desiredState.name) ??
		(typeof desiredState.name === 'string' ? (desiredState.name as string) : current.name);
	const desiredEntries = resolveEntries(desiredState) ?? current.entries;

	if (current.name === desiredName && entriesEqual(current.entries, desiredEntries)) {
		return { success: true };
	}

	return updateRadarrQualityDefinitions({
		databaseId,
		cache,
		layer: 'user',
		current,
		input: {
			name: desiredName,
			entries: desiredEntries
		}
	});
}

async function overrideSonarr(
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<WriteResult> {
	if (!desiredState) {
		return {
			success: false,
			error: 'Missing desired state for sonarr quality definitions override'
		};
	}

	const cache = getCache(databaseId);
	if (!cache) {
		return { success: false, error: 'Cache not available' };
	}

	const name = await resolveName(
		cache,
		databaseId,
		'sonarr_quality_definitions',
		metadata,
		desiredState
	);
	if (!name) {
		return { success: false, error: 'Sonarr quality definitions not found for override' };
	}

	const current = await getSonarrByName(cache, name);
	if (!current) {
		return { success: false, error: 'Sonarr quality definitions not found for override' };
	}

	const desiredName =
		getDesiredTo<string>(desiredState.name) ??
		(typeof desiredState.name === 'string' ? (desiredState.name as string) : current.name);
	const desiredEntries = resolveEntries(desiredState) ?? current.entries;

	if (current.name === desiredName && entriesEqual(current.entries, desiredEntries)) {
		return { success: true };
	}

	return updateSonarrQualityDefinitions({
		databaseId,
		cache,
		layer: 'user',
		current,
		input: {
			name: desiredName,
			entries: desiredEntries
		}
	});
}

export function overrideCreate(
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<WriteResult> {
	return metadata?.entity === 'sonarr_quality_definitions'
		? overrideSonarr(databaseId, metadata, desiredState)
		: overrideRadarr(databaseId, metadata, desiredState);
}

export function overrideUpdate(
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<WriteResult> {
	return metadata?.entity === 'sonarr_quality_definitions'
		? overrideSonarr(databaseId, metadata, desiredState)
		: overrideRadarr(databaseId, metadata, desiredState);
}
