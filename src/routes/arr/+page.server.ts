import { fail, redirect } from '@sveltejs/kit';
import type { Actions, ServerLoad } from '@sveltejs/kit';
import { arrInstancesQueries, toPublicArrInstance } from '#db/queries/arrInstances.ts';
import type { ArrInstancePublic } from '#db/queries/arrInstances.ts';
import { arrSyncQueries } from '#db/queries/arrSync.ts';
import type { SyncTrigger } from '#db/queries/arrSync.ts';
import { upgradeConfigsQueries } from '#db/queries/upgradeConfigs.ts';
import { arrRenameSettingsQueries } from '#db/queries/arrRenameSettings.ts';
import { arrCleanupSettingsQueries } from '#db/queries/arrCleanupSettings.ts';
import { cleanupJobsForArrInstance } from '#server/jobs/cleanup.ts';
import { arrDriftStatusQueries } from '#db/queries/arrDriftStatus.ts';
import { jobQueueQueries } from '#db/queries/jobQueue.ts';
import { jobRunHistoryQueries } from '#db/queries/jobRunHistory.ts';
import { upgradeRunsQueries } from '#db/queries/upgradeRuns.ts';
import { renameRunsQueries } from '#db/queries/renameRuns.ts';
import { parseCleanupRemoved } from '#server/sync/cleanupSummary.ts';
import type { DriftRunStatus } from '#shared/drift.ts';
import { logger } from '#logger/logger.ts';

export type CompositeSyncStatus = 'idle' | 'pending' | 'in_progress' | 'failed' | 'not_configured';

/** One sync section: whether anything is chosen to sync, how it triggers, and its state. */
export interface SectionActivity {
	configured: boolean;
	trigger: SyncTrigger;
	nextAt: string | null;
	status: string;
}

/** What each scheduled job last did and when it runs next, for the Arr card. */
export interface ArrActivity {
	sync: {
		qualityProfiles: SectionActivity;
		delayProfiles: SectionActivity;
		mediaManagement: SectionActivity;
	};
	drift: {
		status: DriftRunStatus;
		count: number;
		nextAt: string | null;
	};
	upgrades: { nextAt: string | null; lastSearched: number | null; lastFailed: boolean };
	renames: { nextAt: string | null; lastRenamed: number | null };
	cleanup: { nextAt: string | null; lastRemoved: number | null; lastFailed: boolean };
	library: { total: number | null; nextAt: string | null };
}

export interface ArrInstanceSummary extends ArrInstancePublic {
	syncedProfileNames: string[];
	compositeSyncStatus: CompositeSyncStatus;
	delayProfileName: string | null;
	namingConfigName: string | null;
	qualityDefinitionsConfigName: string | null;
	mediaSettingsConfigName: string | null;
	upgradeEnabled: boolean;
	renameEnabled: boolean;
	cleanupEnabled: boolean;
	activity: ArrActivity;
}

function computeCompositeSyncStatus(statuses: string[]): CompositeSyncStatus {
	if (statuses.some((s) => s === 'failed')) return 'failed';
	if (statuses.some((s) => s === 'in_progress')) return 'in_progress';
	if (statuses.some((s) => s === 'pending')) return 'pending';
	return 'idle';
}

/** Run time of the queued job with this key, or null if none is waiting. */
function nextQueuedAt(dedupeKey: string): string | null {
	const job = jobQueueQueries.getByDedupeKey(dedupeKey);
	return job?.status === 'queued' ? job.runAt : null;
}

function lastCleanupRun(instanceId: number): { removed: number | null; failed: boolean } {
	const job = jobQueueQueries.getByDedupeKey(`arr.cleanup:${instanceId}`);
	const run = job ? jobRunHistoryQueries.getByQueueId(job.id, 1)[0] : undefined;
	if (!run) return { removed: null, failed: false };
	if (run.status === 'failure') return { removed: null, failed: true };
	return { removed: parseCleanupRemoved(run.output), failed: false };
}

type SyncConfigStatus = ReturnType<typeof arrSyncQueries.getSyncConfigStatus>;

function sectionActivity(
	section: SyncConfigStatus[keyof SyncConfigStatus],
	configured: boolean
): SectionActivity {
	return {
		configured,
		trigger: section.trigger,
		nextAt: section.trigger === 'schedule' ? section.nextRunAt : null,
		status: section.syncStatus
	};
}

function getActivity(
	instanceId: number,
	syncStatus: SyncConfigStatus,
	configured: { qualityProfiles: boolean; delayProfiles: boolean; mediaManagement: boolean }
): ArrActivity {
	const drift = arrDriftStatusQueries.getByInstanceId(instanceId);
	const lastUpgrade = upgradeRunsQueries.getByInstanceId(instanceId, 1)[0];
	const lastRename = renameRunsQueries.getByInstanceId(instanceId, 1)[0];
	const cleanup = lastCleanupRun(instanceId);

	// Upgrade and rename runs both record the library size; use the newest.
	const lastLibraryRun = [lastUpgrade, lastRename]
		.filter((run) => run !== undefined)
		.sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];

	return {
		sync: {
			qualityProfiles: sectionActivity(syncStatus.qualityProfiles, configured.qualityProfiles),
			delayProfiles: sectionActivity(syncStatus.delayProfiles, configured.delayProfiles),
			mediaManagement: sectionActivity(syncStatus.mediaManagement, configured.mediaManagement)
		},
		drift: {
			status: drift?.status ?? 'never_checked',
			count: Object.values(drift?.counts ?? {}).reduce((sum, n) => sum + (n ?? 0), 0),
			nextAt: nextQueuedAt(`arr.drift:${instanceId}`)
		},
		upgrades: {
			nextAt: nextQueuedAt(`arr.upgrade:${instanceId}`),
			lastSearched: lastUpgrade?.results.searchesTriggered ?? null,
			lastFailed: lastUpgrade?.status === 'failed'
		},
		renames: {
			nextAt: nextQueuedAt(`arr.rename:${instanceId}`),
			lastRenamed: lastRename?.results.filesRenamed ?? null
		},
		cleanup: {
			nextAt: nextQueuedAt(`arr.cleanup:${instanceId}`),
			lastRemoved: cleanup.removed,
			lastFailed: cleanup.failed
		},
		library: {
			total: lastLibraryRun?.library.totalItems ?? null,
			nextAt: nextQueuedAt(`arr.library.refresh:${instanceId}`)
		}
	};
}

export const load: ServerLoad = () => {
	const instances = arrInstancesQueries.getAll();

	const summaries: ArrInstanceSummary[] = instances.map((instance) => {
		const safe = toPublicArrInstance(instance);
		const syncStatus = arrSyncQueries.getSyncConfigStatus(safe.id);
		const qpSync = arrSyncQueries.getQualityProfilesSync(safe.id);
		const dpSync = arrSyncQueries.getDelayProfilesSync(safe.id);
		const mmSync = arrSyncQueries.getMediaManagementSync(safe.id);
		const upgradeConfig = upgradeConfigsQueries.getByArrInstanceId(safe.id);
		const renameConfig = arrRenameSettingsQueries.getByInstanceId(safe.id);
		const cleanupConfig = arrCleanupSettingsQueries.getByInstanceId(safe.id);

		const configured = {
			qualityProfiles: qpSync.selections.length > 0,
			delayProfiles: dpSync.profileName !== null,
			mediaManagement:
				mmSync.namingDatabaseId !== null ||
				mmSync.qualityDefinitionsDatabaseId !== null ||
				mmSync.mediaSettingsDatabaseId !== null
		};
		const hasSyncConfig =
			configured.qualityProfiles || configured.delayProfiles || configured.mediaManagement;

		const compositeSyncStatus = hasSyncConfig
			? computeCompositeSyncStatus([
					syncStatus.qualityProfiles.syncStatus,
					syncStatus.delayProfiles.syncStatus,
					syncStatus.mediaManagement.syncStatus
				])
			: 'not_configured';

		return {
			...safe,
			syncedProfileNames: qpSync.selections.map((s) => s.profileName),
			compositeSyncStatus,
			delayProfileName: dpSync.profileName,
			namingConfigName: mmSync.namingConfigName,
			qualityDefinitionsConfigName: mmSync.qualityDefinitionsConfigName,
			mediaSettingsConfigName: mmSync.mediaSettingsConfigName,
			upgradeEnabled: upgradeConfig?.enabled ?? false,
			renameEnabled: renameConfig?.enabled ?? false,
			cleanupEnabled: cleanupConfig?.enabled ?? false,
			activity: getActivity(safe.id, syncStatus, configured)
		};
	});

	return { instances: summaries };
};

export const actions = {
	delete: async ({ request }) => {
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() || '0', 10);

		if (!id) {
			await logger.warn('Attempted to delete arr instance without ID', {
				source: 'arr'
			});

			return fail(400, {
				error: 'Instance ID is required'
			});
		}

		try {
			cleanupJobsForArrInstance(id);
			const deleted = arrInstancesQueries.delete(id);

			if (!deleted) {
				return fail(404, {
					error: 'Instance not found'
				});
			}

			await logger.info(`Deleted arr instance: ${id}`, {
				source: 'arr',
				meta: { id }
			});

			redirect(303, '/arr');
		} catch (error) {
			// Re-throw redirect errors (they're not actual errors)
			if (error && typeof error === 'object' && 'status' in error && 'location' in error) {
				throw error;
			}

			await logger.error('Failed to delete arr instance', {
				source: 'arr',
				meta: { error: error instanceof Error ? error.message : String(error) }
			});

			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to delete instance'
			});
		}
	}
} satisfies Actions;
