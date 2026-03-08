import { error, redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { pcdManager } from '$pcd/core/manager.ts';
import { canWriteToBase } from '$pcd/ops/writer.ts';
import type { OperationLayer } from '$pcd/core/types.ts';
import {
	getRadarrByName,
	updateRadarrNaming,
	removeRadarrNaming
} from '$pcd/entities/mediaManagement/naming/index.ts';
import { arrSyncQueries } from '$db/queries/arrSync.ts';
import { getAffectedArrs } from '$lib/server/sync/affectedArrs.ts';
import type { RadarrNamingRow } from '$shared/pcd/display.ts';
import { validateNamingFormat } from '$shared/pcd/namingTokens.ts';

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
	const namingConfig = await getRadarrByName(cache, decodedName);

	if (!namingConfig) {
		throw error(404, 'Naming config not found');
	}

	const parentData = await parent();

	return {
		namingConfig,
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
			return fail(404, { error: 'Naming config not found' });
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

		const rename = formData.get('rename') === 'true';
		const movieFormat = formData.get('movieFormat') as string;
		const movieFolderFormat = formData.get('movieFolderFormat') as string;
		const replaceIllegalCharacters = formData.get('replaceIllegalCharacters') === 'true';
		const colonReplacementFormat = formData.get(
			'colonReplacementFormat'
		) as RadarrNamingRow['colon_replacement_format'];

		const movieFormatValidation = validateNamingFormat(movieFormat || '', 'radarr');
		if (!movieFormatValidation.valid) {
			return fail(400, { error: `Movie format: ${movieFormatValidation.errors.join(', ')}` });
		}
		const folderFormatValidation = validateNamingFormat(movieFolderFormat || '', 'radarr');
		if (!folderFormatValidation.valid) {
			return fail(400, { error: `Folder format: ${folderFormatValidation.errors.join(', ')}` });
		}

		let result;
		try {
			result = await updateRadarrNaming({
				databaseId: currentDatabaseId,
				cache,
				layer,
				current,
				input: {
					name: newName.trim(),
					rename,
					movieFormat: movieFormat || '',
					movieFolderFormat: movieFolderFormat || '',
					replaceIllegalCharacters,
					colonReplacementFormat: colonReplacementFormat || 'delete'
				}
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to update naming config';
			if (message.includes('already exists')) {
				return fail(400, { error: message });
			}
			return fail(500, { error: message });
		}

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to update naming config' });
		}

		if (newName.trim() !== decodedName) {
			arrSyncQueries.updateNamingConfigName(decodedName, newName.trim());
		}

		const affectedArrs = getAffectedArrs({
			entityType: 'naming',
			databaseId: currentDatabaseId,
			entityName: newName.trim()
		});

		return {
			success: true,
			redirectTo: `/media-management/${databaseId}/naming`,
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
			return fail(404, { error: 'Naming config not found' });
		}

		const formData = await request.formData();
		const layer = (formData.get('layer') as OperationLayer) || 'user';

		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer without personal access token' });
		}

		const result = await removeRadarrNaming({
			databaseId: currentDatabaseId,
			cache,
			layer,
			current
		});

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to delete naming config' });
		}

		throw redirect(303, `/media-management/${databaseId}/naming`);
	}
};
