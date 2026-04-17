import { jobQueueRegistry } from '../queueRegistry.ts';
import type { JobHandler } from '../queueTypes.ts';
import { backupSettingsQueries } from '$db/queries/backupSettings.ts';
import { config } from '$config';
import { createBackup } from '../logic/createBackup.ts';
import { calculateNextRunFromSchedule } from '../scheduleUtils.ts';
import { logger } from '$logger/logger.ts';
import { notifications } from '$notifications/definitions/index.ts';
import { notificationManager } from '$notifications/NotificationManager.ts';

async function notifyFailure(jobId: number, error: string): Promise<void> {
	try {
		await notificationManager.notify(notifications.backupFailed({ error }));
	} catch (err) {
		await logger.error('Failed to send backup failure notification', {
			source: 'BackupCreateJob',
			meta: { jobId, error: err instanceof Error ? err.message : 'Unknown error' }
		});
	}
}

const backupCreateHandler: JobHandler = async (job) => {
	const settings = backupSettingsQueries.get();
	if (!settings || settings.enabled !== 1) {
		return { status: 'cancelled', output: 'Backups disabled' };
	}

	const sourceDir = config.paths.data;
	const backupsDir = config.paths.backups;
	const startedAt = Date.now();

	try {
		const result = await createBackup(sourceDir, backupsDir);
		if (!result.success) {
			const errorMessage = result.error ?? 'Backup failed';
			await notifyFailure(job.id, errorMessage);
			return { status: 'failure', error: errorMessage };
		}

		const sizeInMB = ((result.sizeBytes ?? 0) / (1024 * 1024)).toFixed(2);
		const output = `Backup created: ${result.filename} (${sizeInMB} MB)`;
		const nextRun = calculateNextRunFromSchedule(settings.schedule);

		try {
			await notificationManager.notify(
				notifications.backupSuccess({
					filename: result.filename ?? '',
					sizeBytes: result.sizeBytes ?? 0,
					durationMs: Date.now() - startedAt
				})
			);
		} catch (err) {
			await logger.error('Failed to send backup success notification', {
				source: 'BackupCreateJob',
				meta: { jobId: job.id, error: err instanceof Error ? err.message : 'Unknown error' }
			});
		}

		return {
			status: 'success',
			output,
			rescheduleAt: job.source === 'schedule' ? nextRun : undefined
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		await logger.error('Backup creation failed', {
			source: 'BackupCreateJob',
			meta: { jobId: job.id, error }
		});
		await notifyFailure(job.id, errorMessage);
		return { status: 'failure', error: errorMessage };
	}
};

jobQueueRegistry.register('backup.create', backupCreateHandler);
