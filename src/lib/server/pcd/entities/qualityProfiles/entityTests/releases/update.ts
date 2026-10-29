/**
 * Update test release operation
 */

import type { PCDCache } from '#pcd/index.ts';
import { writeOperation, type OperationLayer } from '#pcd/index.ts';

interface UpdateReleaseInput {
	title: string;
	size_bytes: number | null;
	languages: string[];
	indexers: string[];
	flags: string[];
}

interface UpdateReleaseOptions {
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
	input: UpdateReleaseInput;
}

/**
 * Update a test release by writing an operation to the specified layer
 */
export async function updateRelease(options: UpdateReleaseOptions) {
	const { databaseId, cache, layer, current, input } = options;
	const db = cache.kb;

	const currentLanguages = JSON.stringify(current.languages);
	const currentIndexers = JSON.stringify(current.indexers);
	const currentFlags = JSON.stringify(current.flags);
	const nextLanguages = JSON.stringify(input.languages);
	const nextIndexers = JSON.stringify(input.indexers);
	const nextFlags = JSON.stringify(input.flags);

	const setParts: Record<string, unknown> = {};
	if (current.title !== input.title) {
		setParts.title = input.title;
	}
	if (current.size_bytes !== input.size_bytes) {
		setParts.size_bytes = input.size_bytes;
	}
	if (currentLanguages !== nextLanguages) {
		setParts.languages = nextLanguages;
	}
	if (currentIndexers !== nextIndexers) {
		setParts.indexers = nextIndexers;
	}
	if (currentFlags !== nextFlags) {
		setParts.flags = nextFlags;
	}

	let updateQuery = db
		.updateTable('test_releases')
		.set(setParts)
		.where('entity_type', '=', current.entity_type)
		.where('entity_tmdb_id', '=', current.entity_tmdb_id)
		.where('title', '=', current.title);

	if (current.size_bytes !== input.size_bytes) {
		if (current.size_bytes === null) {
			updateQuery = updateQuery.where('size_bytes', 'is', null);
		} else {
			updateQuery = updateQuery.where('size_bytes', '=', current.size_bytes);
		}
	}
	if (currentLanguages !== nextLanguages) {
		updateQuery = updateQuery.where('languages', '=', currentLanguages);
	}
	if (currentIndexers !== nextIndexers) {
		updateQuery = updateQuery.where('indexers', '=', currentIndexers);
	}
	if (currentFlags !== nextFlags) {
		updateQuery = updateQuery.where('flags', '=', currentFlags);
	}

	if (Object.keys(setParts).length === 0) {
		return { success: true };
	}

	const updateQueryCompiled = updateQuery.compile();

	const changedFields: string[] = [];
	if (current.title !== input.title) changedFields.push('title');
	if (current.size_bytes !== input.size_bytes) changedFields.push('size_bytes');
	if (currentLanguages !== nextLanguages) changedFields.push('languages');
	if (currentIndexers !== nextIndexers) changedFields.push('indexers');
	if (currentFlags !== nextFlags) changedFields.push('flags');

	const desiredState: Record<string, unknown> = {};
	if (current.title !== input.title) {
		desiredState.title = { from: current.title, to: input.title };
	}
	if (current.size_bytes !== input.size_bytes) {
		desiredState.size_bytes = { from: current.size_bytes, to: input.size_bytes };
	}
	if (currentLanguages !== nextLanguages) {
		desiredState.languages = { from: current.languages, to: input.languages };
	}
	if (currentIndexers !== nextIndexers) {
		desiredState.indexers = { from: current.indexers, to: input.indexers };
	}
	if (currentFlags !== nextFlags) {
		desiredState.flags = { from: current.flags, to: input.flags };
	}

	const result = await writeOperation({
		databaseId,
		layer,
		description: `update-test-release-${current.id}`,
		queries: [updateQueryCompiled],
		desiredState,
		metadata: {
			operation: 'update',
			entity: 'test_release',
			name: input.title.substring(0, 50),
			...(current.title !== input.title && {
				previousName: current.title.substring(0, 50)
			}),
			stableKey: {
				key: 'test_release_key',
				value: `${current.entity_type}:${current.entity_tmdb_id}:${current.title}`
			},
			changedFields,
			summary: 'Update test release',
			title: `Update test release "${input.title.substring(0, 50)}"`
		}
	});

	return result;
}
