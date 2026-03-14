import type { Actions, RequestEvent } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { config } from '$config';
import { logger } from '$logger/logger.ts';
import { enqueueJob } from '$lib/server/jobs/queueService.ts';
import { buildJobDisplayName } from '$lib/server/jobs/display.ts';
import { listBackups } from '$utils/backup/list.ts';

export const load = async () => {
	const backups = await listBackups(config.paths.backups);
	return { backups };
};

// These actions stay as form actions (session-only, not in the public API):
// - cleanupBackups: convenience trigger, already automated via job queue
// - restoreBackup: destructive (overwrites data dir, requires restart)
//
// All other backup operations use /api/v1/backups/* endpoints.
export const actions: Actions = {
	cleanupBackups: async () => {
		try {
			const queued = enqueueJob({
				jobType: 'backup.cleanup',
				runAt: new Date().toISOString(),
				payload: {},
				source: 'manual'
			});

			await logger.info('Manual backup cleanup queued', {
				source: 'settings/backups',
				meta: {
					jobId: queued.id,
					displayName: buildJobDisplayName('backup.cleanup', {})
				}
			});

			return { success: true, message: 'Backup cleanup queued' };
		} catch (err) {
			await logger.error('Failed to trigger backup cleanup', {
				source: 'settings/backups',
				meta: { error: err }
			});
			return fail(500, { error: 'Failed to trigger backup cleanup' });
		}
	},

	restoreBackup: async ({ request }: RequestEvent) => {
		const formData = await request.formData();
		const filename = formData.get('filename') as string;

		if (!filename || !filename.startsWith('backup-') || !filename.endsWith('.tar.gz')) {
			return fail(400, { error: 'Invalid filename' });
		}

		const backupPath = `${config.paths.backups}/${filename}`;

		try {
			// Verify backup exists
			await Deno.stat(backupPath);

			await logger.warn(`Restoring from backup: ${filename}`, {
				source: 'settings/backups',
				meta: { filename }
			});

			// Extract backup to base directory (will overwrite data directory)
			const command = new Deno.Command('tar', {
				args: ['-xzf', backupPath, '-C', config.paths.base],
				stdout: 'piped',
				stderr: 'piped'
			});

			const { code, stderr } = await command.output();

			if (code !== 0) {
				const errorMessage = new TextDecoder().decode(stderr);
				await logger.error('Backup restoration failed', {
					source: 'settings/backups',
					meta: { filename, error: errorMessage, exitCode: code }
				});
				return fail(500, { error: `Restore failed: ${errorMessage}` });
			}

			await logger.info(`Successfully restored from backup: ${filename}`, {
				source: 'settings/backups',
				meta: { filename }
			});

			return {
				success: true,
				message: 'Backup restored successfully. Please restart the application.'
			};
		} catch (err) {
			await logger.error(`Failed to restore backup: ${filename}`, {
				source: 'settings/backups',
				meta: { filename, error: err }
			});
			return fail(500, { error: 'Failed to restore backup' });
		}
	}
};
