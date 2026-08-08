/**
 * Config cleanup: delete CFs and QPs from an Arr instance
 * that are not in the current sync selections.
 *
 * Compares what's on the Arr instance against what should be there.
 * Anything not in the expected set is stale.
 *
 * QPs assigned to media will be skipped (arr returns HTTP 500).
 */

import type { BaseArrClient } from '$utils/arr/base.ts';
import { arrSyncQueries } from '$db/queries/arrSync.ts';
import { getCache } from '$pcd/index.ts';
import { getCustomFormatsForProfile } from '$pcd/references.ts';
import type { SyncArrType } from './mappings.ts';
import { HttpError } from '$http/types.ts';
import { logger } from '$logger/logger.ts';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';

const SOURCE = 'Cleanup';

export interface StaleItem {
	id: number;
	name: string;
}

export interface CleanupScanResult {
	staleCustomFormats: StaleItem[];
	staleQualityProfiles: StaleItem[];
}

export interface CleanupDeleteResult {
	deletedCustomFormats: StaleItem[];
	deletedQualityProfiles: StaleItem[];
	skippedQualityProfiles: { item: StaleItem; reason: string }[];
}

/**
 * Scan an Arr instance for stale configs.
 * Stale = exists on Arr but not in the current sync selections.
 */
export async function scanForStaleItems(
	client: BaseArrClient,
	instanceId: number
): Promise<CleanupScanResult> {
	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) throw new Error(`Instance ${instanceId} not found`);
	const arrType = instance.type as SyncArrType;

	// 1. Build expected QP and CF names from current sync selections
	const { selections } = arrSyncQueries.getQualityProfilesSync(instanceId);
	const expectedQPNames = new Set(selections.map((s) => s.profileName));
	const expectedCFNames = new Set<string>();

	for (const sel of selections) {
		const cache = getCache(sel.databaseId);
		if (!cache) {
			throw new Error(`PCD cache not found for database ${sel.databaseId}`);
		}

		const cfNames = await getCustomFormatsForProfile(cache, sel.profileName, arrType);
		for (const name of cfNames) {
			expectedCFNames.add(name);
		}
	}

	// 2. Get everything currently on the Arr instance
	const [arrCFs, arrQPs] = await Promise.all([
		client.getCustomFormats(),
		client.getQualityProfiles()
	]);

	// 3. Stale = on Arr but not in expected set
	const staleCustomFormats: StaleItem[] = arrCFs
		.filter((cf) => !expectedCFNames.has(cf.name))
		.map((cf) => ({ id: cf.id!, name: cf.name }));

	const staleQualityProfiles: StaleItem[] = arrQPs
		.filter((qp) => !expectedQPNames.has(qp.name))
		.map((qp) => ({ id: qp.id, name: qp.name }));

	await logger.debug('Scan complete', {
		source: SOURCE,
		meta: {
			instanceId,
			expectedQPs: [...expectedQPNames],
			expectedCFs: expectedCFNames.size,
			arrCFs: arrCFs.length,
			arrQPs: arrQPs.length,
			staleCFs: staleCustomFormats.length,
			staleQPs: staleQualityProfiles.length
		}
	});

	return { staleCustomFormats, staleQualityProfiles };
}

/**
 * Delete stale items from an Arr instance. Deletes CFs first, then QPs.
 * QPs assigned to media (HTTP 500) are skipped with a warning.
 */
export async function deleteStaleItems(
	client: BaseArrClient,
	scanResult: CleanupScanResult
): Promise<CleanupDeleteResult> {
	const deletedCustomFormats: StaleItem[] = [];
	const deletedQualityProfiles: StaleItem[] = [];
	const skippedQualityProfiles: { item: StaleItem; reason: string }[] = [];

	// Delete CFs first
	for (const cf of scanResult.staleCustomFormats) {
		try {
			await client.deleteCustomFormat(cf.id);
			deletedCustomFormats.push(cf);
		} catch (err) {
			await logger.warn(`Failed to delete CF "${cf.name}" (id=${cf.id})`, {
				source: SOURCE,
				meta: { error: err instanceof Error ? err.message : String(err) }
			});
		}
	}

	// Then delete QPs
	for (const qp of scanResult.staleQualityProfiles) {
		try {
			await client.deleteQualityProfile(qp.id);
			deletedQualityProfiles.push(qp);
		} catch (err) {
			const reason =
				err instanceof HttpError && err.status === 500
					? 'Profile is assigned to media'
					: err instanceof Error
						? err.message
						: String(err);
			skippedQualityProfiles.push({ item: qp, reason });
		}
	}

	return { deletedCustomFormats, deletedQualityProfiles, skippedQualityProfiles };
}
