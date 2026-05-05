import type { Actions, RequestEvent } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { config } from '$config';
import { logger } from '$logger/logger.ts';
import { enqueueJob } from '$lib/server/jobs/queueService.ts';
import { buildJobDisplayName } from '$lib/server/jobs/display.ts';
import { listBackups } from '$utils/backup/list.ts';
import { isValidBackupFilename, resolveBackupPath } from '$utils/backup/validation.ts';
import { SANITIZED_CATEGORIES } from '$utils/backup/sanitize.ts';

export const load = async () => {
	const backups = await listBackups(config.paths.backups);
	return { backups, sanitizedCategories: SANITIZED_CATEGORIES };
};

// These actions stay as form actions (session-only, not in the public API):
// - cleanupBackups: convenience trigger, already automated via job queue
// - restoreBackup: stages a pending restore; the actual swap happens at
//   next boot via applyPendingRestore() before the DB is opened.
// - cancelRestore: clears a staged restore. The banner in the root layout
//   posts here from any page, so removing the sentinel is the only effect.
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

		if (!filename || !isValidBackupFilename(filename)) {
			return fail(400, { error: 'Invalid filename' });
		}

		const backupPath = resolveBackupPath(filename, config.paths.backups);
		if (!backupPath) {
			return fail(400, { error: 'Invalid filename' });
		}

		try {
			// Verify backup exists
			await Deno.stat(backupPath);

			// Stage a pending restore. The sentinel sits at the base level
			// (outside `data/`) so a backup taken while a restore is staged
			// won't carry the sentinel into its archive. The actual swap
			// happens at next boot via applyPendingRestore().
			const sentinelPath = `${config.paths.base}/.restore-pending`;
			await Deno.writeTextFile(sentinelPath, backupPath);

			await logger.warn(`Restore staged: ${filename}`, {
				source: 'settings/backups',
				meta: { filename, archivePath: backupPath }
			});

			return {
				success: true,
				restartRequired: true,
				message: 'Backup staged. Restart Profilarr to apply.'
			};
		} catch (err) {
			await logger.error(`Failed to stage restore: ${filename}`, {
				source: 'settings/backups',
				meta: { filename, error: err }
			});
			return fail(500, { error: 'Failed to stage restore' });
		}
	},

	cancelRestore: async () => {
		const sentinelPath = `${config.paths.base}/.restore-pending`;
		try {
			await Deno.remove(sentinelPath);
			await logger.info('Pending restore cancelled', {
				source: 'settings/backups'
			});
			return { success: true, message: 'Pending restore cancelled.' };
		} catch (err) {
			if (err instanceof Deno.errors.NotFound) {
				return { success: true, message: 'No pending restore to cancel.' };
			}
			await logger.error('Failed to cancel pending restore', {
				source: 'settings/backups',
				meta: { error: err }
			});
			return fail(500, { error: 'Failed to cancel pending restore' });
		}
	}
};
