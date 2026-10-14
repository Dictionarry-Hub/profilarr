import * as fs from 'node:fs/promises';
import { jobQueueRegistry } from '../queueRegistry.ts';
import type { JobHandler } from '../queueTypes.ts';
import { backupSettingsQueries } from '$db/queries/backupSettings.ts';
import { config } from '$config';
import { logger } from '$logger/logger.ts';
import { calculateNextRunFromSchedule } from '../scheduleUtils.ts';

const backupCleanupHandler: JobHandler = async (job) => {
	const settings = backupSettingsQueries.get();
	if (!settings || settings.enabled !== 1) {
		return { status: 'cancelled', output: 'Backups disabled' };
	}

	const retentionDays = settings.retention_days;
	const backupsDir = config.paths.backups;

	const cutoffDate = new Date();
	cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

	let deletedCount = 0;
	let errorCount = 0;

	try {
		for (const entry of await fs.readdir(backupsDir, { withFileTypes: true })) {
			if (!entry.isFile()) continue;
			if (!entry.name.startsWith('backup-') || !entry.name.endsWith('.tar.gz')) {
				continue;
			}

			const filePath = `${backupsDir}/${entry.name}`;
			try {
				const stat = await fs.stat(filePath);
				if (stat.mtime && stat.mtime < cutoffDate) {
					await fs.rm(filePath);
					deletedCount++;
				}
			} catch (error) {
				errorCount++;
				await logger.error(`Failed to process backup file: ${entry.name}`, {
					source: 'BackupCleanupJob',
					meta: { jobId: job.id, file: entry.name, error }
				});
			}
		}
	} catch (error) {
		await logger.error('Backup cleanup failed', {
			source: 'BackupCleanupJob',
			meta: { jobId: job.id, error }
		});
		return {
			status: 'failure',
			error: `Failed to read backups directory: ${error instanceof Error ? error.message : String(error)}`
		};
	}

	const message = `Cleanup completed: deleted ${deletedCount} backup(s), ${errorCount} error(s)`;
	const nextRun = calculateNextRunFromSchedule('daily');

	if (errorCount > 0 && deletedCount === 0) {
		return {
			status: 'failure',
			error: message,
			rescheduleAt: job.source === 'schedule' ? nextRun : undefined
		};
	}

	if (deletedCount === 0) {
		return {
			status: 'skipped',
			output: 'No old backups to clean up',
			rescheduleAt: job.source === 'schedule' ? nextRun : undefined
		};
	}

	return {
		status: 'success',
		output: message,
		rescheduleAt: job.source === 'schedule' ? nextRun : undefined
	};
};

jobQueueRegistry.register('backup.cleanup', backupCleanupHandler);
