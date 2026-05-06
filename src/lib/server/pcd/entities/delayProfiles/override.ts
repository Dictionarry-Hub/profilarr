import { getCache } from '$pcd/index.ts';
import type { PCDCache, WriteResult } from '$pcd/index.ts';
import type { PreferredProtocol } from '$shared/pcd/display.ts';
import { get as getDelayProfile } from './read.ts';
import { update } from './update.ts';
import type { StoredOpMetadata, StoredDesiredState } from '$pcd/conflicts/overrideUtils.ts';
import { getDesiredTo, followRenameChain, valuesEqual } from '$pcd/conflicts/overrideUtils.ts';

async function resolveProfileName(
	cache: PCDCache,
	databaseId: number,
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
			.selectFrom('delay_profiles')
			.select('name')
			.where('name', '=', name)
			.executeTakeFirst();
		if (row) return row.name;
	}

	const resolved = followRenameChain(databaseId, 'delay_profile', candidates[0]);
	if (resolved !== candidates[0]) {
		const row = await cache.kb
			.selectFrom('delay_profiles')
			.select('name')
			.where('name', '=', resolved)
			.executeTakeFirst();
		if (row) return row.name;
	}

	return null;
}

function resolveNumber(value: unknown, fallback: number | null): number {
	const resolved = getDesiredTo<number>(value);
	if (typeof resolved === 'number') return resolved;
	if (typeof value === 'number') return value;
	return fallback ?? 0;
}

function resolveNullableNumber(value: unknown, fallback: number | null): number | null {
	const resolved = getDesiredTo<number | null>(value);
	if (resolved !== undefined) return resolved;
	if (typeof value === 'number' || value === null) return value as number | null;
	return fallback;
}

function resolveBoolean(value: unknown, fallback: boolean): boolean {
	const resolved = getDesiredTo<boolean>(value);
	if (typeof resolved === 'boolean') return resolved;
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value === 1;
	return fallback;
}

function resolveProtocol(value: unknown, fallback: PreferredProtocol): PreferredProtocol {
	const resolved = getDesiredTo<string>(value);
	if (typeof resolved === 'string') return resolved as PreferredProtocol;
	if (typeof value === 'string') return value as PreferredProtocol;
	return fallback;
}

async function overrideDelay(
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<WriteResult> {
	if (!desiredState) {
		return { success: false, error: 'Missing desired state for delay profile override' };
	}

	const cache = getCache(databaseId);
	if (!cache) {
		return { success: false, error: 'Cache not available' };
	}

	const profileName = await resolveProfileName(cache, databaseId, metadata, desiredState);
	if (!profileName) {
		return { success: false, error: 'Delay profile not found for override' };
	}

	const profileRow = await cache.kb
		.selectFrom('delay_profiles')
		.select('id')
		.where('name', '=', profileName)
		.executeTakeFirst();
	if (!profileRow) {
		return { success: false, error: 'Delay profile not found for override' };
	}

	const current = await getDelayProfile(cache, profileRow.id);
	if (!current) {
		return { success: false, error: 'Delay profile not found for override' };
	}

	const desiredName =
		getDesiredTo<string>(desiredState.name) ??
		(typeof desiredState.name === 'string' ? (desiredState.name as string) : current.name);
	const desiredProtocol = resolveProtocol(
		desiredState.preferred_protocol,
		current.preferred_protocol
	);
	const desiredUsenetDelay = resolveNumber(desiredState.usenet_delay, current.usenet_delay);
	const desiredTorrentDelay = resolveNumber(desiredState.torrent_delay, current.torrent_delay);
	const desiredBypassHighest = resolveBoolean(
		desiredState.bypass_if_highest_quality,
		current.bypass_if_highest_quality
	);
	const desiredBypassCf = resolveBoolean(
		desiredState.bypass_if_above_custom_format_score,
		current.bypass_if_above_custom_format_score
	);
	const desiredMinCfScore = resolveNullableNumber(
		desiredState.minimum_custom_format_score,
		current.minimum_custom_format_score
	);

	const matches =
		current.name === desiredName &&
		current.preferred_protocol === desiredProtocol &&
		valuesEqual(current.usenet_delay, desiredUsenetDelay) &&
		valuesEqual(current.torrent_delay, desiredTorrentDelay) &&
		valuesEqual(current.bypass_if_highest_quality, desiredBypassHighest) &&
		valuesEqual(current.bypass_if_above_custom_format_score, desiredBypassCf) &&
		valuesEqual(current.minimum_custom_format_score, desiredMinCfScore);

	if (matches) {
		return { success: true };
	}

	return update({
		databaseId,
		cache,
		layer: 'user',
		current,
		input: {
			name: desiredName,
			preferredProtocol: desiredProtocol,
			usenetDelay: desiredUsenetDelay,
			torrentDelay: desiredTorrentDelay,
			bypassIfHighestQuality: desiredBypassHighest,
			bypassIfAboveCfScore: desiredBypassCf,
			minimumCfScore: desiredMinCfScore ?? 0
		}
	});
}

export { overrideDelay as overrideCreate, overrideDelay as overrideUpdate };
