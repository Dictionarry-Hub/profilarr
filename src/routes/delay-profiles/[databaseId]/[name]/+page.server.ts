import { error, redirect, fail } from '@sveltejs/kit';
import type { ServerLoad, Actions } from '@sveltejs/kit';
import { pcdManager } from '$pcd/core/manager.ts';
import { canWriteToBase } from '$pcd/ops/writer.ts';
import * as delayProfileQueries from '$pcd/entities/delayProfiles/index.ts';
import type { OperationLayer } from '$pcd/core/types.ts';
import type { PreferredProtocol } from '$shared/pcd/display.ts';
import { logger } from '$logger/logger.ts';
import { arrSyncQueries } from '$db/queries/arrSync.ts';
import { getAffectedArrs } from '$lib/server/sync/affectedArrs.ts';

export const load: ServerLoad = async ({ params }) => {
	const { databaseId, name } = params;

	if (!databaseId || !name) {
		throw error(400, 'Missing parameters');
	}

	const currentDatabaseId = parseInt(databaseId, 10);
	if (isNaN(currentDatabaseId)) {
		throw error(400, 'Invalid database ID');
	}

	const currentDatabase = pcdManager.getByIdPublic(currentDatabaseId);
	if (!currentDatabase) {
		throw error(404, 'Database not found');
	}

	const cache = pcdManager.getCache(currentDatabaseId);
	if (!cache) {
		throw error(500, 'Database cache not available');
	}

	const decodedName = decodeURIComponent(name);
	const delayProfile = await delayProfileQueries.getByName(cache, decodedName);
	if (!delayProfile) {
		throw error(404, 'Delay profile not found');
	}

	return {
		currentDatabase,
		delayProfile,
		canWriteToBase: canWriteToBase(currentDatabaseId)
	};
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const { databaseId, name: paramName } = params;

		if (!databaseId || !paramName) {
			return fail(400, { error: 'Missing parameters' });
		}

		const currentDatabaseId = parseInt(databaseId, 10);
		if (isNaN(currentDatabaseId)) {
			return fail(400, { error: 'Invalid database ID' });
		}

		const cache = pcdManager.getCache(currentDatabaseId);
		if (!cache) {
			return fail(500, { error: 'Database cache not available' });
		}

		// Get current profile for value guards
		const decodedName = decodeURIComponent(paramName);
		const current = await delayProfileQueries.getByName(cache, decodedName);
		if (!current) {
			return fail(404, { error: 'Delay profile not found' });
		}

		const formData = await request.formData();

		// Parse form data
		const name = formData.get('name') as string;
		const preferredProtocol = formData.get('preferredProtocol') as PreferredProtocol;
		const usenetDelay = parseInt(formData.get('usenetDelay') as string, 10) || 0;
		const torrentDelay = parseInt(formData.get('torrentDelay') as string, 10) || 0;
		const bypassIfHighestQuality = formData.get('bypassIfHighestQuality') === 'true';
		const bypassIfAboveCfScore = formData.get('bypassIfAboveCfScore') === 'true';
		const minimumCfScore = parseInt(formData.get('minimumCfScore') as string, 10) || 0;
		const layer = (formData.get('layer') as OperationLayer) || 'user';

		// Validate
		if (!name?.trim()) {
			return fail(400, { error: 'Name is required' });
		}

		// Check layer permission
		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer without personal access token' });
		}

		// Update the delay profile
		let result;
		try {
			result = await delayProfileQueries.update({
				databaseId: currentDatabaseId,
				cache,
				layer,
				current,
				input: {
					name: name.trim(),
					preferredProtocol,
					usenetDelay,
					torrentDelay,
					bypassIfHighestQuality,
					bypassIfAboveCfScore,
					minimumCfScore
				}
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to update delay profile';
			if (message.includes('already exists')) {
				return fail(400, { error: message });
			}
			return fail(500, { error: message });
		}

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to update delay profile' });
		}

		if (name.trim() !== current.name) {
			arrSyncQueries.updateDelayProfileName(current.name, name.trim());
		}

		const affectedArrs = getAffectedArrs({
			entityType: 'delayProfile',
			databaseId: currentDatabaseId,
			entityName: name.trim()
		});

		return {
			success: true,
			redirectTo: `/delay-profiles/${databaseId}`,
			affectedArrs
		};
	},

	delete: async ({ request, params }) => {
		const { databaseId, name: paramName } = params;

		if (!databaseId || !paramName) {
			return fail(400, { error: 'Missing parameters' });
		}

		const currentDatabaseId = parseInt(databaseId, 10);
		if (isNaN(currentDatabaseId)) {
			return fail(400, { error: 'Invalid database ID' });
		}

		const cache = pcdManager.getCache(currentDatabaseId);
		if (!cache) {
			return fail(500, { error: 'Database cache not available' });
		}

		// Get current profile for value guards
		const decodedName = decodeURIComponent(paramName);
		const current = await delayProfileQueries.getByName(cache, decodedName);
		if (!current) {
			return fail(404, { error: 'Delay profile not found' });
		}

		const formData = await request.formData();
		const layerFromForm = formData.get('layer');
		const layer = (layerFromForm as OperationLayer) || 'user';

		await logger.debug('Delete action received', {
			source: 'DelayProfileDelete',
			meta: {
				profileName: current.name,
				layerFromForm,
				layerUsed: layer
			}
		});

		// Check layer permission
		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer without personal access token' });
		}

		const result = await delayProfileQueries.remove({
			databaseId: currentDatabaseId,
			cache,
			layer,
			current
		});

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to delete delay profile' });
		}

		throw redirect(303, `/delay-profiles/${databaseId}`);
	}
};
