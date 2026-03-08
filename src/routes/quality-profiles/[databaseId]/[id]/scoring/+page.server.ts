import { error, fail } from '@sveltejs/kit';
import type { ServerLoad, Actions } from '@sveltejs/kit';
import { pcdManager } from '$pcd/core/manager.ts';
import { canWriteToBase } from '$pcd/ops/writer.ts';
import * as qualityProfileQueries from '$pcd/entities/qualityProfiles/index.ts';
import type { OperationLayer } from '$pcd/core/types.ts';
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

	// Get the cache for the database
	const cache = pcdManager.getCache(currentDatabaseId);
	if (!cache) {
		throw error(500, 'Database cache not available');
	}

	// Get profile name from ID
	const profile = await cache.kb
		.selectFrom('quality_profiles')
		.select('name')
		.where('id', '=', profileId)
		.executeTakeFirst();

	if (!profile) {
		throw error(404, 'Quality profile not found');
	}

	const scoringData = await qualityProfileQueries.scoring(cache, currentDatabaseId, profile.name);

	return {
		scoring: scoringData,
		profileName: profile.name,
		canWriteToBase: canWriteToBase(currentDatabaseId)
	};
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const { databaseId, id } = params;

		if (!databaseId || !id) {
			return fail(400, { error: 'Missing required parameters' });
		}

		const currentDatabaseId = parseInt(databaseId, 10);
		if (isNaN(currentDatabaseId)) {
			return fail(400, { error: 'Invalid database ID' });
		}

		const profileId = parseInt(id, 10);
		if (isNaN(profileId)) {
			return fail(400, { error: 'Invalid profile ID' });
		}

		const cache = pcdManager.getCache(currentDatabaseId);
		if (!cache) {
			return fail(500, { error: 'Database cache not available' });
		}

		const formData = await request.formData();

		// Parse form data
		const minimumScore = parseInt(formData.get('minimumScore') as string, 10) || 0;
		const upgradeUntilScore = parseInt(formData.get('upgradeUntilScore') as string, 10) || 0;
		const upgradeScoreIncrement =
			parseInt(formData.get('upgradeScoreIncrement') as string, 10) || 1;
		const layer = (formData.get('layer') as OperationLayer) || 'user';
		const customFormatScoresJson = formData.get('customFormatScores') as string;

		// Validate upgrade score increment
		if (upgradeScoreIncrement < 1) {
			return fail(400, { error: 'Upgrade score increment must be at least 1' });
		}

		// Check layer permission
		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer without personal access token' });
		}

		// Parse custom format scores
		let customFormatScores: Array<{
			customFormatName: string;
			arrType: string;
			score: number | null;
		}> = [];
		try {
			customFormatScores = JSON.parse(customFormatScoresJson || '[]');
		} catch {
			return fail(400, { error: 'Invalid custom format scores format' });
		}

		// Get profile name for metadata
		const profile = await cache.kb
			.selectFrom('quality_profiles')
			.select('name')
			.where('id', '=', profileId)
			.executeTakeFirst();

		if (!profile) {
			return fail(404, { error: 'Quality profile not found' });
		}

		// Update the scoring
		let result;
		try {
			result = await qualityProfileQueries.updateScoring({
				databaseId: currentDatabaseId,
				cache,
				layer,
				profileName: profile.name,
				input: {
					minimumScore,
					upgradeUntilScore,
					upgradeScoreIncrement,
					customFormatScores
				}
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to update scoring';
			if (message.toLowerCase().includes('upgrade score increment')) {
				return fail(400, { error: message });
			}
			return fail(500, { error: message });
		}

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to update scoring' });
		}

		const affectedArrs = getAffectedArrs({
			entityType: 'qualityProfile',
			databaseId: currentDatabaseId,
			entityName: profile.name
		});

		return {
			success: true,
			redirectTo: `/quality-profiles/${databaseId}/${id}/scoring`,
			affectedArrs
		};
	}
};
