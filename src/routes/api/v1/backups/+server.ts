import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { components } from '$api/v1.d.ts';
import { config } from '$config';
import { listBackups } from '$utils/backup/list.ts';
import { enqueueJob } from '$lib/server/jobs/queueService.ts';

type BackupFile = components['schemas']['BackupFile'];
type BackupCreateResponse = components['schemas']['BackupCreateResponse'];

/**
 * GET /api/v1/backups
 *
 * List all backup files, sorted newest first.
 */
export const GET: RequestHandler = async () => {
	const backups: BackupFile[] = await listBackups(config.paths.backups);
	return json(backups);
};

/**
 * POST /api/v1/backups
 *
 * Create a new backup. Enqueues a backup.create job and returns the job ID.
 * Poll GET /api/v1/jobs/{jobId} for status.
 */
export const POST: RequestHandler = async () => {
	const queued = enqueueJob({
		jobType: 'backup.create',
		runAt: new Date().toISOString(),
		payload: {},
		source: 'manual'
	});

	const response: BackupCreateResponse = { jobId: queued.id };
	return json(response, { status: 202 });
};
