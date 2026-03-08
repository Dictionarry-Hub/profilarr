import { error, redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { pcdManager } from '$pcd/core/manager.ts';
import { canWriteToBase } from '$pcd/ops/writer.ts';
import type { OperationLayer } from '$pcd/core/types.ts';
import type { ArrType } from '$shared/pcd/types.ts';
import type { PropersRepacks } from '$shared/pcd/mediaManagement.ts';
import {
	createRadarrMediaSettings,
	createSonarrMediaSettings
} from '$pcd/entities/mediaManagement/media-settings/index.ts';

export const load: PageServerLoad = async ({ parent }) => {
	const parentData = await parent();
	return {
		canWriteToBase: parentData.canWriteToBase
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

		if (!name?.trim()) {
			return fail(400, { error: 'Name is required' });
		}

		if (!arrType || (arrType !== 'radarr' && arrType !== 'sonarr')) {
			return fail(400, { error: 'Invalid arr type' });
		}

		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer without personal access token' });
		}

		const propersRepacks = formData.get('propersRepacks') as PropersRepacks;
		const enableMediaInfo = formData.get('enableMediaInfo') === 'true';

		const createFn = arrType === 'radarr' ? createRadarrMediaSettings : createSonarrMediaSettings;

		let result;
		try {
			result = await createFn({
				databaseId: currentDatabaseId,
				cache,
				layer,
				input: {
					name: name.trim(),
					propersRepacks: propersRepacks || 'doNotPrefer',
					enableMediaInfo
				}
			});
		} catch (err) {
			const message =
				err instanceof Error ? err.message : `Failed to create ${arrType} media settings`;
			if (message.includes('already exists')) {
				return fail(400, { error: message });
			}
			return fail(500, { error: message });
		}

		if (!result.success) {
			return fail(500, { error: result.error || `Failed to create ${arrType} media settings` });
		}

		throw redirect(303, `/media-management/${databaseId}/media-settings`);
	}
};
