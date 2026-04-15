import { error, redirect, fail } from '@sveltejs/kit';
import type { ServerLoad, Actions } from '@sveltejs/kit';
import { pcdManager } from '$pcd/core/manager.ts';
import { canWriteToBase } from '$pcd/ops/writer.ts';
import * as regularExpressionQueries from '$pcd/entities/regularExpressions/index.ts';
import type { OperationLayer } from '$pcd/core/types.ts';
import { logger } from '$logger/logger.ts';
import { getAffectedArrs } from '$lib/server/sync/affectedArrs.ts';
import { validateRegex } from '$lib/server/utils/arr/parser/index.ts';
import { getConditionRefsForRegex } from '$pcd/references.ts';

export const load: ServerLoad = async ({ params }) => {
	const { databaseId, id } = params;

	if (!databaseId || !id) {
		throw error(400, 'Missing parameters');
	}

	const currentDatabaseId = parseInt(databaseId, 10);
	const regexId = parseInt(id, 10);

	if (isNaN(currentDatabaseId) || isNaN(regexId)) {
		throw error(400, 'Invalid parameters');
	}

	const currentDatabase = pcdManager.getByIdPublic(currentDatabaseId);
	if (!currentDatabase) {
		throw error(404, 'Database not found');
	}

	const cache = pcdManager.getCache(currentDatabaseId);
	if (!cache) {
		throw error(500, 'Database cache not available');
	}

	const regularExpression = await regularExpressionQueries.get(cache, regexId);
	if (!regularExpression) {
		throw error(404, 'Regular expression not found');
	}

	const conditionRefs = await getConditionRefsForRegex(cache, regularExpression.name);

	return {
		currentDatabase,
		regularExpression,
		conditionRefs,
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
		const regexId = parseInt(id, 10);

		if (isNaN(currentDatabaseId) || isNaN(regexId)) {
			return fail(400, { error: 'Invalid parameters' });
		}

		const cache = pcdManager.getCache(currentDatabaseId);
		if (!cache) {
			return fail(500, { error: 'Database cache not available' });
		}

		// Get current regular expression for value guards
		const current = await regularExpressionQueries.get(cache, regexId);
		if (!current) {
			return fail(404, { error: 'Regular expression not found' });
		}

		const formData = await request.formData();

		// Parse form data
		const name = formData.get('name') as string;
		const tagsJson = formData.get('tags') as string;
		const pattern = formData.get('pattern') as string;
		const description = (formData.get('description') as string) || null;
		const regex101Id = (formData.get('regex101Id') as string) || null;
		const layer = (formData.get('layer') as OperationLayer) || 'user';

		// Validate
		if (!name?.trim()) {
			return fail(400, { error: 'Name is required' });
		}

		if (!pattern?.trim()) {
			return fail(400, { error: 'Pattern is required' });
		}

		// Validate regex against .NET engine (mirrors Radarr/Sonarr validation)
		const regexValidation = await validateRegex(pattern.trim());
		if (regexValidation && !regexValidation.valid) {
			return fail(400, { error: `Invalid regex: ${regexValidation.error}` });
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

		// Update the regular expression
		let result;
		try {
			result = await regularExpressionQueries.update({
				databaseId: currentDatabaseId,
				cache,
				layer,
				current,
				input: {
					name: name.trim(),
					pattern: pattern.trim(),
					tags,
					description: description?.trim() || null,
					regex101Id: regex101Id?.trim() || null
				}
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to update regular expression';
			if (message.includes('already exists')) {
				return fail(400, { error: message });
			}
			return fail(500, { error: message });
		}

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to update regular expression' });
		}

		const affectedArrs = getAffectedArrs({
			entityType: 'regularExpression',
			databaseId: currentDatabaseId,
			entityName: name.trim()
		});

		return {
			success: true,
			redirectTo: `/regular-expressions/${databaseId}`,
			affectedArrs
		};
	},

	delete: async ({ request, params }) => {
		const { databaseId, id } = params;

		if (!databaseId || !id) {
			return fail(400, { error: 'Missing parameters' });
		}

		const currentDatabaseId = parseInt(databaseId, 10);
		const regexId = parseInt(id, 10);

		if (isNaN(currentDatabaseId) || isNaN(regexId)) {
			return fail(400, { error: 'Invalid parameters' });
		}

		const cache = pcdManager.getCache(currentDatabaseId);
		if (!cache) {
			return fail(500, { error: 'Database cache not available' });
		}

		// Get current regular expression for value guards
		const current = await regularExpressionQueries.get(cache, regexId);
		if (!current) {
			return fail(404, { error: 'Regular expression not found' });
		}

		const formData = await request.formData();
		const layerFromForm = formData.get('layer');
		const layer = (layerFromForm as OperationLayer) || 'user';

		await logger.debug('Delete action received', {
			source: 'RegularExpressionDelete',
			meta: {
				regexId,
				regexName: current.name,
				layerFromForm,
				layerUsed: layer
			}
		});

		// Check layer permission
		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer without personal access token' });
		}

		const result = await regularExpressionQueries.remove({
			databaseId: currentDatabaseId,
			cache,
			layer,
			current
		});

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to delete regular expression' });
		}

		throw redirect(303, `/regular-expressions/${databaseId}`);
	}
};
