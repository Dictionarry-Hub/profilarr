import { error, fail } from '@sveltejs/kit';
import type { Actions, ServerLoad } from '@sveltejs/kit';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { arrRenameSettingsQueries } from '$db/queries/arrRenameSettings.ts';
import { renameRunsQueries } from '$db/queries/renameRuns.ts';
import { logger } from '$logger/logger.ts';
import { scheduleRenameForInstance } from '$lib/server/jobs/init.ts';
import { enqueueJob } from '$lib/server/jobs/queueService.ts';
import { buildJobDisplayName } from '$lib/server/jobs/display.ts';
import { validateCronExpression, calculateNextRun } from '$lib/server/jobs/scheduleUtils.ts';

export const load: ServerLoad = ({ params }) => {
	const id = parseInt(params.id || '', 10);

	if (isNaN(id)) {
		error(404, `Invalid instance ID: ${params.id}`);
	}

	const instance = arrInstancesQueries.getById(id);

	if (!instance) {
		error(404, `Instance not found: ${id}`);
	}

	const settings = arrRenameSettingsQueries.getByInstanceId(id);
	const renameRuns = renameRunsQueries.getByInstanceId(id);

	const { api_key: _, ...safeInstance } = instance;

	return {
		instance: safeInstance,
		settings: settings ?? null,
		renameRuns
	};
};

export const actions: Actions = {
	save: async ({ params, request }) => {
		const id = parseInt(params.id || '', 10);

		if (isNaN(id)) {
			return fail(400, { error: 'Invalid instance ID' });
		}

		const instance = arrInstancesQueries.getById(id);
		if (!instance) {
			return fail(404, { error: 'Instance not found' });
		}

		const formData = await request.formData();

		try {
			const enabled = formData.get('enabled') === 'true';
			const renameFolders = formData.get('renameFolders') === 'true';
			const ignoreTag = (formData.get('ignoreTag') as string) || null;
			const cron = (formData.get('cron') as string) || '0 0 * * *';
			const summaryNotifications = formData.get('summaryNotifications') === 'true';

			// Validate cron expression (10 min minimum for renames)
			const cronError = validateCronExpression(cron, 10);
			if (cronError) {
				return fail(400, { error: cronError });
			}

			const settingsData = {
				enabled,
				renameFolders,
				ignoreTag,
				cron,
				summaryNotifications
			};

			arrRenameSettingsQueries.upsert(id, settingsData);

			// Calculate and store next run time
			const nextRunAt = calculateNextRun(cron);
			if (nextRunAt) arrRenameSettingsQueries.updateNextRunAt(id, nextRunAt);

			scheduleRenameForInstance(id);

			await logger.info(`Rename settings saved for instance "${instance.name}"`, {
				source: 'rename',
				meta: { instanceId: id, instanceName: instance.name }
			});

			await logger.debug('Rename settings details', {
				source: 'rename',
				meta: {
					instanceId: id,
					...settingsData
				}
			});

			return { success: true };
		} catch (err) {
			await logger.error('Failed to save rename settings', {
				source: 'rename',
				meta: { instanceId: id, error: err }
			});
			return fail(500, { error: 'Failed to save configuration' });
		}
	},

	update: async ({ params, request }) => {
		const id = parseInt(params.id || '', 10);

		if (isNaN(id)) {
			return fail(400, { error: 'Invalid instance ID' });
		}

		const instance = arrInstancesQueries.getById(id);
		if (!instance) {
			return fail(404, { error: 'Instance not found' });
		}

		const existing = arrRenameSettingsQueries.getByInstanceId(id);
		if (!existing) {
			return fail(404, { error: 'Configuration not found' });
		}

		const formData = await request.formData();

		try {
			const enabled = formData.get('enabled') === 'true';
			const renameFolders = formData.get('renameFolders') === 'true';
			const ignoreTag = (formData.get('ignoreTag') as string) || null;
			const cron = (formData.get('cron') as string) || '0 0 * * *';
			const summaryNotifications = formData.get('summaryNotifications') === 'true';

			// Validate cron expression (10 min minimum for renames)
			const cronError = validateCronExpression(cron, 10);
			if (cronError) {
				return fail(400, { error: cronError });
			}

			const settingsData = {
				enabled,
				renameFolders,
				ignoreTag,
				cron,
				summaryNotifications
			};

			arrRenameSettingsQueries.update(id, settingsData);

			// Calculate and store next run time
			const nextRunAt = calculateNextRun(cron);
			if (nextRunAt) arrRenameSettingsQueries.updateNextRunAt(id, nextRunAt);

			scheduleRenameForInstance(id);

			await logger.info(`Rename settings updated for instance "${instance.name}"`, {
				source: 'rename',
				meta: { instanceId: id, instanceName: instance.name }
			});

			await logger.debug('Rename settings details', {
				source: 'rename',
				meta: {
					instanceId: id,
					...settingsData
				}
			});

			return { success: true };
		} catch (err) {
			await logger.error('Failed to update rename settings', {
				source: 'rename',
				meta: { instanceId: id, error: err }
			});
			return fail(500, { error: 'Failed to update configuration' });
		}
	},

	run: async ({ params, request }) => {
		const id = parseInt(params.id || '', 10);

		if (isNaN(id)) {
			return fail(400, { error: 'Invalid instance ID' });
		}

		const instance = arrInstancesQueries.getById(id);
		if (!instance) {
			return fail(404, { error: 'Instance not found' });
		}

		const settings = arrRenameSettingsQueries.getByInstanceId(id);
		if (!settings) {
			return fail(404, { error: 'No rename configuration found. Save a configuration first.' });
		}

		// Only support Radarr and Sonarr
		if (instance.type !== 'radarr' && instance.type !== 'sonarr') {
			return fail(400, { error: `Rename not yet supported for ${instance.type}` });
		}

		const formData = await request.formData();
		const dryRun = formData.get('dryRun') === 'true';

		try {
			const queued = enqueueJob({
				jobType: 'arr.rename',
				runAt: new Date().toISOString(),
				payload: { instanceId: id, dryRun },
				source: 'manual'
			});

			await logger.info('Manual rename run queued', {
				source: 'rename',
				meta: {
					jobId: queued.id,
					instanceId: id,
					instanceName: instance.name,
					displayName: buildJobDisplayName('arr.rename', { instanceId: id }),
					dryRun
				}
			});

			return { success: true, queued: true };
		} catch (err) {
			await logger.error('Manual rename run failed', {
				source: 'rename',
				meta: { instanceId: id, error: err }
			});

			return fail(500, { error: 'Rename run failed. Check logs for details.' });
		}
	}
};
