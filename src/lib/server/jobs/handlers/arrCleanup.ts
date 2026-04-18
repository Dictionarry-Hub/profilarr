import { jobQueueRegistry } from '../queueRegistry.ts';
import type { JobHandler } from '../queueTypes.ts';
import { arrCleanupSettingsQueries } from '$db/queries/arrCleanupSettings.ts';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { createArrClient } from '$utils/arr/factory.ts';
import type { ArrType } from '$utils/arr/types.ts';
import {
	scanForStaleItems,
	deleteStaleItems,
	type CleanupScanResult
} from '$lib/server/sync/cleanup.ts';
import {
	scanForRemovedEntities,
	deleteRemovedEntities,
	type EntityScanResult
} from '$lib/server/sync/entityCleanup.ts';
import { calculateNextRun } from '../scheduleUtils.ts';
import { logger } from '$logger/logger.ts';
import { notifications } from '$notifications/definitions/index.ts';
import { notificationManager } from '$notifications/NotificationManager.ts';

interface PreScanned {
	staleConfigs: CleanupScanResult;
	removedEntities: EntityScanResult;
}

/**
 * Manual runs from the cleanup modal attach the scan result to the payload so the handler
 * deletes exactly what the user previewed. Scheduled runs omit this and the handler scans
 * itself. Malformed payloads throw so the outer catch fires a failed notification.
 */
function extractPreScanned(payload: Record<string, unknown>): PreScanned | undefined {
	const raw = payload.preScanned;
	if (raw === undefined || raw === null) return undefined;
	if (typeof raw !== 'object') {
		throw new Error('preScanned payload must be an object');
	}
	const obj = raw as Record<string, unknown>;
	const staleConfigs = obj.staleConfigs as CleanupScanResult | undefined;
	const removedEntities = obj.removedEntities as EntityScanResult | undefined;
	if (
		!staleConfigs ||
		!Array.isArray(staleConfigs.staleCustomFormats) ||
		!Array.isArray(staleConfigs.staleQualityProfiles)
	) {
		throw new Error('preScanned.staleConfigs missing or malformed');
	}
	if (!removedEntities || !Array.isArray(removedEntities.removedEntities)) {
		throw new Error('preScanned.removedEntities missing or malformed');
	}
	return { staleConfigs, removedEntities };
}

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
		const preScanned = extractPreScanned(job.payload);

		// Config cleanup (stale QPs/CFs)
		const scanResult = preScanned?.staleConfigs ?? (await scanForStaleItems(client, instanceId));
		const deleteResult = await deleteStaleItems(client, scanResult);

		// Entity cleanup (removed from TMDB/TVDB)
		const entityScan =
			preScanned?.removedEntities ?? (await scanForRemovedEntities(client, instanceType));
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
		const deletedEntitiesCount = entityDelete.deletedEntities.length;
		const nonSuccesses =
			deleteResult.skippedQualityProfiles.length + entityDelete.failedEntities.length;
		const total = deletedConfigs + deletedEntitiesCount;
		const somethingHappened = total > 0 || nonSuccesses > 0;

		if (somethingHappened) {
			try {
				await notificationManager.notify(
					notifications.arrCleanup({
						instanceName: instance.name,
						instanceType,
						deletedCustomFormats: deleteResult.deletedCustomFormats,
						deletedQualityProfiles: deleteResult.deletedQualityProfiles,
						skippedQualityProfiles: deleteResult.skippedQualityProfiles,
						deletedEntities: entityDelete.deletedEntities,
						failedEntities: entityDelete.failedEntities
					})
				);
			} catch (err) {
				await logger.error('Failed to send arr cleanup notification', {
					source: 'CleanupJob',
					meta: {
						instanceId,
						error: err instanceof Error ? err.message : String(err)
					}
				});
			}
		}

		const output =
			total === 0
				? 'Nothing to clean up'
				: `Deleted ${deletedConfigs} stale config(s), ${deletedEntitiesCount} removed entit${deletedEntitiesCount === 1 ? 'y' : 'ies'}`;

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

		const errorMessage = error instanceof Error ? error.message : String(error);

		try {
			await notificationManager.notify(
				notifications.arrCleanup({
					instanceName: instance.name,
					instanceType,
					deletedCustomFormats: [],
					deletedQualityProfiles: [],
					skippedQualityProfiles: [],
					deletedEntities: [],
					failedEntities: [],
					error: errorMessage
				})
			);
		} catch (err) {
			await logger.error('Failed to send arr cleanup failure notification', {
				source: 'CleanupJob',
				meta: {
					instanceId,
					error: err instanceof Error ? err.message : String(err)
				}
			});
		}

		return {
			status: 'failure',
			error: errorMessage
		};
	} finally {
		client.close();
	}
};

jobQueueRegistry.register('arr.cleanup', cleanupHandler);
