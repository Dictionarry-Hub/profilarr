import { error, fail } from '@sveltejs/kit';
import type { ServerLoad, Actions } from '@sveltejs/kit';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { arrSyncQueries, type SyncTrigger, type ProfileSelection } from '$db/queries/arrSync.ts';
import { pcdManager } from '$pcd/core/manager.ts';
import { logger } from '$logger/logger.ts';
import * as qualityProfileQueries from '$pcd/entities/qualityProfiles/index.ts';
import * as delayProfileQueries from '$pcd/entities/delayProfiles/index.ts';
import * as namingQueries from '$pcd/entities/mediaManagement/naming/index.ts';
import * as qualityDefinitionsQueries from '$pcd/entities/mediaManagement/quality-definitions/index.ts';
import * as mediaSettingsQueries from '$pcd/entities/mediaManagement/media-settings/index.ts';
import { calculateNextRun } from '$lib/server/sync/utils.ts';
import { scheduleArrSyncForInstance } from '$lib/server/jobs/init.ts';
import { enqueueJob } from '$lib/server/jobs/queueService.ts';
import { buildJobDisplayName } from '$lib/server/jobs/display.ts';

export const load: ServerLoad = async ({ params }) => {
	const id = parseInt(params.id || '', 10);

	if (isNaN(id)) {
		error(404, `Invalid instance ID: ${params.id}`);
	}

	const instance = arrInstancesQueries.getById(id);

	if (!instance) {
		error(404, `Instance not found: ${id}`);
	}

	// Get all databases
	const databases = pcdManager.getAllPublic();
	const arrType = instance.type as 'radarr' | 'sonarr';

	// Fetch profiles and configs from each database
	const databasesWithProfiles = await Promise.all(
		databases.map(async (db) => {
			const cache = pcdManager.getCache(db.id);
			if (!cache) {
				return {
					id: db.id,
					name: db.name,
					qualityProfiles: [],
					delayProfiles: [],
					namingConfigs: [],
					qualityDefinitionsConfigs: [],
					mediaSettingsConfigs: []
				};
			}

			const [
				qualityProfiles,
				delayProfiles,
				allNamingConfigs,
				allQualityDefinitionsConfigs,
				allMediaSettingsConfigs
			] = await Promise.all([
				qualityProfileQueries.list(cache),
				delayProfileQueries.list(cache),
				namingQueries.list(cache),
				qualityDefinitionsQueries.list(cache),
				mediaSettingsQueries.list(cache)
			]);

			// Filter configs by arr type - only show configs for the instance's arr type
			const namingConfigs = allNamingConfigs
				.filter((c) => c.arr_type === arrType)
				.map((c) => ({ name: c.name }));
			const qualityDefinitionsConfigs = allQualityDefinitionsConfigs
				.filter((c) => c.arr_type === arrType)
				.map((c) => ({ name: c.name }));
			const mediaSettingsConfigs = allMediaSettingsConfigs
				.filter((c) => c.arr_type === arrType)
				.map((c) => ({ name: c.name }));

			return {
				id: db.id,
				name: db.name,
				qualityProfiles,
				delayProfiles,
				namingConfigs,
				qualityDefinitionsConfigs,
				mediaSettingsConfigs
			};
		})
	);

	// Load existing sync data
	const syncData = arrSyncQueries.getFullSyncData(id);

	const { api_key: _, ...safeInstance } = instance;

	return {
		instance: safeInstance,
		databases: databasesWithProfiles,
		syncData
	};
};

export const actions: Actions = {
	saveQualityProfiles: async ({ params, request }) => {
		const id = parseInt(params.id || '', 10);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid instance ID' });
		}

		const instance = arrInstancesQueries.getById(id);
		const formData = await request.formData();
		const selectionsJson = formData.get('selections') as string;
		const trigger = formData.get('trigger') as SyncTrigger;
		const cron = formData.get('cron') as string | null;

		try {
			const selections: ProfileSelection[] = JSON.parse(selectionsJson || '[]');
			const effectiveTrigger = trigger || 'manual';
			const effectiveCron = cron || null;
			arrSyncQueries.saveQualityProfilesSync(id, selections, {
				trigger: effectiveTrigger,
				cron: effectiveCron,
				nextRunAt: effectiveTrigger === 'schedule' ? calculateNextRun(effectiveCron) : null
			});

			await logger.info(`Quality profiles sync config saved for "${instance?.name}"`, {
				source: 'sync',
				meta: { instanceId: id, profileCount: selections.length, trigger }
			});

			scheduleArrSyncForInstance(id);

			return { success: true };
		} catch (e) {
			await logger.error('Failed to save quality profiles sync config', {
				source: 'sync',
				meta: { instanceId: id, error: e }
			});
			return fail(500, { error: 'Failed to save quality profiles sync config' });
		}
	},

	saveDelayProfiles: async ({ params, request }) => {
		const id = parseInt(params.id || '', 10);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid instance ID' });
		}

		const instance = arrInstancesQueries.getById(id);
		const formData = await request.formData();
		const databaseId = formData.get('databaseId') as string | null;
		const profileName = formData.get('profileName') as string | null;
		const trigger = formData.get('trigger') as SyncTrigger;
		const cron = formData.get('cron') as string | null;

		try {
			const effectiveTrigger = trigger || 'manual';
			const effectiveCron = cron || null;
			arrSyncQueries.saveDelayProfilesSync(id, {
				databaseId: databaseId ? parseInt(databaseId, 10) : null,
				profileName: profileName || null,
				trigger: effectiveTrigger,
				cron: effectiveCron,
				nextRunAt: effectiveTrigger === 'schedule' ? calculateNextRun(effectiveCron) : null
			});

			await logger.info(`Delay profile sync config saved for "${instance?.name}"`, {
				source: 'sync',
				meta: { instanceId: id, databaseId, profileName, trigger }
			});

			scheduleArrSyncForInstance(id);

			return { success: true };
		} catch (e) {
			await logger.error('Failed to save delay profile sync config', {
				source: 'sync',
				meta: { instanceId: id, error: e }
			});
			return fail(500, { error: 'Failed to save delay profile sync config' });
		}
	},

	saveMediaManagement: async ({ params, request }) => {
		const id = parseInt(params.id || '', 10);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid instance ID' });
		}

		const instance = arrInstancesQueries.getById(id);
		const formData = await request.formData();
		const namingDatabaseId = formData.get('namingDatabaseId') as string | null;
		const namingConfigName = formData.get('namingConfigName') as string | null;
		const qualityDefinitionsDatabaseId = formData.get('qualityDefinitionsDatabaseId') as
			| string
			| null;
		const qualityDefinitionsConfigName = formData.get('qualityDefinitionsConfigName') as
			| string
			| null;
		const mediaSettingsDatabaseId = formData.get('mediaSettingsDatabaseId') as string | null;
		const mediaSettingsConfigName = formData.get('mediaSettingsConfigName') as string | null;
		const trigger = formData.get('trigger') as SyncTrigger;
		const cron = formData.get('cron') as string | null;

		try {
			const effectiveTrigger = trigger || 'manual';
			const effectiveCron = cron || null;
			arrSyncQueries.saveMediaManagementSync(id, {
				namingDatabaseId: namingDatabaseId ? parseInt(namingDatabaseId, 10) : null,
				namingConfigName: namingConfigName || null,
				qualityDefinitionsDatabaseId: qualityDefinitionsDatabaseId
					? parseInt(qualityDefinitionsDatabaseId, 10)
					: null,
				qualityDefinitionsConfigName: qualityDefinitionsConfigName || null,
				mediaSettingsDatabaseId: mediaSettingsDatabaseId
					? parseInt(mediaSettingsDatabaseId, 10)
					: null,
				mediaSettingsConfigName: mediaSettingsConfigName || null,
				trigger: effectiveTrigger,
				cron: effectiveCron,
				nextRunAt: effectiveTrigger === 'schedule' ? calculateNextRun(effectiveCron) : null
			});

			await logger.info(`Media management sync config saved for "${instance?.name}"`, {
				source: 'sync',
				meta: { instanceId: id, trigger }
			});

			scheduleArrSyncForInstance(id);

			return { success: true };
		} catch (e) {
			await logger.error('Failed to save media management sync config', {
				source: 'sync',
				meta: { instanceId: id, error: e }
			});
			return fail(500, { error: 'Failed to save media management sync config' });
		}
	},

	syncDelayProfiles: async ({ params }) => {
		const id = parseInt(params.id || '', 10);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid instance ID' });
		}

		const instance = arrInstancesQueries.getById(id);
		if (!instance) {
			return fail(404, { error: 'Instance not found' });
		}

		const dpSync = arrSyncQueries.getDelayProfilesSync(id);
		if (!dpSync.databaseId || !dpSync.profileName) {
			return fail(400, { error: 'No delay profile configured' });
		}

		const status = arrSyncQueries.getSyncConfigStatus(id);
		if (
			status.delayProfiles.syncStatus === 'pending' ||
			status.delayProfiles.syncStatus === 'in_progress'
		) {
			return fail(409, { error: 'Sync already in progress' });
		}

		try {
			arrSyncQueries.setDelayProfilesStatusPending(id);
			const queued = enqueueJob({
				jobType: 'arr.sync.delayProfiles',
				runAt: new Date().toISOString(),
				payload: { instanceId: id },
				source: 'manual'
			});

			await logger.info(`Queued delay profiles sync for "${instance.name}"`, {
				source: 'sync',
				meta: {
					jobId: queued.id,
					instanceId: id,
					instanceName: instance.name,
					displayName: buildJobDisplayName('arr.sync.delayProfiles', { instanceId: id })
				}
			});

			return { success: true, message: 'Delay profiles sync queued' };
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : 'Unknown error';
			await logger.error(`Delay profiles sync enqueue failed for "${instance.name}"`, {
				source: 'sync',
				meta: { instanceId: id, error: errorMsg }
			});
			return fail(500, { error: `Sync failed: ${errorMsg}` });
		}
	},

	syncQualityProfiles: async ({ params }) => {
		const id = parseInt(params.id || '', 10);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid instance ID' });
		}

		const instance = arrInstancesQueries.getById(id);
		if (!instance) {
			return fail(404, { error: 'Instance not found' });
		}

		const qpSync = arrSyncQueries.getQualityProfilesSync(id);
		if (qpSync.selections.length === 0) {
			return fail(400, { error: 'No quality profiles configured' });
		}

		const status = arrSyncQueries.getSyncConfigStatus(id);
		if (
			status.qualityProfiles.syncStatus === 'pending' ||
			status.qualityProfiles.syncStatus === 'in_progress'
		) {
			return fail(409, { error: 'Sync already in progress' });
		}

		try {
			arrSyncQueries.setQualityProfilesStatusPending(id);
			const queued = enqueueJob({
				jobType: 'arr.sync.qualityProfiles',
				runAt: new Date().toISOString(),
				payload: { instanceId: id },
				source: 'manual'
			});

			await logger.info(`Queued quality profiles sync for "${instance.name}"`, {
				source: 'sync',
				meta: {
					jobId: queued.id,
					instanceId: id,
					instanceName: instance.name,
					displayName: buildJobDisplayName('arr.sync.qualityProfiles', { instanceId: id })
				}
			});

			return { success: true, message: 'Quality profiles sync queued' };
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : 'Unknown error';
			await logger.error(`Quality profiles sync enqueue failed for "${instance.name}"`, {
				source: 'sync',
				meta: { instanceId: id, error: errorMsg }
			});
			return fail(500, { error: `Sync failed: ${errorMsg}` });
		}
	},

	syncMediaManagement: async ({ params }) => {
		const id = parseInt(params.id || '', 10);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid instance ID' });
		}

		const instance = arrInstancesQueries.getById(id);
		if (!instance) {
			return fail(404, { error: 'Instance not found' });
		}

		const mmSync = arrSyncQueries.getMediaManagementSync(id);
		if (
			!mmSync.namingDatabaseId &&
			!mmSync.qualityDefinitionsDatabaseId &&
			!mmSync.mediaSettingsDatabaseId
		) {
			return fail(400, { error: 'No media management configured' });
		}

		const status = arrSyncQueries.getSyncConfigStatus(id);
		if (
			status.mediaManagement.syncStatus === 'pending' ||
			status.mediaManagement.syncStatus === 'in_progress'
		) {
			return fail(409, { error: 'Sync already in progress' });
		}

		try {
			arrSyncQueries.setMediaManagementStatusPending(id);
			const queued = enqueueJob({
				jobType: 'arr.sync.mediaManagement',
				runAt: new Date().toISOString(),
				payload: { instanceId: id },
				source: 'manual'
			});

			await logger.info(`Queued media management sync for "${instance.name}"`, {
				source: 'sync',
				meta: {
					jobId: queued.id,
					instanceId: id,
					instanceName: instance.name,
					displayName: buildJobDisplayName('arr.sync.mediaManagement', { instanceId: id })
				}
			});

			return { success: true, message: 'Media management sync queued' };
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : 'Unknown error';
			await logger.error(`Media management sync enqueue failed for "${instance.name}"`, {
				source: 'sync',
				meta: { instanceId: id, error: errorMsg }
			});
			return fail(500, { error: `Sync failed: ${errorMsg}` });
		}
	}
};
