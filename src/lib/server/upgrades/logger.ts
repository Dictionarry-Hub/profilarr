/**
 * Structured logging for upgrade jobs
 * Uses the shared logger with source 'UpgradeJob'
 * Stores run history in the database
 */

import { logger } from '$logger/logger.ts';
import { upgradeRunsQueries } from '$db/queries/upgradeRuns.ts';
import type { UpgradeJobLog } from './types.ts';

const SOURCE = 'UpgradeJob';

/**
 * Log an upgrade run with structured data
 * Uses INFO for success, WARN for partial, ERROR for failed
 */
export async function logUpgradeRun(log: UpgradeJobLog): Promise<void> {
	const durationMs = new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime();
	const durationSec = (durationMs / 1000).toFixed(1);

	const statusLabel = log.status === 'success' ? 'completed' : log.status;
	const summary = `Upgrade ${statusLabel}: ${log.instanceName} "${log.filter.name}" - ${log.selection.actualCount}/${log.selection.requestedCount} items searched (${durationSec}s)`;

	const funnel: Record<string, number> = {
		library: log.library.totalItems,
		filtered: log.filter.matchedCount,
		afterCooldown: log.filter.afterCooldown
	};

	// Only show dry run exclusion step if any were excluded
	if (log.filter.dryRunExcluded > 0) {
		funnel.dryRunExcluded = log.filter.dryRunExcluded;
		funnel.available = log.filter.afterCooldown - log.filter.dryRunExcluded;
	}

	funnel.selected = log.selection.actualCount;

	// Format items with score comparisons
	const formattedItems = log.selection.items.map((item) => {
		const original =
			item.original.type === 'movie'
				? {
						fileName: item.original.fileName,
						formats: item.original.formats,
						score: item.original.score
					}
				: { title: item.original.title, episodes: item.original.episodes };

		return {
			title: item.title,
			original,
			upgrades: item.upgrades.map((u) => ({
				release: u.release,
				formats: u.formats,
				score: u.score
			}))
		};
	});

	const meta = {
		dryRun: log.config.dryRun,
		filter: log.filter.name,
		filterId: log.filter.id,
		selector: log.selection.method,
		funnel,
		items: formattedItems
	};

	const logOptions = { source: SOURCE, meta };

	if (log.status === 'success') {
		await logger.info(summary, logOptions);
	} else if (log.status === 'partial') {
		await logger.warn(summary, logOptions);
	} else {
		await logger.error(summary, logOptions);
	}

	// Save full structured data to database
	try {
		upgradeRunsQueries.insert(log);
	} catch (err) {
		await logger.error(`Failed to save upgrade run to database: ${err}`, {
			source: SOURCE,
			meta: { runId: log.id, error: err }
		});
	}
}

/**
 * Log when an upgrade config is skipped
 */
export async function logUpgradeSkipped(
	instanceId: number,
	instanceName: string,
	reason: string
): Promise<void> {
	await logger.debug(`Skipped ${instanceName}: ${reason}`, {
		source: SOURCE,
		meta: { instanceId, reason }
	});
}

/**
 * Log errors during upgrade processing
 */
export async function logUpgradeError(
	instanceId: number,
	instanceName: string,
	error: string
): Promise<void> {
	await logger.error(`Upgrade failed for ${instanceName}: ${error}`, {
		source: SOURCE,
		meta: { instanceId, error }
	});
}

/**
 * Log when dry run cache is cleared
 */
export async function logDryRunCacheCleared(
	instanceId: number,
	instanceName: string,
	clearedItemIds: number[]
): Promise<void> {
	const count = clearedItemIds.length;
	const message =
		count > 0
			? `Dry run cache cleared for ${instanceName}: ${count} item${count === 1 ? '' : 's'} removed`
			: `Dry run cache cleared for ${instanceName}: cache was empty`;

	await logger.info(message, {
		source: SOURCE,
		meta: { instanceId, instanceName, clearedCount: count, clearedItemIds }
	});
}
