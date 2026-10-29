/**
 * Delete test entity operation
 */

import type { PCDCache } from '#pcd/index.ts';
import { writeOperation, type OperationLayer } from '#pcd/index.ts';

interface DeleteEntityOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	entityType: 'movie' | 'series';
	entityTmdbId: number;
	entityTitle: string; // For metadata
}

/**
 * Delete a test entity and its releases by writing an operation to the specified layer
 * Uses stable composite key (type, tmdb_id) instead of auto-generated id
 */
export async function remove(options: DeleteEntityOptions) {
	const { databaseId, cache, layer, entityType, entityTmdbId, entityTitle } = options;
	const db = cache.kb;

	const current = await db
		.selectFrom('test_entities')
		.select(['type', 'tmdb_id', 'title', 'year', 'poster_path'])
		.where('type', '=', entityType)
		.where('tmdb_id', '=', entityTmdbId)
		.executeTakeFirst();

	if (!current) {
		return { success: false, error: 'Test entity not found' };
	}

	const releaseCountRow = await db
		.selectFrom('test_releases')
		.select(db.fn.count<number>('id').as('count'))
		.where('entity_type', '=', entityType)
		.where('entity_tmdb_id', '=', entityTmdbId)
		.executeTakeFirst();

	// Delete releases first (uses composite FK)
	const deleteReleases = db
		.deleteFrom('test_releases')
		.where('entity_type', '=', entityType)
		.where('entity_tmdb_id', '=', entityTmdbId)
		.compile();

	// Delete the entity using stable composite key
	let deleteEntity = db
		.deleteFrom('test_entities')
		.where('type', '=', entityType)
		.where('tmdb_id', '=', entityTmdbId)
		.where('title', '=', current.title);

	if (current.year === null) {
		deleteEntity = deleteEntity.where('year', 'is', null);
	} else {
		deleteEntity = deleteEntity.where('year', '=', current.year);
	}
	if (current.poster_path === null) {
		deleteEntity = deleteEntity.where('poster_path', 'is', null);
	} else {
		deleteEntity = deleteEntity.where('poster_path', '=', current.poster_path);
	}

	const deleteEntityQuery = deleteEntity.compile();

	const result = await writeOperation({
		databaseId,
		layer,
		description: `delete-test-entity-${entityTitle.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
		queries: [deleteReleases, deleteEntityQuery],
		desiredState: {
			deleted: true,
			type: current.type,
			tmdb_id: current.tmdb_id,
			title: current.title,
			year: current.year,
			poster_path: current.poster_path,
			release_count: releaseCountRow?.count ?? 0
		},
		metadata: {
			operation: 'delete',
			entity: 'test_entity',
			name: current.title || entityTitle,
			stableKey: { key: 'test_entity_key', value: `${entityType}:${entityTmdbId}` },
			changedFields: ['deleted'],
			summary: 'Delete test entity',
			title: `Delete test entity "${current.title || entityTitle}"`
		}
	});

	return result;
}
