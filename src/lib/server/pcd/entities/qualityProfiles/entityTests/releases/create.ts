/**
 * Create test release operations
 */

import type { PCDCache } from '#pcd/index.ts';
import { writeOperation, type OperationLayer } from '#pcd/index.ts';

interface CreateReleaseInput {
	entityType: 'movie' | 'series';
	entityTmdbId: number;
	title: string;
	size_bytes: number | null;
	languages: string[];
	indexers: string[];
	flags: string[];
}

interface CreateReleaseOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	input: CreateReleaseInput;
}

interface CreateReleasesOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	inputs: CreateReleaseInput[];
}

/**
 * Create a test release by writing an operation to the specified layer
 */
export async function createRelease(options: CreateReleaseOptions) {
	const { databaseId, cache, layer, input } = options;
	const db = cache.kb;

	const entity = await db
		.selectFrom('test_entities')
		.select(['title'])
		.where('type', '=', input.entityType)
		.where('tmdb_id', '=', input.entityTmdbId)
		.executeTakeFirst();

	const entityTitle = entity?.title ?? `${input.entityType}:${input.entityTmdbId}`;

	const insertRelease = db
		.insertInto('test_releases')
		.values({
			entity_type: input.entityType,
			entity_tmdb_id: input.entityTmdbId,
			title: input.title,
			size_bytes: input.size_bytes,
			languages: JSON.stringify(input.languages),
			indexers: JSON.stringify(input.indexers),
			flags: JSON.stringify(input.flags)
		})
		.compile();

	const result = await writeOperation({
		databaseId,
		layer,
		description: `create-test-release`,
		queries: [insertRelease],
		desiredState: {
			entity_type: input.entityType,
			entity_tmdb_id: input.entityTmdbId,
			title: input.title,
			size_bytes: input.size_bytes,
			languages: input.languages,
			indexers: input.indexers,
			flags: input.flags
		},
		metadata: {
			operation: 'create',
			entity: 'test_release',
			name: input.title.substring(0, 50),
			stableKey: {
				key: 'test_release_key',
				value: `${input.entityType}:${input.entityTmdbId}:${input.title}`
			},
			summary: 'Create test release',
			title: `Create test release for "${entityTitle}"`
		}
	});

	return result;
}

/**
 * Bulk create test releases by writing operations to the specified layer
 * Skips releases that already exist (by title within the same entity)
 */
export async function createReleases(options: CreateReleasesOptions) {
	const { databaseId, cache, layer, inputs } = options;
	const db = cache.kb;

	if (inputs.length === 0) {
		return {
			success: true,
			added: 0,
			skipped: 0
		};
	}

	// Get the entity key (all inputs should have the same entity)
	const entityType = inputs[0].entityType;
	const entityTmdbId = inputs[0].entityTmdbId;
	const entityRow = await db
		.selectFrom('test_entities')
		.select(['title'])
		.where('type', '=', entityType)
		.where('tmdb_id', '=', entityTmdbId)
		.executeTakeFirst();
	const entityTitle = entityRow?.title ?? `${entityType}:${entityTmdbId}`;

	// Check for existing releases for this entity
	const existingReleases = await db
		.selectFrom('test_releases')
		.select(['title'])
		.where('entity_type', '=', entityType)
		.where('entity_tmdb_id', '=', entityTmdbId)
		.execute();

	const existingTitles = new Set(existingReleases.map((r) => r.title));

	// Filter out duplicates
	const newInputs = inputs.filter((input) => !existingTitles.has(input.title));

	const skippedCount = inputs.length - newInputs.length;

	// If all releases already exist, return early
	if (newInputs.length === 0) {
		return {
			success: true,
			added: 0,
			skipped: skippedCount
		};
	}

	const queries = [];

	for (const input of newInputs) {
		const insertRelease = db
			.insertInto('test_releases')
			.values({
				entity_type: input.entityType,
				entity_tmdb_id: input.entityTmdbId,
				title: input.title,
				size_bytes: input.size_bytes,
				languages: JSON.stringify(input.languages),
				indexers: JSON.stringify(input.indexers),
				flags: JSON.stringify(input.flags)
			})
			.compile();

		queries.push(insertRelease);
	}

	const result = await writeOperation({
		databaseId,
		layer,
		description: `import-test-releases`,
		queries,
		desiredState: {
			entity_type: entityType,
			entity_tmdb_id: entityTmdbId,
			releases: newInputs.map((input) => ({
				title: input.title,
				size_bytes: input.size_bytes,
				languages: input.languages,
				indexers: input.indexers,
				flags: input.flags
			}))
		},
		metadata: {
			operation: 'create',
			entity: 'test_release',
			name: `${newInputs.length} releases`,
			summary: 'Import test releases',
			title: `Import ${newInputs.length} test releases for "${entityTitle}"`
		}
	});

	return {
		...result,
		added: newInputs.length,
		skipped: skippedCount
	};
}
