import { error, fail } from '@sveltejs/kit';
import type { Actions, ServerLoad } from '@sveltejs/kit';
import { arrDriftSettingsQueries } from '$db/queries/arrDriftSettings.ts';
import { arrDriftStatusQueries } from '$db/queries/arrDriftStatus.ts';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { logger } from '$logger/logger.ts';
import { scheduleDriftForInstance } from '$lib/server/jobs/init.ts';
import { calculateNextRun, validateCronExpression } from '$lib/server/jobs/scheduleUtils.ts';
import { FEATURES } from '$shared/features.ts';

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
	const { api_key: _, ...safeInstance } = instance;

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
			counts: driftStatus?.counts ?? {},
			diff: driftStatus?.diff ?? {},
			diffHash: driftStatus?.diffHash ?? null,
			lastError: driftStatus?.lastError ?? null
		}
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
	}
};
