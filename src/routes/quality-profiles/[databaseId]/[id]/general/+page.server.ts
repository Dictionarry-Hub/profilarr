import { error, redirect, fail } from '@sveltejs/kit';
import type { ServerLoad, Actions } from '@sveltejs/kit';
import { pcdManager } from '$pcd/core/manager.ts';
import { canWriteToBase } from '$pcd/ops/writer.ts';
import * as qualityProfileQueries from '$pcd/entities/qualityProfiles/index.ts';
import { getRadarrLanguages } from '$lib/server/sync/mappings.ts';
import type { OperationLayer } from '$pcd/core/types.ts';
import { arrSyncQueries } from '$db/queries/arrSync.ts';
import { getAffectedArrs } from '$lib/server/sync/affectedArrs.ts';

export const load: ServerLoad = async ({ params }) => {
	const { databaseId, id } = params;

	// Validate params exist
	if (!databaseId || !id) {
		throw error(400, 'Missing required parameters');
	}

	// Parse and validate the database ID
	const currentDatabaseId = parseInt(databaseId, 10);
	if (isNaN(currentDatabaseId)) {
		throw error(400, 'Invalid database ID');
	}

	// Parse and validate the profile ID
	const profileId = parseInt(id, 10);
	if (isNaN(profileId)) {
		throw error(400, 'Invalid profile ID');
	}

	// Get current database
	const currentDatabase = pcdManager.getByIdPublic(currentDatabaseId);
	if (!currentDatabase) {
		throw error(404, 'Database not found');
	}

	// Get the cache for the database
	const cache = pcdManager.getCache(currentDatabaseId);
	if (!cache) {
		throw error(500, 'Database cache not available');
	}

	// Load general information for the quality profile
	const profile = await qualityProfileQueries.general(cache, profileId);

	if (!profile) {
		throw error(404, 'Quality profile not found');
	}

	// Get Radarr languages (language field is Radarr-only)
	const availableLanguages = getRadarrLanguages();

	return {
		currentDatabase,
		profile,
		availableLanguages,
		canWriteToBase: canWriteToBase(currentDatabaseId)
	};
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const { databaseId, id } = params;

		if (!databaseId || !id) {
			return fail(400, { error: 'Missing parameters' });
		}

		const currentDatabaseId = parseInt(databaseId, 10);
		const profileId = parseInt(id, 10);

		if (isNaN(currentDatabaseId) || isNaN(profileId)) {
			return fail(400, { error: 'Invalid parameters' });
		}

		const cache = pcdManager.getCache(currentDatabaseId);
		if (!cache) {
			return fail(500, { error: 'Database cache not available' });
		}

		// Get current profile for value guards
		const current = await qualityProfileQueries.general(cache, profileId);
		if (!current) {
			return fail(404, { error: 'Quality profile not found' });
		}

		const formData = await request.formData();

		// Parse form data
		const name = formData.get('name') as string;
		const description = (formData.get('description') as string) || '';
		const tagsJson = formData.get('tags') as string;
		const languageRaw = formData.get('language') as string;
		const language = languageRaw && languageRaw.trim() !== '' ? languageRaw.trim() : null;
		const layer = (formData.get('layer') as OperationLayer) || 'user';

		// Validate
		if (!name?.trim()) {
			return fail(400, { error: 'Name is required' });
		}

		// Duplicate name checks are enforced at the entity layer.

		let tags: string[] = [];
		try {
			tags = JSON.parse(tagsJson || '[]');
		} catch {
			return fail(400, { error: 'Invalid tags format' });
		}

		// Check layer permission
		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer without personal access token' });
		}

		// Update the quality profile
		let result;
		try {
			result = await qualityProfileQueries.updateGeneral({
				databaseId: currentDatabaseId,
				cache,
				layer,
				current,
				input: {
					name: name.trim(),
					description: description.trim(),
					tags,
					language
				}
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to update quality profile';
			if (message.includes('already exists')) {
				return fail(400, { error: message });
			}
			return fail(500, { error: message });
		}

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to update quality profile' });
		}

		if (name.trim() !== current.name) {
			arrSyncQueries.updateQualityProfileName(current.name, name.trim());
		}

		const affectedArrs = getAffectedArrs({
			entityType: 'qualityProfile',
			databaseId: currentDatabaseId,
			entityName: name.trim()
		});

		return {
			success: true,
			redirectTo: `/quality-profiles/${databaseId}/${id}/general`,
			affectedArrs
		};
	},

	delete: async ({ request, params }) => {
		const { databaseId, id } = params;

		if (!databaseId || !id) {
			return fail(400, { error: 'Missing parameters' });
		}

		const currentDatabaseId = parseInt(databaseId, 10);
		const profileId = parseInt(id, 10);

		if (isNaN(currentDatabaseId) || isNaN(profileId)) {
			return fail(400, { error: 'Invalid parameters' });
		}

		const cache = pcdManager.getCache(currentDatabaseId);
		if (!cache) {
			return fail(500, { error: 'Database cache not available' });
		}

		// Get current profile for value guards
		const current = await qualityProfileQueries.general(cache, profileId);
		if (!current) {
			return fail(404, { error: 'Quality profile not found' });
		}

		const formData = await request.formData();
		const layer = (formData.get('layer') as OperationLayer) || 'user';

		// Check layer permission
		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer without personal access token' });
		}

		// Delete the quality profile
		const result = await qualityProfileQueries.remove({
			databaseId: currentDatabaseId,
			cache,
			layer,
			profileId,
			profileName: current.name
		});

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to delete quality profile' });
		}

		throw redirect(303, `/quality-profiles/${databaseId}`);
	}
};
