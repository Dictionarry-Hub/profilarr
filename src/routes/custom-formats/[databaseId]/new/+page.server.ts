import { error, redirect, fail } from '@sveltejs/kit';
import type { ServerLoad, Actions } from '@sveltejs/kit';
import { pcdManager } from '$pcd/core/manager.ts';
import { canWriteToBase } from '$pcd/ops/writer.ts';
import * as customFormatQueries from '$pcd/entities/customFormats/index.ts';
import type { OperationLayer } from '$pcd/core/types.ts';

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
		const description = (formData.get('description') as string) || null;
		const tagsJson = formData.get('tags') as string;
		const includeInRename = formData.get('includeInRename') === 'true';
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

		// Create the custom format
		let result;
		try {
			result = await customFormatQueries.create({
				databaseId: currentDatabaseId,
				cache,
				layer,
				input: {
					name: name.trim(),
					description: description?.trim() || null,
					includeInRename,
					tags
				}
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to create custom format';
			if (message.includes('already exists')) {
				return fail(400, { error: message });
			}
			return fail(500, { error: message });
		}

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to create custom format' });
		}

		// Get fresh cache after create (compile creates a new cache instance)
		const freshCache = pcdManager.getCache(currentDatabaseId);
		if (!freshCache) {
			// Fallback to list page if cache isn't ready
			throw redirect(303, `/custom-formats/${databaseId}`);
		}

		// Get the new format ID by looking it up by name
		const formats = await customFormatQueries.list(freshCache);
		const newFormat = formats.find((f) => f.name === name.trim());

		if (newFormat) {
			// Redirect to conditions page so user can add conditions
			throw redirect(303, `/custom-formats/${databaseId}/${newFormat.id}/conditions`);
		}

		// Fallback to list page if we can't find the new format
		throw redirect(303, `/custom-formats/${databaseId}`);
	}
};
