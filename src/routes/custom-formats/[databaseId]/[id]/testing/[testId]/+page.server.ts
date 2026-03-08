import { error, redirect, fail } from '@sveltejs/kit';
import type { ServerLoad, Actions } from '@sveltejs/kit';
import { pcdManager } from '$pcd/core/manager.ts';
import type { OperationLayer } from '$pcd/core/types.ts';
import { canWriteToBase } from '$pcd/ops/writer.ts';
import * as customFormatQueries from '$pcd/entities/customFormats/index.ts';

export const load: ServerLoad = async ({ params, url }) => {
	const { databaseId, id } = params;

	if (!databaseId || !id) {
		throw error(400, 'Missing required parameters');
	}

	const currentDatabaseId = parseInt(databaseId, 10);
	const formatId = parseInt(id, 10);

	if (isNaN(currentDatabaseId) || isNaN(formatId)) {
		throw error(400, 'Invalid parameters');
	}

	// Test is identified by title and type query params
	const testTitle = url.searchParams.get('title');
	const testType = url.searchParams.get('type');

	if (!testTitle || !testType) {
		throw error(400, 'Missing test title or type');
	}

	const cache = pcdManager.getCache(currentDatabaseId);
	if (!cache) {
		throw error(500, 'Database cache not available');
	}

	const format = await customFormatQueries.getById(cache, formatId);
	if (!format) {
		throw error(404, 'Custom format not found');
	}

	const test = await customFormatQueries.getTest(cache, format.name, testTitle, testType);
	if (!test) {
		throw error(404, 'Test not found');
	}

	return {
		format,
		test,
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

		const formatName = formData.get('formatName') as string;
		const currentTitle = formData.get('currentTitle') as string;
		const currentType = formData.get('currentType') as string;
		const layer = (formData.get('layer') as OperationLayer) || 'user';

		if (!formatName || !currentTitle || !currentType) {
			return fail(400, { error: 'Format name, current title and type are required' });
		}

		// Get current test for value guards
		const current = await customFormatQueries.getTest(cache, formatName, currentTitle, currentType);
		if (!current) {
			return fail(404, { error: 'Test not found' });
		}

		const title = formData.get('title') as string;
		const type = formData.get('type') as 'movie' | 'series';
		const shouldMatch = formData.get('shouldMatch') === '1';
		const description = (formData.get('description') as string) || null;

		if (!title?.trim()) {
			return fail(400, { error: 'Title is required' });
		}

		if (type !== 'movie' && type !== 'series') {
			return fail(400, { error: 'Invalid type' });
		}

		// Check layer permission
		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer without personal access token' });
		}

		let result;
		try {
			result = await customFormatQueries.updateTest({
				databaseId: currentDatabaseId,
				layer,
				formatName,
				current,
				input: {
					title: title.trim(),
					type,
					should_match: shouldMatch,
					description: description?.trim() || null
				}
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to update test';
			if (message.includes('already exists')) {
				return fail(400, { error: message });
			}
			return fail(500, { error: message });
		}

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to update test' });
		}

		throw redirect(303, `/custom-formats/${databaseId}/${id}/testing`);
	},

	delete: async ({ request, params }) => {
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
		const formatName = formData.get('formatName') as string;
		const testTitle = formData.get('testTitle') as string;
		const testType = formData.get('testType') as string;
		const layer = (formData.get('layer') as OperationLayer) || 'user';

		if (!formatName || !testTitle || !testType) {
			return fail(400, { error: 'Format name, test title and type are required' });
		}

		// Get current test for value guards
		const current = await customFormatQueries.getTest(cache, formatName, testTitle, testType);
		if (!current) {
			return fail(404, { error: 'Test not found' });
		}

		// Check layer permission
		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer without personal access token' });
		}

		const result = await customFormatQueries.deleteTest({
			databaseId: currentDatabaseId,
			layer,
			formatName,
			current
		});

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to delete test' });
		}

		throw redirect(303, `/custom-formats/${databaseId}/${id}/testing`);
	}
};
