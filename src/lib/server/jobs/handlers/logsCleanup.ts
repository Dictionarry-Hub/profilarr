import { jobQueueRegistry } from '../queueRegistry.ts';
import type { JobHandler } from '../queueTypes.ts';
import { logSettingsQueries } from '$db/queries/logSettings.ts';
import { config } from '$config';
import { cleanupLogs } from '../logic/cleanupLogs.ts';
import { calculateNextRunFromSchedule } from '../scheduleUtils.ts';
import { logger } from '$logger/logger.ts';

const logsCleanupHandler: JobHandler = async (job) => {
	const settings = logSettingsQueries.get();
	if (!settings || settings.file_logging !== 1) {
		return { status: 'cancelled', output: 'File logging disabled' };
	}

	const retentionDays = settings.retention_days;
	const logsDir = config.paths.logs;

	try {
		const result = await cleanupLogs(logsDir, retentionDays);
		const message = `Cleanup completed: deleted ${result.deletedCount} file(s), ${result.errorCount} error(s)`;
		const nextRun = calculateNextRunFromSchedule('daily');

		if (result.errorCount > 0 && result.deletedCount === 0) {
			return {
				status: 'failure',
				error: message,
				rescheduleAt: job.source === 'schedule' ? nextRun : undefined
			};
		}

		if (result.deletedCount === 0) {
			return {
				status: 'skipped',
				output: 'No old log files to clean up',
				rescheduleAt: job.source === 'schedule' ? nextRun : undefined
			};
		}

		return {
			status: 'success',
			output: message,
			rescheduleAt: job.source === 'schedule' ? nextRun : undefined
		};
	} catch (error) {
		await logger.error('Logs cleanup failed', {
			source: 'LogsCleanupJob',
			meta: { jobId: job.id, error }
		});
		return { status: 'failure', error: error instanceof Error ? error.message : String(error) };
	}
};

jobQueueRegistry.register('logs.cleanup', logsCleanupHandler);
