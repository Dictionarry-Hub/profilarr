import { error, redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { pcdManager } from '$pcd/core/manager.ts';
import { canWriteToBase } from '$pcd/ops/writer.ts';
import type { OperationLayer } from '$pcd/core/types.ts';
import {
	getSonarrByName,
	getAvailableQualities
} from '$pcd/entities/mediaManagement/quality-definitions/read.ts';
import {
	updateSonarrQualityDefinitions,
	removeSonarrQualityDefinitions
} from '$pcd/entities/mediaManagement/quality-definitions/index.ts';
import { arrSyncQueries } from '$db/queries/arrSync.ts';
import { getAffectedArrs } from '$lib/server/sync/affectedArrs.ts';

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
	const qualityDefinitionsConfig = await getSonarrByName(cache, decodedName);

	if (!qualityDefinitionsConfig) {
		throw error(404, 'Quality definitions config not found');
	}

	const availableQualities = await getAvailableQualities(cache, 'sonarr');
	const parentData = await parent();

	return {
		qualityDefinitionsConfig,
		availableQualities,
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
		const current = await getSonarrByName(cache, decodedName);
		if (!current) {
			return fail(404, { error: 'Quality definitions config not found' });
		}

		const formData = await request.formData();
		const newName = formData.get('name') as string;
		const layer = (formData.get('layer') as OperationLayer) || 'user';
		const entriesJson = formData.get('entries') as string;

		if (!newName?.trim()) {
			return fail(400, { error: 'Name is required' });
		}

		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer without personal access token' });
		}

		let entries;
		try {
			entries = JSON.parse(entriesJson || '[]');
		} catch {
			return fail(400, { error: 'Invalid entries data' });
		}

		let result;
		try {
			result = await updateSonarrQualityDefinitions({
				databaseId: currentDatabaseId,
				cache,
				layer,
				current,
				input: {
					name: newName.trim(),
					entries
				}
			});
		} catch (err) {
			const message =
				err instanceof Error ? err.message : 'Failed to update quality definitions config';
			if (message.includes('already exists') || message.toLowerCase().includes('duplicate')) {
				return fail(400, { error: message });
			}
			return fail(500, { error: message });
		}

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to update quality definitions config' });
		}

		if (newName.trim() !== decodedName) {
			arrSyncQueries.updateQualityDefinitionsConfigName(decodedName, newName.trim());
		}

		const affectedArrs = getAffectedArrs({
			entityType: 'qualityDefinitions',
			databaseId: currentDatabaseId,
			entityName: newName.trim()
		});

		return {
			success: true,
			redirectTo: `/media-management/${databaseId}/quality-definitions`,
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
		const current = await getSonarrByName(cache, decodedName);
		if (!current) {
			return fail(404, { error: 'Quality definitions config not found' });
		}

		const formData = await request.formData();
		const layer = (formData.get('layer') as OperationLayer) || 'user';

		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer without personal access token' });
		}

		const result = await removeSonarrQualityDefinitions({
			databaseId: currentDatabaseId,
			cache,
			layer,
			current
		});

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to delete quality definitions config' });
		}

		throw redirect(303, `/media-management/${databaseId}/quality-definitions`);
	}
};
