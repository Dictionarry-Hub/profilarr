/**
 * PCD Database Compiler
 * Handles compiling and invalidating PCD caches
 */

import { PCDCache } from './cache.ts';
import { setCache, getCache, deleteCache, getCachedDatabaseIds } from './registry.ts';
import type { CacheBuildStats } from '../core/types.ts';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { pcdOpHistoryQueries } from '$db/queries/pcdOpHistory.ts';
import { logger } from '$logger/logger.ts';

const AUTO_OVERRIDE_MAX_ROUNDS = 10;
const autoOverrideLocks = new Set<number>();

function listPublishedUserConflicts(databaseInstanceId: number): number[] {
	const latestConflicts = pcdOpHistoryQueries.listLatestConflictsByDatabase(databaseInstanceId);
	const opIds: number[] = [];

	for (const conflict of latestConflicts) {
		if (conflict.history.status !== 'conflicted') continue;
		if (conflict.op.origin !== 'user') continue;
		if (conflict.op.state !== 'published') continue;
		opIds.push(conflict.op.id);
	}

	return opIds.sort((a, b) => a - b);
}

async function autoResolveOverrideConflicts(databaseInstanceId: number): Promise<void> {
	const instance = databaseInstancesQueries.getById(databaseInstanceId);
	if (!instance?.enabled) return;
	if (instance.conflict_strategy !== 'override') return;
	if (autoOverrideLocks.has(databaseInstanceId)) return;

	const initialConflicts = listPublishedUserConflicts(databaseInstanceId);
	if (initialConflicts.length === 0) return;

	autoOverrideLocks.add(databaseInstanceId);

	try {
		const { overrideConflict } = await import('$pcd/conflicts/override.ts');

		await logger.info('Starting automatic override conflict resolution', {
			source: 'PCDCompiler',
			meta: {
				databaseInstanceId,
				conflictCount: initialConflicts.length
			}
		});

		for (let round = 1; round <= AUTO_OVERRIDE_MAX_ROUNDS; round++) {
			const conflicts = listPublishedUserConflicts(databaseInstanceId);
			if (conflicts.length === 0) {
				await logger.info('Finished automatic override conflict resolution', {
					source: 'PCDCompiler',
					meta: {
						databaseInstanceId,
						rounds: round - 1
					}
				});
				return;
			}

			let resolvedThisRound = 0;
			for (const opId of conflicts) {
				const result = await overrideConflict({ databaseId: databaseInstanceId, opId });
				if (result.success) {
					resolvedThisRound++;
					continue;
				}

				await logger.warn('Automatic override failed for conflict op', {
					source: 'PCDCompiler',
					meta: {
						databaseInstanceId,
						opId,
						error: result.error
					}
				});
			}

			if (resolvedThisRound === 0) {
				await logger.warn(
					'Automatic override made no progress; leaving conflicts for manual resolution',
					{
						source: 'PCDCompiler',
						meta: {
							databaseInstanceId,
							round,
							remainingConflicts: conflicts.length
						}
					}
				);
				return;
			}
		}

		const remaining = listPublishedUserConflicts(databaseInstanceId).length;
		if (remaining > 0) {
			await logger.warn('Automatic override reached round limit', {
				source: 'PCDCompiler',
				meta: {
					databaseInstanceId,
					maxRounds: AUTO_OVERRIDE_MAX_ROUNDS,
					remainingConflicts: remaining
				}
			});
		}
	} finally {
		autoOverrideLocks.delete(databaseInstanceId);
	}
}

/**
 * Compile a PCD into an in-memory cache
 * Returns build stats for logging
 */
export async function compile(
	pcdPath: string,
	databaseInstanceId: number
): Promise<CacheBuildStats> {
	// Build the new cache first so we don't leave a window with no usable cache.
	const existing = getCache(databaseInstanceId);
	let cache = new PCDCache(pcdPath, databaseInstanceId);
	let stats = await cache.build();

	// If a partial-application op was force-dropped during build, the in-memory
	// DB has stale changes. Rebuild to get a clean state without the dropped op.
	if (stats.needsRebuild) {
		cache.close();
		cache = new PCDCache(pcdPath, databaseInstanceId);
		stats = await cache.build();
	}

	// Swap the cache in the registry, then close the old one.
	setCache(databaseInstanceId, cache);
	if (existing && existing !== cache) {
		existing.close();
	}

	// Strategy-driven resolution runs after the cache is successfully swapped in.
	// The lock prevents recursive resolution when compile() is called from within
	// override handlers.
	if (!autoOverrideLocks.has(databaseInstanceId)) {
		await autoResolveOverrideConflicts(databaseInstanceId);
	}

	return stats;
}

/**
 * Invalidate a cache (close and remove from registry)
 */
export function invalidate(databaseInstanceId: number): void {
	const cache = getCache(databaseInstanceId);
	if (cache) {
		cache.close();
		deleteCache(databaseInstanceId);
	}
}

/**
 * Invalidate all caches
 */
export function invalidateAll(): void {
	const ids = getCachedDatabaseIds();
	for (const id of ids) {
		invalidate(id);
	}
}
