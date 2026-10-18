import { jobQueueRegistry } from '../queueRegistry.ts';
import type { JobHandler } from '../queueTypes.ts';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { arrClientOptionsFromInstance, createArrClient } from '$arr/factory.ts';
import { probeAndRecordVersion } from '$arr/version.ts';
import type { ArrType } from '$arr/types.ts';

/** Containers that boot alongside Profilarr can take a few minutes to answer. */
const RETRY_DELAY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;

/**
 * Probe one instance for its version and API generation and store the result.
 * Scheduled once per instance at boot (see `scheduleVersionCheckForInstance`).
 * Syncs re-probe on their own, so this only has to catch changes made while
 * Profilarr was not running.
 */
const arrVersionCheckHandler: JobHandler = async (job) => {
	const instanceId = Number(job.payload.instanceId);
	if (!Number.isFinite(instanceId)) {
		return { status: 'failure', error: 'Invalid instance ID' };
	}

	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) {
		return { status: 'cancelled', output: 'Arr instance not found' };
	}

	const client = createArrClient(
		instance.type as ArrType,
		instance.url,
		instance.api_key,
		arrClientOptionsFromInstance(instance, { timeout: 10000, retries: 0 })
	);

	try {
		const info = await probeAndRecordVersion(instance, client, 'ArrVersionCheckJob');
		if (info) {
			return {
				status: 'success',
				output: JSON.stringify({
					appName: info.appName,
					version: info.version,
					api: info.currentApi
				})
			};
		}

		const rescheduleAt =
			job.attempts < MAX_ATTEMPTS ? new Date(Date.now() + RETRY_DELAY_MS).toISOString() : null;
		return {
			status: 'failure',
			error: `${instance.name} did not answer the version check`,
			rescheduleAt
		};
	} finally {
		client.close();
	}
};

jobQueueRegistry.register('arr.version.check', arrVersionCheckHandler);
