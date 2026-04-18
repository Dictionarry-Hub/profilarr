import { redirect, fail } from '@sveltejs/kit';
import type { Actions } from '@sveltejs/kit';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { arrCleanupSettingsQueries } from '$db/queries/arrCleanupSettings.ts';
import { cleanupJobsForArrInstance } from '$lib/server/jobs/cleanup.ts';
import {
	scheduleCleanupForInstance,
	scheduleLibraryRefreshForInstance
} from '$lib/server/jobs/init.ts';
import { calculateNextRun } from '$lib/server/jobs/scheduleUtils.ts';
import { enqueueJob } from '$lib/server/jobs/queueService.ts';
import { logger } from '$logger/logger.ts';

export const load = ({ params }) => {
	const id = parseInt(params.id || '', 10);
	const cleanupSettings = arrCleanupSettingsQueries.getByInstanceId(id);
	return { cleanupSettings: cleanupSettings ?? null };
};

export const actions: Actions = {
	update: async ({ params, request }) => {
		const id = parseInt(params.id || '', 10);

		// Validate ID
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid instance ID' });
		}

		// Fetch the instance to verify it exists
		const instance = arrInstancesQueries.getById(id);

		if (!instance) {
			return fail(404, { error: 'Instance not found' });
		}

		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim();
		const url = formData.get('url')?.toString().trim();
		const apiKey = formData.get('api_key')?.toString().trim() || instance.api_key;
		const tagsJson = formData.get('tags')?.toString() || '';
		const enabled = formData.get('enabled')?.toString() === '1';
		const libraryRefreshInterval =
			parseInt(formData.get('library_refresh_interval')?.toString() || '0', 10) || 0;

		// Validate required fields
		if (!name) {
			return fail(400, { error: 'Name is required' });
		}

		if (!url) {
			return fail(400, { error: 'URL is required' });
		}

		// Check for duplicate name
		if (arrInstancesQueries.nameExists(name, id)) {
			return fail(400, { error: 'An instance with this name already exists' });
		}

		// Check if API key already exists (each Arr instance has a unique API key)
		if (arrInstancesQueries.apiKeyExists(apiKey, id)) {
			return fail(400, { error: 'This instance is already connected' });
		}

		// Parse tags
		let tags: string[] = [];
		if (tagsJson) {
			try {
				tags = JSON.parse(tagsJson);
			} catch {
				// Ignore parse errors, use empty array
			}
		}

		try {
			arrInstancesQueries.update(id, {
				name,
				url,
				apiKey,
				tags,
				enabled,
				libraryRefreshInterval
			});

			scheduleLibraryRefreshForInstance(id);

			const cleanup = arrCleanupSettingsQueries.getByInstanceId(id);
			await logger.info(`Updated arr instance: ${name}`, {
				source: 'arr/[id]/settings',
				meta: {
					id,
					name,
					type: instance.type,
					url,
					libraryRefreshInterval,
					cleanup: cleanup ? { enabled: cleanup.enabled, cron: cleanup.cron } : null
				}
			});

			return { success: true };
		} catch (err) {
			await logger.error('Failed to update arr instance', {
				source: 'arr/[id]/settings',
				meta: { error: err instanceof Error ? err.message : String(err) }
			});

			return fail(500, { error: 'Failed to update instance' });
		}
	},

	updateCleanup: async ({ params, request }) => {
		const id = parseInt(params.id || '', 10);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid instance ID' });
		}

		const formData = await request.formData();
		const enabled = formData.get('enabled')?.toString() === '1';
		const cron = formData.get('cron')?.toString() || '0 0 * * 0';

		try {
			arrCleanupSettingsQueries.upsert(id, { enabled, cron });

			const nextRunAt = calculateNextRun(cron);
			if (nextRunAt) arrCleanupSettingsQueries.updateNextRunAt(id, nextRunAt);

			scheduleCleanupForInstance(id);

			return { success: true };
		} catch (err) {
			await logger.error('Failed to save cleanup settings', {
				source: 'arr/[id]/settings',
				meta: { error: err instanceof Error ? err.message : String(err) }
			});
			return fail(500, { error: 'Failed to save cleanup settings' });
		}
	},

	runCleanupNow: async ({ params, request }) => {
		const id = parseInt(params.id || '', 10);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid instance ID' });
		}

		const instance = arrInstancesQueries.getById(id);
		if (!instance) {
			return fail(404, { error: 'Instance not found' });
		}

		if (instance.type !== 'radarr' && instance.type !== 'sonarr') {
			return fail(400, { error: `Cleanup not supported for ${instance.type}` });
		}

		const formData = await request.formData();
		const preScannedRaw = formData.get('preScanned')?.toString();
		let preScanned: unknown;
		if (preScannedRaw) {
			try {
				preScanned = JSON.parse(preScannedRaw);
			} catch {
				return fail(400, { error: 'Invalid preScanned data' });
			}
		}

		try {
			const queued = enqueueJob({
				jobType: 'arr.cleanup',
				runAt: new Date().toISOString(),
				payload: { instanceId: id, preScanned },
				source: 'manual'
			});

			await logger.info('Manual cleanup run queued', {
				source: 'arr/[id]/settings',
				meta: { jobId: queued.id, instanceId: id, instanceName: instance.name }
			});

			return { success: true, queued: true };
		} catch (err) {
			await logger.error('Manual cleanup run failed', {
				source: 'arr/[id]/settings',
				meta: { instanceId: id, error: err instanceof Error ? err.message : String(err) }
			});
			return fail(500, { error: 'Cleanup run failed. Check logs for details.' });
		}
	},

	delete: async ({ params }) => {
		const id = parseInt(params.id || '', 10);

		// Validate ID
		if (isNaN(id)) {
			await logger.warn('Delete failed: Invalid instance ID', {
				source: 'arr/[id]/settings',
				meta: { id: params.id }
			});
			return fail(400, { error: 'Invalid instance ID' });
		}

		// Fetch the instance to verify it exists
		const instance = arrInstancesQueries.getById(id);

		if (!instance) {
			await logger.warn('Delete failed: Instance not found', {
				source: 'arr/[id]/settings',
				meta: { id }
			});
			return fail(404, { error: 'Instance not found' });
		}

		cleanupJobsForArrInstance(id);

		// Delete the instance
		const deleted = arrInstancesQueries.delete(id);

		if (!deleted) {
			await logger.error('Failed to delete instance', {
				source: 'arr/[id]/settings',
				meta: { id, name: instance.name, type: instance.type }
			});
			return fail(500, { error: 'Failed to delete instance' });
		}

		await logger.info(`Deleted ${instance.type} instance: ${instance.name}`, {
			source: 'arr/[id]/settings',
			meta: { id, name: instance.name, type: instance.type, url: instance.url }
		});

		// Redirect to the arr landing page
		redirect(303, '/arr');
	}
};
