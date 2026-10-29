/**
 * Create test entity operation
 */

import type { PCDCache } from '#pcd/index.ts';
import { writeOperation, type OperationLayer } from '#pcd/index.ts';

interface CreateEntityInput {
	type: 'movie' | 'series';
	tmdbId: number;
	title: string;
	year: number | null;
	posterPath: string | null;
}

interface CreateEntitiesOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	inputs: CreateEntityInput[];
}

/**
 * Create test entities by writing an operation to the specified layer
 * Skips entities that already exist (by type + tmdb_id)
 */
export async function create(options: CreateEntitiesOptions) {
	const { databaseId, cache, layer, inputs } = options;
	const db = cache.kb;

	// Check for existing entities
	const existingEntities = await db
		.selectFrom('test_entities')
		.select(['type', 'tmdb_id'])
		.execute();

	const existingKeys = new Set(existingEntities.map((e) => `${e.type}-${e.tmdb_id}`));

	// Filter out duplicates
	const newInputs = inputs.filter((input) => !existingKeys.has(`${input.type}-${input.tmdbId}`));

	const skippedCount = inputs.length - newInputs.length;

	// If all entities already exist, return early
	if (newInputs.length === 0) {
		return {
			success: true,
			added: 0,
			skipped: skippedCount
		};
	}

	const queries = [];

	for (const input of newInputs) {
		const insertEntity = db
			.insertInto('test_entities')
			.values({
				type: input.type,
				tmdb_id: input.tmdbId,
				title: input.title,
				year: input.year,
				poster_path: input.posterPath
			})
			.compile();

		queries.push(insertEntity);
	}

	const name = newInputs.length === 1 ? newInputs[0].title : `${newInputs.length} entities`;
	const entitiesState = newInputs.map((input) => ({
		type: input.type,
		tmdb_id: input.tmdbId,
		title: input.title,
		year: input.year,
		poster_path: input.posterPath
	}));

	const result = await writeOperation({
		databaseId,
		layer,
		description: `create-test-entities`,
		queries,
		desiredState: {
			entities: entitiesState
		},
		metadata: {
			operation: 'create',
			entity: 'test_entity',
			name,
			...(newInputs.length === 1 && {
				stableKey: { key: 'test_entity_key', value: `${newInputs[0].type}:${newInputs[0].tmdbId}` }
			}),
			summary: 'Create test entities',
			title:
				newInputs.length === 1
					? `Create test entity "${newInputs[0].title}"`
					: `Create ${newInputs.length} test entities`
		}
	});

	return {
		...result,
		added: newInputs.length,
		skipped: skippedCount
	};
}
