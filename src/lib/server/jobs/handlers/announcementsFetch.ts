import { jobQueueRegistry } from '../queueRegistry.ts';
import type { JobHandler } from '../queueTypes.ts';
import {
	FETCH_INTERVAL_MS,
	reconcileFromBulletin,
	type AnnouncementRecord
} from '$lib/server/announcements/index.ts';
import { notifications } from '$notifications/definitions/index.ts';
import { notificationManager } from '$notifications/NotificationManager.ts';
import { logger } from '$logger/logger.ts';

async function notifyNewAnnouncements(
	jobId: number,
	inserted: AnnouncementRecord[]
): Promise<void> {
	for (const announcement of inserted) {
		try {
			// Fire-and-forget per notifications.md.
			await notificationManager.notify(notifications.announcementNew({ announcement }));
		} catch (err) {
			await logger.error('Failed to send announcement notification', {
				source: 'AnnouncementsFetchJob',
				meta: {
					jobId,
					announcementId: announcement.id,
					error: err instanceof Error ? err.message : String(err)
				}
			});
		}
	}
}

const announcementsFetchHandler: JobHandler = async (job) => {
	const result = await reconcileFromBulletin();

	if (result.newlyInserted.length > 0) {
		await notifyNewAnnouncements(job.id, result.newlyInserted);
	}

	const output = JSON.stringify({
		versions: result.versions,
		announcements: result.announcements,
		inserted: result.newlyInserted.length
	});

	const rescheduleAt =
		job.source === 'schedule' ? new Date(Date.now() + FETCH_INTERVAL_MS).toISOString() : undefined;

	// Only count as failure if BOTH halves failed; partial success is still success.
	if (result.announcements === 'failed' && result.versions === 'failed') {
		return {
			status: 'failure',
			error: 'Bulletin fetch failed for both versions and announcements',
			output,
			rescheduleAt
		};
	}

	return { status: 'success', output, rescheduleAt };
};

jobQueueRegistry.register('announcements.fetch', announcementsFetchHandler);
