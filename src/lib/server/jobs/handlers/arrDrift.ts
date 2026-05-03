import { jobQueueRegistry } from '../queueRegistry.ts';
import type { JobHandler } from '../queueTypes.ts';
import { arrDriftSettingsQueries } from '$db/queries/arrDriftSettings.ts';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { FEATURES } from '$shared/features.ts';
import { calculateNextRun } from '../scheduleUtils.ts';

const driftHandler: JobHandler = async (job) => {
	const instanceId = Number(job.payload.instanceId);
	if (!Number.isFinite(instanceId)) {
		return { status: 'failure', error: 'Invalid instance ID' };
	}

	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) {
		return { status: 'failure', error: 'Arr instance not found' };
	}

	const settings = arrDriftSettingsQueries.getByInstanceId(instanceId);
	if (!settings || !settings.enabled) {
		return { status: 'cancelled', output: 'Drift detection disabled' };
	}

	if (!FEATURES.drift) {
		return { status: 'cancelled', output: 'Drift detection feature disabled' };
	}

	if (instance.type !== 'radarr' && instance.type !== 'sonarr') {
		return { status: 'skipped', output: `Drift detection not supported for ${instance.type}` };
	}

	const nextRunAt = calculateNextRun(settings.cron);
	if (nextRunAt) arrDriftSettingsQueries.updateNextRunAt(instanceId, nextRunAt);

	return {
		status: 'skipped',
		output: 'Drift comparison not implemented',
		rescheduleAt: job.source === 'schedule' ? (nextRunAt ?? undefined) : undefined
	};
};

jobQueueRegistry.register('arr.drift', driftHandler);
