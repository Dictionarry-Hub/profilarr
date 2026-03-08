import { error, redirect, fail } from '@sveltejs/kit';
import type { ServerLoad, Actions } from '@sveltejs/kit';
import { pcdManager } from '$pcd/core/manager.ts';
import type { OperationLayer } from '$pcd/core/types.ts';
import { canWriteToBase } from '$pcd/ops/writer.ts';
import * as customFormatQueries from '$pcd/entities/customFormats/index.ts';

export const load: ServerLoad = async ({ params }) => {
	const { databaseId, id } = params;

	if (!databaseId || !id) {
		throw error(400, 'Missing required parameters');
	}

	const currentDatabaseId = parseInt(databaseId, 10);
	const formatId = parseInt(id, 10);

	if (isNaN(currentDatabaseId) || isNaN(formatId)) {
		throw error(400, 'Invalid parameters');
	}

	const cache = pcdManager.getCache(currentDatabaseId);
	if (!cache) {
		throw error(500, 'Database cache not available');
	}

	const format = await customFormatQueries.getById(cache, formatId);
	if (!format) {
		throw error(404, 'Custom format not found');
	}

	return {
		format,
		canWriteToBase: canWriteToBase(currentDatabaseId)
	};
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const { databaseId, id } = params;

		if (!databaseId || !id) {
			return fail(400, { error: 'Missing required parameters' });
		}

		const currentDatabaseId = parseInt(databaseId, 10);

		if (isNaN(currentDatabaseId)) {
			return fail(400, { error: 'Invalid parameters' });
		}
		if (!canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Entity tests are read-only for this database' });
		}

		const cache = pcdManager.getCache(currentDatabaseId);
		if (!cache) {
			return fail(500, { error: 'Database cache not available' });
		}

		const formData = await request.formData();

		const title = formData.get('title') as string;
		const type = formData.get('type') as 'movie' | 'series';
		const shouldMatch = formData.get('shouldMatch') === '1';
		const description = (formData.get('description') as string) || null;
		const formatName = formData.get('formatName') as string;
		const layer = (formData.get('layer') as OperationLayer) || 'user';

		if (!title?.trim()) {
			return fail(400, { error: 'Title is required' });
		}

		if (type !== 'movie' && type !== 'series') {
			return fail(400, { error: 'Invalid type' });
		}

		if (!formatName) {
			return fail(400, { error: 'Format name is required' });
		}

		// Check layer permission
		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer without personal access token' });
		}

		let result;
		try {
			result = await customFormatQueries.createTest({
				databaseId: currentDatabaseId,
				layer,
				formatName,
				input: {
					title: title.trim(),
					type,
					should_match: shouldMatch,
					description: description?.trim() || null
				}
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to create test';
			if (message.includes('already exists')) {
				return fail(400, { error: message });
			}
			return fail(500, { error: message });
		}

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to create test' });
		}

		throw redirect(303, `/custom-formats/${databaseId}/${id}/testing`);
	}
};
