import { error, redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { pcdManager } from '$pcd/core/manager.ts';
import { canWriteToBase } from '$pcd/ops/writer.ts';
import type { OperationLayer } from '$pcd/core/types.ts';
import {
	getRadarrByName,
	updateRadarrMediaSettings,
	removeRadarrMediaSettings
} from '$pcd/entities/mediaManagement/media-settings/index.ts';
import { arrSyncQueries } from '$db/queries/arrSync.ts';
import { getAffectedArrs } from '$lib/server/sync/affectedArrs.ts';
import type { PropersRepacks } from '$shared/pcd/mediaManagement.ts';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { databaseId, name } = params;

	if (!databaseId || !name) {
		throw error(400, 'Missing parameters');
	}

	const currentDatabaseId = parseInt(databaseId, 10);
	if (isNaN(currentDatabaseId)) {
		throw error(400, 'Invalid database ID');
	}

	const cache = pcdManager.getCache(currentDatabaseId);
	if (!cache) {
		throw error(500, 'Database cache not available');
	}

	const decodedName = decodeURIComponent(name);
	const mediaSettingsConfig = await getRadarrByName(cache, decodedName);

	if (!mediaSettingsConfig) {
		throw error(404, 'Media settings config not found');
	}

	const parentData = await parent();

	return {
		mediaSettingsConfig,
		canWriteToBase: parentData.canWriteToBase
	};
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const { databaseId, name } = params;

		if (!databaseId || !name) {
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

		const decodedName = decodeURIComponent(name);
		const current = await getRadarrByName(cache, decodedName);
		if (!current) {
			return fail(404, { error: 'Media settings config not found' });
		}

		const formData = await request.formData();
		const newName = formData.get('name') as string;
		const layer = (formData.get('layer') as OperationLayer) || 'user';

		if (!newName?.trim()) {
			return fail(400, { error: 'Name is required' });
		}

		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer without personal access token' });
		}

		const propersRepacks = formData.get('propersRepacks') as PropersRepacks;
		const enableMediaInfo = formData.get('enableMediaInfo') === 'true';

		let result;
		try {
			result = await updateRadarrMediaSettings({
				databaseId: currentDatabaseId,
				cache,
				layer,
				current,
				input: {
					name: newName.trim(),
					propersRepacks: propersRepacks || 'doNotPrefer',
					enableMediaInfo
				}
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to update media settings config';
			if (message.includes('already exists')) {
				return fail(400, { error: message });
			}
			return fail(500, { error: message });
		}

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to update media settings config' });
		}

		if (newName.trim() !== decodedName) {
			arrSyncQueries.updateMediaSettingsConfigName(decodedName, newName.trim());
		}

		const affectedArrs = getAffectedArrs({
			entityType: 'mediaSettings',
			databaseId: currentDatabaseId,
			entityName: newName.trim()
		});

		return {
			success: true,
			redirectTo: `/media-management/${databaseId}/media-settings`,
			affectedArrs
		};
	},

	delete: async ({ request, params }) => {
		const { databaseId, name } = params;

		if (!databaseId || !name) {
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

		const decodedName = decodeURIComponent(name);
		const current = await getRadarrByName(cache, decodedName);
		if (!current) {
			return fail(404, { error: 'Media settings config not found' });
		}

		const formData = await request.formData();
		const layer = (formData.get('layer') as OperationLayer) || 'user';

		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer without personal access token' });
		}

		const result = await removeRadarrMediaSettings({
			databaseId: currentDatabaseId,
			cache,
			layer,
			current
		});

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to delete media settings config' });
		}

		throw redirect(303, `/media-management/${databaseId}/media-settings`);
	}
};
