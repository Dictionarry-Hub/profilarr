import { readLastLogs, readLogsFromFile, getLogFilesList } from '$logger/reader.ts';
import type { Actions } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { enqueueJob } from '#lib/server/jobs/queueService.ts';
import { buildJobDisplayName } from '#lib/server/jobs/display.ts';
import { logger } from '$logger/logger.ts';

export const load = async ({ url }: { url: URL }) => {
	// Get all log files
	const logFiles = await getLogFilesList();

	// Get selected file from query param, default to newest (first in list)
	const selectedFile = url.searchParams.get('file') || logFiles[0]?.filename || '';

	// Load logs from selected file or all files if no file selected
	const logs = selectedFile ? await readLogsFromFile(selectedFile) : await readLastLogs();

	return {
		logs,
		logFiles,
		selectedFile
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
