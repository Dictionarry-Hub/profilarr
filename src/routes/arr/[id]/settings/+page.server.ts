import { redirect, fail } from '@sveltejs/kit';
import type { Actions } from '@sveltejs/kit';
import { arrInstancesQueries } from '#db/queries/arrInstances.ts';
import { arrCleanupSettingsQueries } from '#db/queries/arrCleanupSettings.ts';
import { scheduleCleanupForInstance } from '#server/jobs/init.ts';
import { calculateNextRun } from '#server/jobs/scheduleUtils.ts';
import { enqueueJob } from '#server/jobs/queueService.ts';
import { logger } from '#logger/logger.ts';
import { deleteArrInstance, updateArrInstance } from '#server/arr_instances/service.ts';

function parseTags(json: string | undefined): string[] {
	if (!json) return [];

	try {
		const parsed = JSON.parse(json);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export const load = ({ params }) => {
	const id = parseInt(params.id || '', 10);
	const cleanupSettings = arrCleanupSettingsQueries.getByInstanceId(id);
	const instance = arrInstancesQueries.getById(id);
	return {
		cleanupSettings: cleanupSettings ?? null,
		// Whether Basic Auth is saved, never the values themselves
		hasBasicAuth: !!instance?.basic_auth_username && !!instance?.basic_auth_password
	};
};

export const actions: Actions = {
	update: async ({ params, request }) => {
		const id = parseInt(params.id || '', 10);
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid instance ID' });
		}

		const formData = await request.formData();
		const text = (key: string) => formData.get(key)?.toString();

		// A blank API key keeps the stored one. Basic Auth only counts when the form says it
		// was touched, since the form never receives the stored values.
		const raw: Record<string, unknown> = {
			name: text('name'),
			url: text('url'),
			external_url: text('external_url') ?? '',
			tags: parseTags(text('tags')),
			library_refresh_interval: parseInt(text('library_refresh_interval') || '0', 10) || 0
		};
		if (text('api_key')?.trim()) raw.api_key = text('api_key');
		if (text('basic_auth_username_touched') === '1') {
			raw.basic_auth_username = text('basic_auth_username') ?? '';
		}
		if (text('basic_auth_password_touched') === '1') {
			raw.basic_auth_password = text('basic_auth_password') ?? '';
		}

		const result = await updateArrInstance(id, raw);
		if (!result.ok) {
			return fail(result.kind === 'not_found' ? 404 : result.kind === 'failed' ? 500 : 400, {
				error: result.message
			});
		}

		return { success: true, basicAuthCleared: result.basicAuthCleared };
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
		if (isNaN(id)) {
			return fail(400, { error: 'Invalid instance ID' });
		}

		const result = await deleteArrInstance(id);
		if (!result.ok) {
			return fail(result.kind === 'not_found' ? 404 : 500, { error: result.message });
		}

		redirect(303, '/arr');
	}
};
