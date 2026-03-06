import { jobQueueRegistry } from '../queueRegistry.ts';
import type { JobHandler } from '../queueTypes.ts';
import { arrCleanupSettingsQueries } from '$db/queries/arrCleanupSettings.ts';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { createArrClient } from '$utils/arr/factory.ts';
import type { ArrType } from '$utils/arr/types.ts';
import { scanForStaleItems, deleteStaleItems } from '$lib/server/sync/cleanup.ts';
import { scanForRemovedEntities, deleteRemovedEntities } from '$lib/server/sync/entityCleanup.ts';
import { calculateNextRun } from '../scheduleUtils.ts';
import { logger } from '$logger/logger.ts';

const cleanupHandler: JobHandler = async (job) => {
	const instanceId = Number(job.payload.instanceId);
	if (!Number.isFinite(instanceId)) {
		return { status: 'failure', error: 'Invalid instance ID' };
	}

	const settings = arrCleanupSettingsQueries.getByInstanceId(instanceId);
	if (!settings || !settings.enabled) {
		return { status: 'cancelled', output: 'Cleanup config disabled' };
	}

	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) {
		return { status: 'failure', error: 'Arr instance not found' };
	}

	if (instance.type !== 'radarr' && instance.type !== 'sonarr') {
		return { status: 'skipped', output: `Cleanup not supported for ${instance.type}` };
	}

	const instanceType = instance.type as 'radarr' | 'sonarr';

	const client = createArrClient(instance.type as ArrType, instance.url, instance.api_key, {
		retries: 0
	});

	try {
		// Config cleanup (stale QPs/CFs)
		const scanResult = await scanForStaleItems(client, instanceId);
		const deleteResult = await deleteStaleItems(client, scanResult);

		// Entity cleanup (removed from TMDB/TVDB)
		const entityScan = await scanForRemovedEntities(client, instanceType);
		const entityDelete = await deleteRemovedEntities(
			client,
			instanceType,
			entityScan.removedEntities
		);

		await logger.info('Cleanup complete', {
			source: 'Cleanup',
			meta: {
				instance: instance.name,
				deletedCFs: deleteResult.deletedCustomFormats.map((cf) => cf.name),
				deletedQPs: deleteResult.deletedQualityProfiles.map((qp) => qp.name),
				skippedQPs: deleteResult.skippedQualityProfiles.map((s) => s.item.name),
				deletedEntities: entityDelete.deletedEntities.map((e) => e.title),
				failedEntities: entityDelete.failedEntities.map((f) => f.entity.title)
			}
		});

		arrCleanupSettingsQueries.updateLastRun(instanceId);

		const nextRunAt = calculateNextRun(settings.cron);
		if (nextRunAt) arrCleanupSettingsQueries.updateNextRunAt(instanceId, nextRunAt);

		const deletedConfigs =
			deleteResult.deletedCustomFormats.length + deleteResult.deletedQualityProfiles.length;
		const deletedEntities = entityDelete.deletedEntities.length;
		const total = deletedConfigs + deletedEntities;

		const output =
			total === 0
				? 'Nothing to clean up'
				: `Deleted ${deletedConfigs} stale config(s), ${deletedEntities} removed entit${deletedEntities === 1 ? 'y' : 'ies'}`;

		return {
			status: total === 0 ? 'skipped' : 'success',
			output,
			rescheduleAt: job.source === 'schedule' ? (nextRunAt ?? undefined) : undefined
		};
	} catch (error) {
		await logger.error('Cleanup job failed', {
			source: 'CleanupJob',
			meta: { jobId: job.id, instanceId, instanceName: instance.name, error }
		});
		return {
			status: 'failure',
			error: error instanceof Error ? error.message : String(error)
		};
	} finally {
		client.close();
	}
};

jobQueueRegistry.register('arr.cleanup', cleanupHandler);
