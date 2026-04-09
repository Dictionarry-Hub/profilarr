import { jobQueueRegistry } from '../queueRegistry.ts';
import type { JobHandler } from '../queueTypes.ts';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { pcdManager } from '$pcd/index.ts';
import { calculateNextRunFromMinutes } from '../scheduleUtils.ts';
import { logger } from '$logger/logger.ts';
import { getCommitMessagesBetween } from '$utils/git/index.ts';
import { notificationManager } from '$notifications/NotificationManager.ts';
import { notifications } from '$notifications/definitions/index.ts';

const dbSyncHandler: JobHandler = async (job) => {
	const databaseId = Number(job.payload.databaseId);
	if (!Number.isFinite(databaseId)) {
		return { status: 'failure', error: 'Invalid database ID' };
	}

	const instance = databaseInstancesQueries.getById(databaseId);
	if (!instance || instance.enabled === 0) {
		return { status: 'cancelled', output: 'Database sync disabled' };
	}

	if (instance.sync_strategy <= 0 && job.source === 'schedule') {
		return { status: 'cancelled', output: 'Auto-sync disabled' };
	}

	const scheduledFromLastRun = calculateNextRunFromMinutes(
		instance.last_synced_at,
		instance.sync_strategy
	);

	// If not due yet, reschedule to nextRunAt
	if (job.source === 'schedule' && instance.last_synced_at) {
		const dueAt = new Date(scheduledFromLastRun).getTime();
		if (Date.now() < dueAt) {
			return {
				status: 'skipped',
				output: 'Database sync not due',
				rescheduleAt: scheduledFromLastRun
			};
		}
	}

	const rescheduleAt =
		job.source === 'schedule'
			? calculateNextRunFromMinutes(new Date().toISOString(), instance.sync_strategy)
			: undefined;

	try {
		const updateInfo = await pcdManager.checkForUpdates(databaseId);

		if (!updateInfo.hasUpdates) {
			databaseInstancesQueries.updateSyncedAt(databaseId);
			return {
				status: 'skipped',
				output: 'No updates available',
				rescheduleAt
			};
		}

		if (instance.auto_pull === 1) {
			const syncResult = await pcdManager.sync(databaseId);
			if (!syncResult.success) {
				return {
					status: 'failure',
					error: syncResult.error ?? 'Sync failed',
					rescheduleAt
				};
			}

			return {
				status: 'success',
				output: `Pulled ${syncResult.commitsBehind} update(s)`,
				rescheduleAt
			};
		}

		// Auto-pull disabled: notify and update last_synced_at
		databaseInstancesQueries.updateSyncedAt(databaseId);

		try {
			const commitMessages = await getCommitMessagesBetween(
				instance.local_path,
				updateInfo.currentLocalCommit,
				updateInfo.latestRemoteCommit
			);
			await notificationManager.notify(
				notifications.pcdUpdatesAvailable({
					name: instance.name,
					commitsBehind: updateInfo.commitsBehind,
					commitMessages
				})
			);
		} catch {
			// Notification failure should never block the job
		}

		return {
			status: 'success',
			output: 'Updates available (auto-pull disabled)',
			rescheduleAt
		};
	} catch (error) {
		await logger.error('Database sync job failed', {
			source: 'DbSyncJob',
			meta: { jobId: job.id, databaseId, databaseName: instance.name, error }
		});
		return {
			status: 'failure',
			error: error instanceof Error ? error.message : String(error),
			rescheduleAt
		};
	}
};

jobQueueRegistry.register('pcd.sync', dbSyncHandler);
