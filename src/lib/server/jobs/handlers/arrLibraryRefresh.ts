import { jobQueueRegistry } from '../queueRegistry.ts';
import type { JobHandler } from '../queueTypes.ts';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { cache } from '$cache/cache.ts';
import { RadarrClient } from '$utils/arr/clients/radarr.ts';
import { SonarrClient } from '$utils/arr/clients/sonarr.ts';
import { arrClientOptionsFromInstance } from '$utils/arr/factory.ts';
import { LIBRARY_REQUEST_TIMEOUT_MS } from '$utils/arr/base.ts';
import { getProfilarrProfileNames } from '$lib/server/sync/libraryHelpers.ts';
import { calculateNextRunFromMinutes } from '../scheduleUtils.ts';
import { logger } from '$logger/logger.ts';

const libraryRefreshHandler: JobHandler = async (job) => {
	const instanceId = Number(job.payload.instanceId);
	if (!Number.isFinite(instanceId)) {
		return { status: 'failure', error: 'Invalid instance ID' };
	}

	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance || instance.enabled === 0) {
		return { status: 'cancelled', output: 'Instance disabled' };
	}

	if (instance.library_refresh_interval <= 0) {
		return { status: 'cancelled', output: 'Library refresh disabled' };
	}

	const scheduledFromLastRun = calculateNextRunFromMinutes(
		instance.library_last_refreshed_at,
		instance.library_refresh_interval
	);

	// If not due yet, reschedule
	if (job.source === 'schedule' && instance.library_last_refreshed_at) {
		const dueAt = new Date(scheduledFromLastRun).getTime();
		if (Date.now() < dueAt) {
			return {
				status: 'skipped',
				output: 'Library refresh not due',
				rescheduleAt: scheduledFromLastRun
			};
		}
	}

	const rescheduleAt =
		job.source === 'schedule'
			? calculateNextRunFromMinutes(new Date().toISOString(), instance.library_refresh_interval)
			: undefined;

	if (instance.type !== 'radarr' && instance.type !== 'sonarr') {
		return { status: 'skipped', output: `Library refresh not supported for ${instance.type}` };
	}

	const profilarrProfileNames = await getProfilarrProfileNames();
	const clientOptions = arrClientOptionsFromInstance(instance, {
		timeout: LIBRARY_REQUEST_TIMEOUT_MS
	});
	const client =
		instance.type === 'radarr'
			? new RadarrClient(instance.url, instance.api_key, clientOptions)
			: new SonarrClient(instance.url, instance.api_key, clientOptions);

	try {
		const items = await client.getLibrary(profilarrProfileNames);
		const ttl = instance.library_refresh_interval * 60;
		cache.set(`library:${instanceId}`, items, ttl);

		arrInstancesQueries.updateLibraryRefreshedAt(instanceId);

		await logger.info(`Library refreshed for ${instance.name}`, {
			source: 'LibraryRefresh',
			meta: { instanceId, itemCount: items.length }
		});

		return {
			status: 'success',
			output: `Cached ${items.length} item(s)`,
			rescheduleAt
		};
	} catch (error) {
		await logger.error('Library refresh failed', {
			source: 'LibraryRefresh',
			meta: { jobId: job.id, instanceId, instanceName: instance.name, error }
		});
		return {
			status: 'failure',
			error: error instanceof Error ? error.message : String(error),
			rescheduleAt
		};
	} finally {
		client.close();
	}
};

jobQueueRegistry.register('arr.library.refresh', libraryRefreshHandler);
