import { error, redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { pcdManager } from '$pcd/core/manager.ts';
import { canWriteToBase } from '$pcd/ops/writer.ts';
import type { OperationLayer } from '$pcd/core/types.ts';
import type { ArrType } from '$shared/pcd/types.ts';
import { getAvailableQualities } from '$pcd/entities/mediaManagement/quality-definitions/read.ts';
import {
	createRadarrQualityDefinitions,
	createSonarrQualityDefinitions
} from '$pcd/entities/mediaManagement/quality-definitions/index.ts';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { databaseId } = params;

	if (!databaseId) {
		throw error(400, 'Missing database ID');
	}

	const currentDatabaseId = parseInt(databaseId, 10);
	if (isNaN(currentDatabaseId)) {
		throw error(400, 'Invalid database ID');
	}

	const cache = pcdManager.getCache(currentDatabaseId);
	if (!cache) {
		throw error(500, 'Database cache not available');
	}

	// Get available qualities for both arr types
	const radarrQualities = await getAvailableQualities(cache, 'radarr');
	const sonarrQualities = await getAvailableQualities(cache, 'sonarr');

	const parentData = await parent();

	return {
		canWriteToBase: parentData.canWriteToBase,
		radarrQualities,
		sonarrQualities
	};
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const { databaseId } = params;

		if (!databaseId) {
			return fail(400, { error: 'Missing database ID' });
		}

		const currentDatabaseId = parseInt(databaseId, 10);
		if (isNaN(currentDatabaseId)) {
			return fail(400, { error: 'Invalid database ID' });
		}

		const cache = pcdManager.getCache(currentDatabaseId);
		if (!cache) {
			return fail(500, { error: 'Database cache not available' });
		}

		const formData = await request.formData();
		const arrType = formData.get('arrType') as ArrType;
		const name = formData.get('name') as string;
		const layer = (formData.get('layer') as OperationLayer) || 'user';
		const entriesJson = formData.get('entries') as string;

		if (!name?.trim()) {
			return fail(400, { error: 'Name is required' });
		}

		if (!arrType || (arrType !== 'radarr' && arrType !== 'sonarr')) {
			return fail(400, { error: 'Invalid arr type' });
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

		if (!Array.isArray(entries) || entries.length === 0) {
			return fail(400, { error: 'At least one quality definition is required' });
		}

		const createFn =
			arrType === 'radarr' ? createRadarrQualityDefinitions : createSonarrQualityDefinitions;

		let result;
		try {
			result = await createFn({
				databaseId: currentDatabaseId,
				cache,
				layer,
				input: {
					name: name.trim(),
					entries
				}
			});
		} catch (err) {
			const message =
				err instanceof Error ? err.message : `Failed to create ${arrType} quality definitions`;
			if (message.includes('already exists') || message.toLowerCase().includes('duplicate')) {
				return fail(400, { error: message });
			}
			return fail(500, { error: message });
		}

		if (!result.success) {
			return fail(500, {
				error: result.error || `Failed to create ${arrType} quality definitions`
			});
		}

		throw redirect(303, `/media-management/${databaseId}/quality-definitions`);
	}
};
