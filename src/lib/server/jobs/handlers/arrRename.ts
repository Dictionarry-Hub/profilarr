import { jobQueueRegistry } from '../queueRegistry.ts';
import type { JobHandler } from '../queueTypes.ts';
import { arrRenameSettingsQueries } from '$db/queries/arrRenameSettings.ts';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { processRenameConfig } from '$lib/server/rename/processor.ts';
import { calculateNextRun } from '../scheduleUtils.ts';
import { logger } from '$logger/logger.ts';

const renameRunHandler: JobHandler = async (job) => {
	const instanceId = Number(job.payload.instanceId);
	if (!Number.isFinite(instanceId)) {
		return { status: 'failure', error: 'Invalid instance ID' };
	}

	const settings = arrRenameSettingsQueries.getByInstanceId(instanceId);
	if (!settings || !settings.enabled) {
		return { status: 'cancelled', output: 'Rename config disabled' };
	}

	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) {
		return { status: 'failure', error: 'Arr instance not found' };
	}

	if (instance.type !== 'radarr' && instance.type !== 'sonarr') {
		return { status: 'skipped', output: `Rename not supported for ${instance.type}` };
	}

	const dryRun = Boolean(job.payload.dryRun);

	try {
		const log = await processRenameConfig(settings, instance, job.source === 'manual', dryRun);

		arrRenameSettingsQueries.updateLastRun(instanceId);

		const nextRunAt = calculateNextRun(settings.cron);
		if (nextRunAt) arrRenameSettingsQueries.updateNextRunAt(instanceId, nextRunAt);

		const output = dryRun
			? `${log.results.filesNeedingRename} files would be renamed`
			: `${log.results.filesRenamed}/${log.results.filesNeedingRename} files renamed`;

		const status =
			log.status === 'failed'
				? 'failure'
				: log.results.filesNeedingRename === 0
					? 'skipped'
					: 'success';
		return {
			status,
			output,
			rescheduleAt: job.source === 'schedule' ? (nextRunAt ?? undefined) : undefined
		};
	} catch (error) {
		await logger.error('Rename job failed', {
			source: 'RenameJob',
			meta: { jobId: job.id, instanceId, instanceName: instance.name, error }
		});
		return {
			status: 'failure',
			error: error instanceof Error ? error.message : String(error)
		};
	}
};

jobQueueRegistry.register('arr.rename', renameRunHandler);
