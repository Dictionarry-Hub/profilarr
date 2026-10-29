import { readLastLogs, readLogsFromFile, getLogFilesList } from '#logger/reader.ts';
import type { Actions } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { enqueueJob } from '#server/jobs/queueService.ts';
import { buildJobDisplayName } from '#server/jobs/display.ts';
import { logger } from '#logger/logger.ts';

export const load = async ({ url }: { url: URL }) => {
	// Get all log files
	const logFiles = await getLogFilesList();

	const newest = logFiles[0]?.filename || '';

	// Only open a file the logs list holds; anything else, such as a path, falls
	// back to the newest log
	const requested = url.searchParams.get('file') || null;
	const rejectedFile = requested !== null && !logFiles.some((file) => file.filename === requested);
	if (rejectedFile) {
		await logger.warn(`Refused to open "${requested}": not in the logs list`, {
			source: 'settings/logs',
			meta: { file: requested }
		});
	}

	const selectedFile = (!rejectedFile && requested) || newest;

	// Load logs from selected file or all files if no file selected
	const logs = selectedFile ? await readLogsFromFile(selectedFile) : await readLastLogs();

	return {
		logs,
		logFiles,
		selectedFile,
		rejectedFile
	};
};

export const actions: Actions = {
	cleanupLogs: async () => {
		try {
			const queued = enqueueJob({
				jobType: 'logs.cleanup',
				runAt: new Date().toISOString(),
				payload: {},
				source: 'manual'
			});

			await logger.info('Manual logs cleanup queued', {
				source: 'settings/logs',
				meta: {
					jobId: queued.id,
					displayName: buildJobDisplayName('logs.cleanup', {})
				}
			});

			return { success: true };
		} catch (error) {
			await logger.error('Failed to trigger logs cleanup', {
				source: 'settings/logs',
				meta: { error }
			});
			return fail(500, { error: 'Failed to trigger logs cleanup' });
		}
	}
};
