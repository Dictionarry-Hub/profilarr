/**
 * Delete test release operation
 */

import type { PCDCache } from '#pcd/index.ts';
import { writeOperation, type OperationLayer } from '#pcd/index.ts';

interface DeleteReleaseOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	/** The current release data (for value guards) */
	current: {
		id: number;
		entity_type: 'movie' | 'series';
		entity_tmdb_id: number;
		title: string;
		size_bytes: number | null;
		languages: string[];
		indexers: string[];
		flags: string[];
	};
}

/**
 * Delete a test release by writing an operation to the specified layer
 */
export async function deleteRelease(options: DeleteReleaseOptions) {
	const { databaseId, cache, layer, current } = options;
	const db = cache.kb;

	const currentLanguages = JSON.stringify(current.languages);
	const currentIndexers = JSON.stringify(current.indexers);
	const currentFlags = JSON.stringify(current.flags);

	let deleteQuery = db
		.deleteFrom('test_releases')
		.where('entity_type', '=', current.entity_type)
		.where('entity_tmdb_id', '=', current.entity_tmdb_id)
		.where('title', '=', current.title)
		.where('languages', '=', currentLanguages)
		.where('indexers', '=', currentIndexers)
		.where('flags', '=', currentFlags);

	if (current.size_bytes === null) {
		deleteQuery = deleteQuery.where('size_bytes', 'is', null);
	} else {
		deleteQuery = deleteQuery.where('size_bytes', '=', current.size_bytes);
	}

	const deleteQueryCompiled = deleteQuery.compile();

	const result = await writeOperation({
		databaseId,
		layer,
		description: `delete-test-release-${current.id}`,
		queries: [deleteQueryCompiled],
		desiredState: {
			deleted: true,
			entity_type: current.entity_type,
			entity_tmdb_id: current.entity_tmdb_id,
			title: current.title,
			size_bytes: current.size_bytes,
			languages: current.languages,
			indexers: current.indexers,
			flags: current.flags
		},
		metadata: {
			operation: 'delete',
			entity: 'test_release',
			name: current.title.substring(0, 50),
			stableKey: {
				key: 'test_release_key',
				value: `${current.entity_type}:${current.entity_tmdb_id}:${current.title}`
			},
			changedFields: ['deleted'],
			summary: 'Delete test release',
			title: `Delete test release "${current.title.substring(0, 50)}"`
		}
	});

	return result;
}
