/**
 * Sync utility functions
 * Startup recovery and re-export of shared cron utilities
 */

import { arrSyncQueries } from '$db/queries/arrSync.ts';
import { logger } from '$logger/logger.ts';

// Re-export from shared schedule utils
export { calculateNextRun } from '#lib/server/jobs/scheduleUtils.ts';

// =============================================================================
// Startup recovery
// =============================================================================

/**
 * Recover from interrupted syncs on startup
 * Any syncs that were in_progress when the server stopped are reset to pending
 * so they will be retried on the next sync cycle
 */
export async function recoverInterruptedSyncs(): Promise<void> {
	const recovered = arrSyncQueries.recoverInterruptedSyncs();

	if (recovered > 0) {
		await logger.info(`Recovered ${recovered} interrupted sync(s) from previous run`, {
			source: 'SyncRecovery',
			meta: { recoveredCount: recovered }
		});
	}
}
