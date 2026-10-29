/**
 * Entity test read queries
 */

import type { PCDCache } from '#pcd/index.ts';
import type { TestEntity } from '#shared/pcd/display.ts';
import type { TestEntitiesRow } from '#shared/pcd/types.ts';

/**
 * Get all test entities with their releases
 */
export async function list(cache: PCDCache): Promise<TestEntity[]> {
	const db = cache.kb;

	// 1. Get all test entities
	const entities = await db
		.selectFrom('test_entities')
		.select(['id', 'type', 'tmdb_id', 'title', 'year', 'poster_path', 'created_at', 'updated_at'])
		.orderBy('title')
		.execute();

	if (entities.length === 0) return [];

	// 2. Get all releases for all entities
	const allReleases = await db
		.selectFrom('test_releases')
		.select([
			'id',
			'entity_type',
			'entity_tmdb_id',
			'title',
			'size_bytes',
			'languages',
			'indexers',
			'flags',
			'created_at',
			'updated_at'
		])
		.orderBy('entity_type')
		.orderBy('entity_tmdb_id')
		.orderBy('title')
		.execute();

	// Build releases map using composite key
	const releasesMap = new Map<string, typeof allReleases>();
	for (const release of allReleases) {
		const key = `${release.entity_type}-${release.entity_tmdb_id}`;
		if (!releasesMap.has(key)) {
			releasesMap.set(key, []);
		}
		releasesMap.get(key)!.push(release);
	}

	// Build the final result
	return entities.map((entity) => ({
		...entity,
		type: entity.type as 'movie' | 'series',
		releases: (releasesMap.get(`${entity.type}-${entity.tmdb_id}`) || []).map((r) => ({
			id: r.id,
			title: r.title,
			size_bytes: r.size_bytes !== null ? Number(r.size_bytes) : null,
			languages: JSON.parse(r.languages) as string[],
			indexers: JSON.parse(r.indexers) as string[],
			flags: JSON.parse(r.flags) as string[],
			created_at: r.created_at,
			updated_at: r.updated_at
		}))
	}));
}

/**
 * Get a single test entity by composite key (type + tmdb_id)
 */
export async function getEntity(
	cache: PCDCache,
	type: 'movie' | 'series',
	tmdbId: number
): Promise<TestEntitiesRow | null> {
	const db = cache.kb;

	const entity = await db
		.selectFrom('test_entities')
		.select(['id', 'type', 'tmdb_id', 'title', 'year', 'poster_path', 'created_at', 'updated_at'])
		.where('type', '=', type)
		.where('tmdb_id', '=', tmdbId)
		.executeTakeFirst();

	if (!entity) return null;

	return entity as TestEntitiesRow;
}

/**
 * Get a single test release by id with parsed arrays
 */
export async function getReleaseById(cache: PCDCache, id: number) {
	const db = cache.kb;

	const release = await db
		.selectFrom('test_releases')
		.select([
			'id',
			'entity_type',
			'entity_tmdb_id',
			'title',
			'size_bytes',
			'languages',
			'indexers',
			'flags',
			'created_at',
			'updated_at'
		])
		.where('id', '=', id)
		.executeTakeFirst();

	if (!release) return null;

	return {
		id: release.id,
		entity_type: release.entity_type as 'movie' | 'series',
		entity_tmdb_id: release.entity_tmdb_id,
		title: release.title,
		size_bytes: release.size_bytes !== null ? Number(release.size_bytes) : null,
		languages: JSON.parse(release.languages) as string[],
		indexers: JSON.parse(release.indexers) as string[],
		flags: JSON.parse(release.flags) as string[],
		created_at: release.created_at,
		updated_at: release.updated_at
	};
}
