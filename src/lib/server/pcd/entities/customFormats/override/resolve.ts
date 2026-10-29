import type { PCDCache } from '#pcd/index.ts';
import type { StoredOpMetadata, StoredDesiredState } from '#pcd/conflicts/overrideUtils.ts';
import { getDesiredTo, followRenameChain } from '#pcd/conflicts/overrideUtils.ts';

/**
 * Resolve the custom format name from op metadata / desired_state.
 * If the name doesn't exist in the cache, follows the rename chain
 * through published base ops to find the current name.
 */
export async function resolveFormatName(
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

	// Try each candidate directly
	for (const name of candidates) {
		const row = await cache.kb
			.selectFrom('custom_formats')
			.select('name')
			.where('name', '=', name)
			.executeTakeFirst();
		if (row) return row.name;
	}

	// Name not found — follow rename chain from the first candidate
	const resolved = followRenameChain(databaseId, 'custom_format', candidates[0]);
	if (resolved !== candidates[0]) {
		const row = await cache.kb
			.selectFrom('custom_formats')
			.select('name')
			.where('name', '=', resolved)
			.executeTakeFirst();
		if (row) return row.name;
	}

	return null;
}
