import { jobQueueQueries } from '$db/queries/jobQueue.ts';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { arrSyncQueries } from '$db/queries/arrSync.ts';
import { upgradeConfigsQueries } from '$db/queries/upgradeConfigs.ts';
import { arrRenameSettingsQueries } from '$db/queries/arrRenameSettings.ts';
import { arrCleanupSettingsQueries } from '$db/queries/arrCleanupSettings.ts';
import { arrDriftSettingsQueries } from '$db/queries/arrDriftSettings.ts';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { backupSettingsQueries } from '$db/queries/backupSettings.ts';
import { logSettingsQueries } from '$db/queries/logSettings.ts';
import { FEATURES } from '$shared/features.ts';
import { calculateNextRun } from '$lib/server/sync/utils.ts';
import { calculateNextRunFromMinutes, calculateNextRunFromSchedule } from './scheduleUtils.ts';
import { jobDispatcher } from './dispatcher.ts';

function notify(runAt: string | null): void {
	if (!runAt) return;
	jobDispatcher.notifyJobEnqueued(runAt);
}

export function scheduleArrSyncForInstance(instanceId: number): void {
	const status = arrSyncQueries.getSyncConfigStatus(instanceId);

	const schedules = [
		{ key: 'qualityProfiles', config: status.qualityProfiles, jobType: 'arr.sync.qualityProfiles' },
		{ key: 'delayProfiles', config: status.delayProfiles, jobType: 'arr.sync.delayProfiles' },
		{ key: 'mediaManagement', config: status.mediaManagement, jobType: 'arr.sync.mediaManagement' }
	] as const;

	// Remove legacy combined scheduled jobs
	jobQueueQueries.unscheduleByDedupeKey(`arr.sync:${instanceId}`);

	for (const schedule of schedules) {
		const dedupeKey = `${schedule.jobType}:${instanceId}`;
		if (schedule.config.trigger !== 'schedule') {
			jobQueueQueries.unscheduleByDedupeKey(dedupeKey);
			continue;
		}

		let nextRun = schedule.config.nextRunAt;
		if (!nextRun && schedule.config.cron) {
			nextRun = calculateNextRun(schedule.config.cron) ?? null;
		}

		if (!nextRun) {
			jobQueueQueries.unscheduleByDedupeKey(dedupeKey);
			continue;
		}

		const job = jobQueueQueries.upsertScheduled({
			jobType: schedule.jobType,
			runAt: nextRun,
			payload: { instanceId },
			source: 'schedule',
			dedupeKey
		});

		notify(job.runAt);
	}
}

export function scheduleUpgradeForInstance(instanceId: number): void {
	const config = upgradeConfigsQueries.getByArrInstanceId(instanceId);
	if (!config || !config.enabled) {
		jobQueueQueries.unscheduleByDedupeKey(`arr.upgrade:${instanceId}`);
		return;
	}

	let nextRun = config.nextRunAt;
	if (!nextRun) {
		nextRun = calculateNextRun(config.cron) ?? null;
	}
	if (!nextRun) {
		jobQueueQueries.unscheduleByDedupeKey(`arr.upgrade:${instanceId}`);
		return;
	}

	const job = jobQueueQueries.upsertScheduled({
		jobType: 'arr.upgrade',
		runAt: nextRun,
		payload: { instanceId },
		source: 'schedule',
		dedupeKey: `arr.upgrade:${instanceId}`
	});

	notify(job.runAt);
}

export function scheduleRenameForInstance(instanceId: number): void {
	const settings = arrRenameSettingsQueries.getByInstanceId(instanceId);
	if (!settings || !settings.enabled) {
		jobQueueQueries.unscheduleByDedupeKey(`arr.rename:${instanceId}`);
		return;
	}

	let nextRun = settings.nextRunAt;
	if (!nextRun) {
		nextRun = calculateNextRun(settings.cron) ?? null;
	}
	if (!nextRun) {
		jobQueueQueries.unscheduleByDedupeKey(`arr.rename:${instanceId}`);
		return;
	}

	const job = jobQueueQueries.upsertScheduled({
		jobType: 'arr.rename',
		runAt: nextRun,
		payload: { instanceId },
		source: 'schedule',
		dedupeKey: `arr.rename:${instanceId}`
	});

	notify(job.runAt);
}

export function scheduleCleanupForInstance(instanceId: number): void {
	const settings = arrCleanupSettingsQueries.getByInstanceId(instanceId);
	if (!settings || !settings.enabled) {
		jobQueueQueries.unscheduleByDedupeKey(`arr.cleanup:${instanceId}`);
		return;
	}

	let nextRun = settings.nextRunAt;
	if (!nextRun) {
		nextRun = calculateNextRun(settings.cron) ?? null;
	}
	if (!nextRun) {
		jobQueueQueries.unscheduleByDedupeKey(`arr.cleanup:${instanceId}`);
		return;
	}

	const job = jobQueueQueries.upsertScheduled({
		jobType: 'arr.cleanup',
		runAt: nextRun,
		payload: { instanceId },
		source: 'schedule',
		dedupeKey: `arr.cleanup:${instanceId}`
	});

	notify(job.runAt);
}

export function scheduleDriftForInstance(instanceId: number): void {
	if (!FEATURES.drift) {
		jobQueueQueries.unscheduleByDedupeKey(`arr.drift:${instanceId}`);
		return;
	}

	const settings = arrDriftSettingsQueries.getByInstanceId(instanceId);
	if (!settings || !settings.enabled) {
		jobQueueQueries.unscheduleByDedupeKey(`arr.drift:${instanceId}`);
		return;
	}

	let nextRun = settings.nextRunAt;
	if (!nextRun) {
		nextRun = calculateNextRun(settings.cron) ?? null;
	}
	if (!nextRun) {
		jobQueueQueries.unscheduleByDedupeKey(`arr.drift:${instanceId}`);
		return;
	}

	const job = jobQueueQueries.upsertScheduled({
		jobType: 'arr.drift',
		runAt: nextRun,
		payload: { instanceId },
		source: 'schedule',
		dedupeKey: `arr.drift:${instanceId}`
	});

	notify(job.runAt);
}

export function scheduleLibraryRefreshForInstance(instanceId: number): void {
	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance || instance.enabled === 0 || instance.library_refresh_interval <= 0) {
		jobQueueQueries.unscheduleByDedupeKey(`arr.library.refresh:${instanceId}`);
		return;
	}

	const baseRunAt = instance.library_last_refreshed_at ?? new Date().toISOString();
	const runAt = calculateNextRunFromMinutes(baseRunAt, instance.library_refresh_interval);

	const job = jobQueueQueries.upsertScheduled({
		jobType: 'arr.library.refresh',
		runAt,
		payload: { instanceId },
		source: 'schedule',
		dedupeKey: `arr.library.refresh:${instanceId}`
	});

	notify(job.runAt);
}

export function schedulePcdSyncForDatabase(databaseId: number): void {
	const instance = databaseInstancesQueries.getById(databaseId);
	if (!instance || instance.enabled === 0 || instance.sync_strategy <= 0) {
		jobQueueQueries.unscheduleByDedupeKey(`pcd.sync:${databaseId}`);
		return;
	}

	const baseRunAt = instance.last_synced_at ?? new Date().toISOString();
	const runAt = calculateNextRunFromMinutes(baseRunAt, instance.sync_strategy);

	const job = jobQueueQueries.upsertScheduled({
		jobType: 'pcd.sync',
		runAt,
		payload: { databaseId },
		source: 'schedule',
		dedupeKey: `pcd.sync:${databaseId}`
	});

	notify(job.runAt);
}

export function scheduleBackupJobs(): void {
	const settings = backupSettingsQueries.get();
	if (!settings || settings.enabled !== 1) {
		jobQueueQueries.cancelByDedupeKey('backup.create');
		jobQueueQueries.cancelByDedupeKey('backup.cleanup');
		return;
	}

	const backupRunAt = calculateNextRunFromSchedule(settings.schedule);
	const cleanupRunAt = calculateNextRunFromSchedule('daily');

	const backupJob = jobQueueQueries.upsertScheduled({
		jobType: 'backup.create',
		runAt: backupRunAt,
		payload: {},
		source: 'schedule',
		dedupeKey: 'backup.create'
	});

	const cleanupJob = jobQueueQueries.upsertScheduled({
		jobType: 'backup.cleanup',
		runAt: cleanupRunAt,
		payload: {},
		source: 'schedule',
		dedupeKey: 'backup.cleanup'
	});

	notify(backupJob.runAt);
	notify(cleanupJob.runAt);
}

export function scheduleLogCleanup(): void {
	const settings = logSettingsQueries.get();
	if (!settings || settings.file_logging !== 1) {
		jobQueueQueries.cancelByDedupeKey('logs.cleanup');
		return;
	}

	const runAt = calculateNextRunFromSchedule('daily');
	const job = jobQueueQueries.upsertScheduled({
		jobType: 'logs.cleanup',
		runAt,
		payload: {},
		source: 'schedule',
		dedupeKey: 'logs.cleanup'
	});

	notify(job.runAt);
}

export function scheduleAnnouncementsFetch(): void {
	// First run fires immediately on boot; the handler reschedules itself 30
	// minutes out after each successful (or partially successful) run.
	const runAt = new Date().toISOString();
	const job = jobQueueQueries.upsertScheduled({
		jobType: 'announcements.fetch',
		runAt,
		payload: {},
		source: 'schedule',
		dedupeKey: 'announcements.fetch'
	});

	notify(job.runAt);
}

export function scheduleAllJobs(): void {
	const arrInstances = arrInstancesQueries.getAll();
	for (const instance of arrInstances) {
		scheduleArrSyncForInstance(instance.id);
		scheduleUpgradeForInstance(instance.id);
		scheduleRenameForInstance(instance.id);
		scheduleCleanupForInstance(instance.id);
		scheduleDriftForInstance(instance.id);
		scheduleLibraryRefreshForInstance(instance.id);
	}

	const databases = databaseInstancesQueries.getAll();
	for (const database of databases) {
		schedulePcdSyncForDatabase(database.id);
	}

	scheduleBackupJobs();
	scheduleLogCleanup();
	scheduleAnnouncementsFetch();
}
