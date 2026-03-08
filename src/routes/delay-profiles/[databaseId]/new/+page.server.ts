import { error, redirect, fail } from '@sveltejs/kit';
import type { ServerLoad, Actions } from '@sveltejs/kit';
import { pcdManager } from '$pcd/core/manager.ts';
import { canWriteToBase } from '$pcd/ops/writer.ts';
import * as delayProfileQueries from '$pcd/entities/delayProfiles/index.ts';
import type { OperationLayer } from '$pcd/core/types.ts';
import type { PreferredProtocol } from '$shared/pcd/display.ts';
import { logger } from '$logger/logger.ts';

export const load: ServerLoad = ({ params }) => {
	const { databaseId } = params;

	if (!databaseId) {
		throw error(400, 'Missing database ID');
	}

	const currentDatabaseId = parseInt(databaseId, 10);
	if (isNaN(currentDatabaseId)) {
		throw error(400, 'Invalid database ID');
	}

	const currentDatabase = pcdManager.getByIdPublic(currentDatabaseId);
	if (!currentDatabase) {
		throw error(404, 'Database not found');
	}

	return {
		currentDatabase,
		canWriteToBase: canWriteToBase(currentDatabaseId)
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

		// Parse form data
		const name = formData.get('name') as string;
		const preferredProtocol = formData.get('preferredProtocol') as PreferredProtocol;
		const usenetDelay = parseInt(formData.get('usenetDelay') as string, 10) || 0;
		const torrentDelay = parseInt(formData.get('torrentDelay') as string, 10) || 0;
		const bypassIfHighestQuality = formData.get('bypassIfHighestQuality') === 'true';
		const bypassIfAboveCfScore = formData.get('bypassIfAboveCfScore') === 'true';
		const minimumCfScore = parseInt(formData.get('minimumCfScore') as string, 10) || 0;
		const layerFromForm = formData.get('layer');
		const layer = (layerFromForm as OperationLayer) || 'user';

		await logger.debug('Create action received', {
			source: 'DelayProfileCreate',
			meta: {
				profileName: name,
				layerFromForm,
				layerUsed: layer
			}
		});

		// Validate
		if (!name?.trim()) {
			return fail(400, { error: 'Name is required' });
		}

		// Check layer permission
		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer without personal access token' });
		}

		// Create the delay profile
		let result;
		try {
			result = await delayProfileQueries.create({
				databaseId: currentDatabaseId,
				cache,
				layer,
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
			const message = err instanceof Error ? err.message : 'Failed to create delay profile';
			if (message.includes('already exists')) {
				return fail(400, { error: message });
			}
			return fail(500, { error: message });
		}

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to create delay profile' });
		}

		throw redirect(303, `/delay-profiles/${databaseId}`);
	}
};
