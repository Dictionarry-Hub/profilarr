import type { PCDCache } from '#pcd/index.ts';
import type { StoredOpMetadata, StoredDesiredState } from '#pcd/conflicts/overrideUtils.ts';
import { getDesiredTo, followRenameChain } from '#pcd/conflicts/overrideUtils.ts';

/**
 * Resolve the quality profile name from op metadata / desired_state.
 * Falls back to rename chain if the name doesn't exist in the cache.
 */
export async function resolveProfileName(
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
			.selectFrom('quality_profiles')
			.select('name')
			.where('name', '=', name)
			.executeTakeFirst();
		if (row) return row.name;
	}

	const resolved = followRenameChain(databaseId, 'quality_profile', candidates[0]);
	if (resolved !== candidates[0]) {
		const row = await cache.kb
			.selectFrom('quality_profiles')
			.select('name')
			.where('name', '=', resolved)
			.executeTakeFirst();
		if (row) return row.name;
	}

	return null;
}
