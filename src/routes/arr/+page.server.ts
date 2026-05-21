import { fail, redirect } from '@sveltejs/kit';
import type { Actions, ServerLoad } from '@sveltejs/kit';
import { arrInstancesQueries, toPublicArrInstance } from '$db/queries/arrInstances.ts';
import type { ArrInstancePublic } from '$db/queries/arrInstances.ts';
import { arrSyncQueries } from '$db/queries/arrSync.ts';
import { upgradeConfigsQueries } from '$db/queries/upgradeConfigs.ts';
import { arrRenameSettingsQueries } from '$db/queries/arrRenameSettings.ts';
import { arrCleanupSettingsQueries } from '$db/queries/arrCleanupSettings.ts';
import { cleanupJobsForArrInstance } from '$lib/server/jobs/cleanup.ts';
import { logger } from '$logger/logger.ts';

export type CompositeSyncStatus = 'idle' | 'pending' | 'in_progress' | 'failed' | 'not_configured';

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
}

function computeCompositeSyncStatus(statuses: string[]): CompositeSyncStatus {
	if (statuses.some((s) => s === 'failed')) return 'failed';
	if (statuses.some((s) => s === 'in_progress')) return 'in_progress';
	if (statuses.some((s) => s === 'pending')) return 'pending';
	return 'idle';
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

		const hasSyncConfig =
			qpSync.selections.length > 0 ||
			dpSync.profileName !== null ||
			mmSync.namingDatabaseId !== null ||
			mmSync.qualityDefinitionsDatabaseId !== null ||
			mmSync.mediaSettingsDatabaseId !== null;

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
			cleanupEnabled: cleanupConfig?.enabled ?? false
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
