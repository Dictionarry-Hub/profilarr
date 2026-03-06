import { jobQueueRegistry } from '../queueRegistry.ts';
import type { JobHandler } from '../queueTypes.ts';
import { upgradeConfigsQueries } from '$db/queries/upgradeConfigs.ts';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import type { FilterConfig } from '$shared/upgrades/filters.ts';
import { processUpgradeConfig } from '$lib/server/upgrades/processor.ts';
import { calculateNextRun } from '../scheduleUtils.ts';
import { logger } from '$logger/logger.ts';

const upgradeRunHandler: JobHandler = async (job) => {
	const instanceId = Number(job.payload.instanceId);
	if (!Number.isFinite(instanceId)) {
		return { status: 'failure', error: 'Invalid instance ID' };
	}

	const config = upgradeConfigsQueries.getByArrInstanceId(instanceId);
	if (!config || !config.enabled) {
		return { status: 'cancelled', output: 'Upgrade config disabled' };
	}

	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) {
		return { status: 'failure', error: 'Arr instance not found' };
	}

	const dryRun = Boolean(job.payload.dryRun);

	const enabledFilters = config.filters.filter((f: FilterConfig) => f.enabled);
	if (enabledFilters.length === 0) {
		const nextRunAt = calculateNextRun(config.cron);
		if (nextRunAt) upgradeConfigsQueries.updateNextRunAt(config.arrInstanceId, nextRunAt);
		return {
			status: 'skipped',
			output: 'No enabled upgrade filters',
			rescheduleAt: job.source === 'schedule' ? (nextRunAt ?? undefined) : undefined
		};
	}

	try {
		const log = await processUpgradeConfig(config, instance, job.source === 'manual', dryRun);

		// Update filter index for round-robin mode after successful processing
		if (log.status !== 'failed' && config.filterMode === 'round_robin') {
			upgradeConfigsQueries.incrementFilterIndex(config.arrInstanceId);
		}

		// Update last run timestamp
		upgradeConfigsQueries.updateLastRun(config.arrInstanceId);

		const nextRunAt = calculateNextRun(config.cron);
		if (nextRunAt) upgradeConfigsQueries.updateNextRunAt(config.arrInstanceId, nextRunAt);

		const output = `Processed ${log.selection.actualCount} item(s) using "${log.config.selectedFilter}"`;
		if (log.status === 'failed') {
			return {
				status: 'failure',
				error: log.results.errors.join('; '),
				rescheduleAt: job.source === 'schedule' ? (nextRunAt ?? undefined) : undefined
			};
		}

		if (log.selection.actualCount === 0) {
			return {
				status: 'skipped',
				output,
				rescheduleAt: job.source === 'schedule' ? (nextRunAt ?? undefined) : undefined
			};
		}

		return {
			status: 'success',
			output,
			rescheduleAt: job.source === 'schedule' ? (nextRunAt ?? undefined) : undefined
		};
	} catch (error) {
		await logger.error('Upgrade job failed', {
			source: 'UpgradeJob',
			meta: { jobId: job.id, instanceId, instanceName: instance.name, error }
		});
		return {
			status: 'failure',
			error: error instanceof Error ? error.message : String(error)
		};
	}
};

jobQueueRegistry.register('arr.upgrade', upgradeRunHandler);
