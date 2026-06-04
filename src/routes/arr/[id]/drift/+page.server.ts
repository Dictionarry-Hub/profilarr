import { error, fail } from '@sveltejs/kit';
import type { Actions, ServerLoad } from '@sveltejs/kit';
import { arrDriftSettingsQueries } from '$db/queries/arrDriftSettings.ts';
import { arrDriftStatusQueries } from '$db/queries/arrDriftStatus.ts';
import { arrInstancesQueries, toPublicArrInstance } from '$db/queries/arrInstances.ts';
import { logger } from '$logger/logger.ts';
import { scheduleDriftForInstance } from '$lib/server/jobs/init.ts';
import { enqueueJob } from '$lib/server/jobs/queueService.ts';
import { buildJobDisplayName } from '$lib/server/jobs/display.ts';
import { calculateNextRun, validateCronExpression } from '$lib/server/jobs/scheduleUtils.ts';
import { FEATURES } from '$shared/features.ts';
import { buildDriftDisplayEntities } from '$drift/display.ts';

export const load: ServerLoad = ({ params }) => {
	const id = parseInt(params.id || '', 10);

	if (isNaN(id)) {
		error(404, `Invalid instance ID: ${params.id}`);
	}

	const instance = arrInstancesQueries.getById(id);
	if (!instance) {
		error(404, `Instance not found: ${id}`);
	}

	const driftSettings = arrDriftSettingsQueries.getByInstanceId(id);
	const driftStatus = arrDriftStatusQueries.getByInstanceId(id);
	const safeInstance = toPublicArrInstance(instance);
	const diff = driftStatus?.diff ?? {};

	return {
		instance: safeInstance,
		featureEnabled: FEATURES.drift,
		settings: {
			enabled: driftSettings?.enabled ?? false,
			cron: driftSettings?.cron ?? '0 0 * * *',
			nextRunAt: driftSettings?.nextRunAt ?? null
		},
		status: {
			status: driftStatus?.status ?? 'never_checked',
			lastCheckedAt: driftStatus?.lastCheckedAt ?? null,
			lastError: driftStatus?.lastError ?? null
		},
		driftEntities: buildDriftDisplayEntities(diff, instance.type)
	};
};

export const actions: Actions = {
	save: async ({ params, request }) => {
		const id = parseInt(params.id || '', 10);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid instance ID' });
		}

		if (!FEATURES.drift) {
			return fail(404, { error: 'Drift detection is not available' });
		}

		const instance = arrInstancesQueries.getById(id);
		if (!instance) {
			return fail(404, { error: 'Instance not found' });
		}

		const formData = await request.formData();
		const enabled = formData.get('enabled') === 'true';
		const cron = ((formData.get('cron') as string | null) || '0 0 * * *').trim();

		const cronError = enabled ? validateCronExpression(cron, 10) : null;
		if (cronError) {
			return fail(400, { error: cronError });
		}

		const nextRunAt = enabled ? calculateNextRun(cron) : null;
		if (enabled && !nextRunAt) {
			return fail(400, { error: 'Invalid drift schedule' });
		}

		try {
			arrDriftSettingsQueries.upsert(id, { enabled, cron, nextRunAt });
			scheduleDriftForInstance(id);

			await logger.info(`Drift detection settings saved for "${instance.name}"`, {
				source: 'drift',
				meta: { instanceId: id, enabled }
			});

			return { success: true, nextRunAt };
		} catch (err) {
			await logger.error('Failed to save drift detection settings', {
				source: 'drift',
				meta: { instanceId: id, error: err }
			});
			return fail(500, { error: 'Failed to save drift detection settings' });
		}
	},

	run: async ({ params }) => {
		const id = parseInt(params.id || '', 10);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid instance ID' });
		}

		if (!FEATURES.drift) {
			return fail(404, { error: 'Drift detection is not available' });
		}

		const instance = arrInstancesQueries.getById(id);
		if (!instance) {
			return fail(404, { error: 'Instance not found' });
		}

		const settings = arrDriftSettingsQueries.getByInstanceId(id);
		if (!settings || !settings.enabled) {
			return fail(400, { error: 'Drift detection is disabled' });
		}

		try {
			const queued = enqueueJob({
				jobType: 'arr.drift',
				runAt: new Date().toISOString(),
				payload: { instanceId: id },
				source: 'manual'
			});

			await logger.info('Manual drift check queued', {
				source: 'drift',
				meta: {
					jobId: queued.id,
					instanceId: id,
					instanceName: instance.name,
					displayName: buildJobDisplayName('arr.drift', { instanceId: id })
				}
			});

			return { success: true, queued: true };
		} catch (err) {
			await logger.error('Manual drift check failed', {
				source: 'drift',
				meta: { instanceId: id, error: err }
			});
			return fail(500, { error: 'Failed to queue drift check' });
		}
	}
};
