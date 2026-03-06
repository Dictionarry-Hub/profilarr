import { getCache } from '$pcd/index.ts';
import type { PCDCache, WriteResult } from '$pcd/index.ts';
import type { RadarrMediaSettingsRow } from '$shared/pcd/display.ts';
import { getRadarrByName, getSonarrByName } from './read.ts';
import { updateRadarrMediaSettings, updateSonarrMediaSettings } from './update.ts';
import type { StoredOpMetadata, StoredDesiredState } from '$pcd/conflicts/overrideUtils.ts';
import { getDesiredTo, followRenameChain, valuesEqual } from '$pcd/conflicts/overrideUtils.ts';

type SettingsTable = 'radarr_media_settings' | 'sonarr_media_settings';

async function resolveName(
	cache: PCDCache,
	databaseId: number,
	table: SettingsTable,
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
		if (row) return row.name!;
	}

	const entityType =
		table === 'radarr_media_settings' ? 'radarr_media_settings' : 'sonarr_media_settings';
	const resolved = followRenameChain(databaseId, entityType, candidates[0]);
	if (resolved !== candidates[0]) {
		const row = await cache.kb
			.selectFrom(table)
			.select('name')
			.where('name', '=', resolved)
			.executeTakeFirst();
		if (row) return row.name!;
	}

	return null;
}

function resolveString(value: unknown, fallback: string): string {
	const resolved = getDesiredTo<string>(value);
	if (typeof resolved === 'string') return resolved;
	if (typeof value === 'string') return value;
	return fallback;
}

function resolveBoolean(value: unknown, fallback: boolean): boolean {
	const resolved = getDesiredTo<boolean>(value);
	if (typeof resolved === 'boolean') return resolved;
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value === 1;
	return fallback;
}

// Both radarr and sonarr share the same fields, so one function handles both.
// The only difference is which table/read/update function to use.

async function overrideRadarr(
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<WriteResult> {
	if (!desiredState) {
		return { success: false, error: 'Missing desired state for radarr media settings override' };
	}

	const cache = getCache(databaseId);
	if (!cache) {
		return { success: false, error: 'Cache not available' };
	}

	const name = await resolveName(
		cache,
		databaseId,
		'radarr_media_settings',
		metadata,
		desiredState
	);
	if (!name) {
		return { success: false, error: 'Radarr media settings not found for override' };
	}

	const current = await getRadarrByName(cache, name);
	if (!current) {
		return { success: false, error: 'Radarr media settings not found for override' };
	}

	const desiredName = resolveString(desiredState.name, current.name);
	const desiredPropersRepacks = resolveString(
		desiredState.propers_repacks,
		current.propers_repacks
	) as RadarrMediaSettingsRow['propers_repacks'];
	const desiredEnableMediaInfo = resolveBoolean(
		desiredState.enable_media_info,
		current.enable_media_info
	);

	const matches =
		current.name === desiredName &&
		current.propers_repacks === desiredPropersRepacks &&
		valuesEqual(current.enable_media_info, desiredEnableMediaInfo);

	if (matches) {
		return { success: true };
	}

	return updateRadarrMediaSettings({
		databaseId,
		cache,
		layer: 'user',
		current,
		input: {
			name: desiredName,
			propersRepacks: desiredPropersRepacks,
			enableMediaInfo: desiredEnableMediaInfo
		}
	});
}

async function overrideSonarr(
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<WriteResult> {
	if (!desiredState) {
		return { success: false, error: 'Missing desired state for sonarr media settings override' };
	}

	const cache = getCache(databaseId);
	if (!cache) {
		return { success: false, error: 'Cache not available' };
	}

	const name = await resolveName(
		cache,
		databaseId,
		'sonarr_media_settings',
		metadata,
		desiredState
	);
	if (!name) {
		return { success: false, error: 'Sonarr media settings not found for override' };
	}

	const current = await getSonarrByName(cache, name);
	if (!current) {
		return { success: false, error: 'Sonarr media settings not found for override' };
	}

	const desiredName = resolveString(desiredState.name, current.name);
	const desiredPropersRepacks = resolveString(
		desiredState.propers_repacks,
		current.propers_repacks
	) as RadarrMediaSettingsRow['propers_repacks'];
	const desiredEnableMediaInfo = resolveBoolean(
		desiredState.enable_media_info,
		current.enable_media_info
	);

	const matches =
		current.name === desiredName &&
		current.propers_repacks === desiredPropersRepacks &&
		valuesEqual(current.enable_media_info, desiredEnableMediaInfo);

	if (matches) {
		return { success: true };
	}

	return updateSonarrMediaSettings({
		databaseId,
		cache,
		layer: 'user',
		current,
		input: {
			name: desiredName,
			propersRepacks: desiredPropersRepacks,
			enableMediaInfo: desiredEnableMediaInfo
		}
	});
}

export function overrideCreate(
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<WriteResult> {
	return metadata?.entity === 'sonarr_media_settings'
		? overrideSonarr(databaseId, metadata, desiredState)
		: overrideRadarr(databaseId, metadata, desiredState);
}

export function overrideUpdate(
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<WriteResult> {
	return metadata?.entity === 'sonarr_media_settings'
		? overrideSonarr(databaseId, metadata, desiredState)
		: overrideRadarr(databaseId, metadata, desiredState);
}
