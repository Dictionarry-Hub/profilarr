import { jobQueueRegistry } from '../queueRegistry.ts';
import type { JobHandler, JobType } from '../queueTypes.ts';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { arrSyncQueries } from '$db/queries/arrSync.ts';
import { createArrClient } from '$arr/factory.ts';
import type { ArrType } from '$arr/types.ts';
import { calculateNextRun } from '$lib/server/sync/utils.ts';
import type { SectionType } from '$lib/server/sync/types.ts';
import { getSection } from '$lib/server/sync/registry.ts';
import { logger } from '$logger/logger.ts';
import { notifications } from '$notifications/definitions/index.ts';
import { notificationManager } from '$notifications/NotificationManager.ts';
import type { ArrSyncSectionResult } from '$notifications/definitions/arrSync.ts';

// Register sync handlers
import '$lib/server/sync/qualityProfiles/handler.ts';
import '$lib/server/sync/delayProfiles/handler.ts';
import '$lib/server/sync/mediaManagement/handler.ts';

const sectionOrder: SectionType[] = ['qualityProfiles', 'delayProfiles', 'mediaManagement'];

const jobTypeToSection = new Map<JobType, SectionType>([
	['arr.sync.qualityProfiles', 'qualityProfiles'],
	['arr.sync.delayProfiles', 'delayProfiles'],
	['arr.sync.mediaManagement', 'mediaManagement']
]);

function parseLegacySections(payload: Record<string, unknown>): SectionType[] | null {
	const raw = payload.sections ?? payload.section;
	if (Array.isArray(raw)) {
		const sections = raw.filter(
			(value): value is SectionType =>
				value === 'qualityProfiles' || value === 'delayProfiles' || value === 'mediaManagement'
		);
		return sections.length > 0 ? sections : null;
	}

	if (typeof raw === 'string') {
		if (raw === 'qualityProfiles' || raw === 'delayProfiles' || raw === 'mediaManagement') {
			return [raw];
		}
	}

	return null;
}

function resolveSections(jobType: JobType, payload: Record<string, unknown>): SectionType[] {
	const mapped = jobTypeToSection.get(jobType);
	if (mapped) return [mapped];
	if (jobType !== 'arr.sync') return [];
	return parseLegacySections(payload) ?? sectionOrder;
}

const arrSyncHandler: JobHandler = async (job) => {
	const instanceId = Number(job.payload.instanceId);
	if (!Number.isFinite(instanceId)) {
		return { status: 'failure', error: 'Invalid instance ID' };
	}

	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance || !instance.enabled) {
		return { status: 'cancelled', output: 'Arr instance disabled' };
	}

	const configStatus = arrSyncQueries.getSyncConfigStatus(instanceId);
	const sectionsToRun = resolveSections(job.jobType, job.payload);

	if (sectionsToRun.length === 0) {
		return { status: 'skipped', output: 'No sync sections specified' };
	}

	const client = createArrClient(instance.type as ArrType, instance.url, instance.api_key);
	const results: string[] = [];
	const sectionResults: ArrSyncSectionResult[] = [];
	let failures = 0;
	let ranSections = 0;
	let rescheduleAt: string | null = null;

	for (const section of sectionsToRun) {
		const handler = getSection(section);
		const config = configStatus[section];

		if (job.source === 'schedule' && config.trigger !== 'schedule') {
			results.push(`${section}: skipped`);
			continue;
		}

		if (!handler.hasConfig(instanceId)) {
			handler.completeSync(instanceId);
			results.push(`${section}: skipped`);
			continue;
		}

		handler.setStatusPending(instanceId);
		if (!handler.claimSync(instanceId)) {
			continue;
		}

		ranSections++;
		try {
			const syncer = handler.createSyncer(client, instance);
			const result = await syncer.sync();

			if (result.success) {
				handler.completeSync(instanceId);
				results.push(`${section}: ${result.itemsSynced} item(s)`);
				sectionResults.push({ section, success: true, items: result.items });
			} else {
				handler.failSync(instanceId, result.error ?? 'Unknown error');
				results.push(`${section}: failed`);
				failures++;
				sectionResults.push({ section, success: false, error: result.error });
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			handler.failSync(instanceId, message);
			results.push(`${section}: failed`);
			failures++;
			sectionResults.push({ section, success: false, error: message });
			await logger.error('Arr sync failed', {
				source: 'ArrSyncJob',
				meta: { jobId: job.id, instanceId, instanceName: instance.name, section, error: message }
			});
		} finally {
			if (config.trigger === 'schedule') {
				const nextRun = calculateNextRun(config.cron);
				handler.setNextRunAt(instanceId, nextRun);
				if (job.source === 'schedule') {
					rescheduleAt = nextRun ?? null;
				}
			}
		}
	}

	if (ranSections > 0) {
		try {
			await notificationManager.notify(
				notifications.arrSync({
					instanceName: instance.name,
					instanceType: instance.type,
					sections: sectionResults
				})
			);
		} catch (err) {
			await logger.error('Failed to send arr sync notification', {
				source: 'ArrSyncJob',
				meta: { instanceId, error: err instanceof Error ? err.message : 'Unknown error' }
			});
		}
	}

	if (job.source === 'schedule' && job.jobType === 'arr.sync') {
		const nextRunAt = arrSyncQueries.getNextScheduledRunAt(instanceId);
		if (nextRunAt) {
			return {
				status: failures > 0 ? 'failure' : 'success',
				output: results.join(', '),
				rescheduleAt: nextRunAt
			};
		}
	}

	return {
		status: ranSections === 0 ? 'skipped' : failures > 0 ? 'failure' : 'success',
		output: results.join(', '),
		rescheduleAt: job.source === 'schedule' ? rescheduleAt : null
	};
};

jobQueueRegistry.register('arr.sync', arrSyncHandler);
jobQueueRegistry.register('arr.sync.qualityProfiles', arrSyncHandler);
jobQueueRegistry.register('arr.sync.delayProfiles', arrSyncHandler);
jobQueueRegistry.register('arr.sync.mediaManagement', arrSyncHandler);
