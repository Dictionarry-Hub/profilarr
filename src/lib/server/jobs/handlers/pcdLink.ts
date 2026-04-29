import { jobQueueRegistry } from '../queueRegistry.ts';
import type { JobHandler } from '../queueTypes.ts';
import { pcdManager } from '$pcd/index.ts';
import type { LinkOptions } from '$pcd/core/types.ts';
import { schedulePcdSyncForDatabase } from '../schedule.ts';
import { logger } from '$logger/logger.ts';
import { notificationManager } from '$notifications/NotificationManager.ts';
import { notifications } from '$notifications/definitions/index.ts';

/**
 * Single-shot in-memory store for PATs used by `pcd.link` jobs.
 * Form action stashes the PAT here under a generated id, payload only
 * carries the id. Avoids persisting PATs into `job_queue.payload`
 * (SQLite-backed JSON, retained for history). If the process restarts
 * between enqueue and execution, the PAT is lost and the link fails.
 * Acceptable because manual link jobs run within ms of being queued.
 */
const linkPats = new Map<string, string>();

export function stashLinkPat(pat: string): string {
	const id = crypto.randomUUID();
	linkPats.set(id, pat);
	return id;
}

function consumeLinkPat(id: string): string | undefined {
	const pat = linkPats.get(id);
	linkPats.delete(id);
	return pat;
}

interface LinkPayload {
	name?: unknown;
	repositoryUrl?: unknown;
	branch?: unknown;
	syncStrategy?: unknown;
	autoPull?: unknown;
	localOpsEnabled?: unknown;
	gitUserName?: unknown;
	gitUserEmail?: unknown;
	conflictStrategy?: unknown;
	patToken?: unknown;
}

const pcdLinkHandler: JobHandler = async (job, ctx) => {
	const payload = job.payload as LinkPayload;
	const name = typeof payload.name === 'string' ? payload.name : '';
	const repositoryUrl = typeof payload.repositoryUrl === 'string' ? payload.repositoryUrl : '';

	if (!name || !repositoryUrl) {
		return { status: 'failure', error: 'Invalid link payload' };
	}

	const personalAccessToken =
		typeof payload.patToken === 'string' ? consumeLinkPat(payload.patToken) : undefined;

	const input: LinkOptions = {
		name,
		repositoryUrl,
		branch: typeof payload.branch === 'string' ? payload.branch : undefined,
		syncStrategy: typeof payload.syncStrategy === 'number' ? payload.syncStrategy : 0,
		autoPull: payload.autoPull === true,
		personalAccessToken,
		localOpsEnabled: payload.localOpsEnabled === true,
		gitUserName: typeof payload.gitUserName === 'string' ? payload.gitUserName : undefined,
		gitUserEmail: typeof payload.gitUserEmail === 'string' ? payload.gitUserEmail : undefined,
		conflictStrategy:
			typeof payload.conflictStrategy === 'string' ? payload.conflictStrategy : undefined
	};

	try {
		const instance = await pcdManager.link(input, ctx?.progress);

		schedulePcdSyncForDatabase(instance.id);

		await logger.info(`Linked database "${name}" via job`, {
			source: 'PcdLinkJob',
			meta: { jobId: job.id, databaseId: instance.id, name }
		});

		return {
			status: 'success',
			output: `Linked "${name}"`
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);

		await logger.error('Database link job failed', {
			source: 'PcdLinkJob',
			meta: { jobId: job.id, name, repositoryUrl, error: errorMessage }
		});

		try {
			await notificationManager.notify(notifications.pcdLinkFailed({ name, error: errorMessage }));
		} catch {
			// Notification failure should never block job result
		}

		return { status: 'failure', error: errorMessage };
	}
};

jobQueueRegistry.register('pcd.link', pcdLinkHandler);
