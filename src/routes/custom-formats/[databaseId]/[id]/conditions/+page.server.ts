import { error, fail } from '@sveltejs/kit';
import type { ServerLoad, Actions } from '@sveltejs/kit';
import { pcdManager } from '$pcd/core/manager.ts';
import { canWriteToBase } from '$pcd/ops/writer.ts';
import * as customFormatQueries from '$pcd/entities/customFormats/index.ts';
import * as regularExpressionQueries from '$pcd/entities/regularExpressions/index.ts';
import { getLanguagesWithSupport } from '$lib/server/sync/mappings.ts';
import type { OperationLayer } from '$pcd/core/types.ts';
import type { ConditionData } from '$shared/pcd/display.ts';
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

	// Parse and validate the format ID
	const formatId = parseInt(id, 10);
	if (isNaN(formatId)) {
		throw error(400, 'Invalid format ID');
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

	// Get custom format basic info first
	const format = await customFormatQueries.getById(cache, formatId);
	if (!format) {
		throw error(404, 'Custom format not found');
	}

	// Get conditions and available options
	const [conditions, patterns] = await Promise.all([
		customFormatQueries.getConditionsForEvaluation(cache, format.name),
		regularExpressionQueries.list(cache)
	]);

	// Get languages with arr type support from static mappings
	const availableLanguages = getLanguagesWithSupport();

	return {
		currentDatabase,
		format,
		formatName: format.name,
		conditions,
		availablePatterns: patterns.map((p) => ({ id: p.id, name: p.name, pattern: p.pattern })),
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
		const formatId = parseInt(id, 10);

		if (isNaN(currentDatabaseId) || isNaN(formatId)) {
			return fail(400, { error: 'Invalid parameters' });
		}

		const cache = pcdManager.getCache(currentDatabaseId);
		if (!cache) {
			return fail(500, { error: 'Database cache not available' });
		}

		// Get current format and conditions
		const format = await customFormatQueries.getById(cache, formatId);
		if (!format) {
			return fail(404, { error: 'Custom format not found' });
		}

		const originalConditions = await customFormatQueries.getConditionsForEvaluation(
			cache,
			format.name
		);

		const formData = await request.formData();

		// Parse form data
		const conditionsJson = formData.get('conditions') as string;
		const layer = (formData.get('layer') as OperationLayer) || 'user';

		let conditions: ConditionData[] = [];
		try {
			conditions = JSON.parse(conditionsJson || '[]');
		} catch {
			return fail(400, { error: 'Invalid conditions format' });
		}

		// Validate unique condition names
		const names = conditions.map((c) => c.name.trim().toLowerCase());
		const uniqueNames = new Set(names);
		if (uniqueNames.size !== names.length) {
			return fail(400, { error: 'Condition names must be unique' });
		}

		// Validate arr type selection
		const hasMissingArrType = conditions.some(
			(c) => c.arrType !== 'all' && c.arrType !== 'radarr' && c.arrType !== 'sonarr'
		);
		if (hasMissingArrType) {
			return fail(400, { error: 'Each condition must have at least one Arr type selected' });
		}

		// Check layer permission
		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer without personal access token' });
		}

		// Update conditions
		let result;
		try {
			result = await customFormatQueries.updateConditions({
				databaseId: currentDatabaseId,
				cache,
				layer,
				formatName: format.name,
				originalConditions,
				conditions
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to update conditions';
			if (message.toLowerCase().includes('condition')) {
				return fail(400, { error: message });
			}
			return fail(500, { error: message });
		}

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to update conditions' });
		}

		const affectedArrs = getAffectedArrs({
			entityType: 'customFormat',
			databaseId: currentDatabaseId,
			entityName: format.name
		});

		return {
			success: true,
			redirectTo: `/custom-formats/${databaseId}/${id}/conditions`,
			affectedArrs
		};
	}
};
