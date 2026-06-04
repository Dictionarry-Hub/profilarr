import { jobQueueRegistry } from '../queueRegistry.ts';
import type { JobHandler } from '../queueTypes.ts';
import { arrDriftSettingsQueries } from '$db/queries/arrDriftSettings.ts';
import { arrDriftStatusQueries } from '$db/queries/arrDriftStatus.ts';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { FEATURES } from '$shared/features.ts';
import { calculateNextRun } from '../scheduleUtils.ts';
import { arrClientOptionsFromInstance, createArrClient } from '$arr/factory.ts';
import type { ArrType } from '$arr/types.ts';
import { checkArrDrift } from '$drift/check.ts';
import { buildDriftDisplayEntities } from '$drift/display.ts';
import { hashDriftDiff } from '$drift/hash.ts';
import { logger } from '$logger/logger.ts';
import { notifications } from '$notifications/definitions/index.ts';
import { notificationManager } from '$notifications/NotificationManager.ts';

const driftHandler: JobHandler = async (job) => {
	const instanceId = Number(job.payload.instanceId);
	if (!Number.isFinite(instanceId)) {
		return { status: 'failure', error: 'Invalid instance ID' };
	}

	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) {
		return { status: 'failure', error: 'Arr instance not found' };
	}

	const settings = arrDriftSettingsQueries.getByInstanceId(instanceId);
	if (!settings || !settings.enabled) {
		return { status: 'cancelled', output: 'Drift detection disabled' };
	}

	if (!FEATURES.drift) {
		return { status: 'cancelled', output: 'Drift detection feature disabled' };
	}

	if (instance.type !== 'radarr' && instance.type !== 'sonarr') {
		return { status: 'skipped', output: `Drift detection not supported for ${instance.type}` };
	}

	const nextRunAt = calculateNextRun(settings.cron);
	if (nextRunAt) arrDriftSettingsQueries.updateNextRunAt(instanceId, nextRunAt);

	const client = createArrClient(
		instance.type as ArrType,
		instance.url,
		instance.api_key,
		arrClientOptionsFromInstance(instance, { retries: 0 })
	);
	const previousStatus = arrDriftStatusQueries.getByInstanceId(instanceId);

	try {
		const result = await checkArrDrift(client, instanceId, instance.type);
		const now = new Date().toISOString();
		const logMeta = {
			jobId: job.id,
			instanceId,
			instanceName: instance.name,
			status: result.status,
			counts: result.counts,
			diffHash: result.diffHash
		};

		arrDriftStatusQueries.upsert(instanceId, {
			status: result.status,
			lastCheckedAt: now,
			counts: result.counts,
			diff: result.diff,
			diffHash: result.diffHash,
			lastError: null,
			errorHash: null
		});

		const totalCount = Object.values(result.counts).reduce((sum, count) => sum + (count ?? 0), 0);
		if (result.status === 'drift_detected') {
			const notified = result.diffHash !== previousStatus?.lastNotifiedHash;

			await logger.info('Drift detected', {
				source: 'jobs.handlers.arrDrift',
				meta: { ...logMeta, notified }
			});

			if (notified) {
				await notificationManager.notify(
					notifications.arrDriftDetected({
						instanceName: instance.name,
						instanceType: instance.type,
						entities: buildDriftDisplayEntities(result.diff, instance.type)
					})
				);
				arrDriftStatusQueries.update(instanceId, {
					lastNotifiedHash: result.diffHash,
					lastNotifiedAt: now
				});
			}
		} else {
			await logger.debug('Drift check complete', {
				source: 'jobs.handlers.arrDrift',
				meta: logMeta
			});
		}

		return {
			status: 'success',
			output: totalCount === 0 ? 'No drift detected' : `Detected ${totalCount} drift item(s)`,
			rescheduleAt: job.source === 'schedule' ? (nextRunAt ?? undefined) : undefined
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const now = new Date().toISOString();
		const errorHash = await hashDriftDiff({ error: message });
		const notified = errorHash !== previousStatus?.lastNotifiedErrorHash;

		await logger.error('Drift check failed', {
			source: 'jobs.handlers.arrDrift',
			meta: {
				jobId: job.id,
				instanceId,
				instanceName: instance.name,
				error: message,
				notified
			}
		});

		arrDriftStatusQueries.upsert(instanceId, {
			status: 'failed',
			lastCheckedAt: now,
			counts: {},
			diff: {},
			diffHash: null,
			lastError: message,
			errorHash
		});

		if (notified) {
			await notificationManager.notify(
				notifications.arrDriftFailed({
					instanceName: instance.name,
					instanceType: instance.type,
					error: message
				})
			);
			arrDriftStatusQueries.update(instanceId, {
				lastNotifiedErrorHash: errorHash,
				lastNotifiedAt: now
			});
		}

		return {
			status: 'failure',
			error: message,
			rescheduleAt: job.source === 'schedule' ? (nextRunAt ?? undefined) : undefined
		};
	} finally {
		client.close();
	}
};

jobQueueRegistry.register('arr.drift', driftHandler);
