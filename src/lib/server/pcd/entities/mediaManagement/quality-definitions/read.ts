/**
 * Quality definitions read operations
 */

import { sql } from 'kysely';
import type { PCDCache } from '$pcd/index.ts';
import type { ArrType } from '$shared/pcd/types.ts';
import type {
	QualityDefinitionListItem,
	QualityDefinitionsConfig,
	QualityDefinitionEntry
} from '$shared/pcd/display.ts';

/**
 * Get available qualities for an arr type from quality_api_mappings
 * Returns quality names that can be used for that arr type
 */
export async function getAvailableQualities(cache: PCDCache, arrType: ArrType): Promise<string[]> {
	const rows = await cache.kb
		.selectFrom('quality_api_mappings')
		.where('arr_type', '=', arrType)
		.select(['quality_name'])
		.orderBy(sql`quality_name COLLATE NOCASE`)
		.execute();

	return rows.map((row) => row.quality_name);
}

/**
 * List all quality definitions configs
 * Returns distinct config names with quality counts
 */
export async function list(cache: PCDCache): Promise<QualityDefinitionListItem[]> {
	// Get radarr configs
	const radarrRows = await cache.kb
		.selectFrom('radarr_quality_definitions')
		.select(['name'])
		.select((eb) => eb.fn.count('quality_name').as('quality_count'))
		.select((eb) => eb.fn.max('updated_at').as('updated_at'))
		.groupBy('name')
		.execute();

	// Get sonarr configs
	const sonarrRows = await cache.kb
		.selectFrom('sonarr_quality_definitions')
		.select(['name'])
		.select((eb) => eb.fn.count('quality_name').as('quality_count'))
		.select((eb) => eb.fn.max('updated_at').as('updated_at'))
		.groupBy('name')
		.execute();

	const result: QualityDefinitionListItem[] = [];

	for (const row of radarrRows) {
		result.push({
			name: row.name,
			arr_type: 'radarr',
			quality_count: Number(row.quality_count),
			updated_at: row.updated_at ?? ''
		});
	}

	for (const row of sonarrRows) {
		result.push({
			name: row.name,
			arr_type: 'sonarr',
			quality_count: Number(row.quality_count),
			updated_at: row.updated_at ?? ''
		});
	}

	// Sort by updated_at desc
	result.sort((a, b) => b.updated_at.localeCompare(a.updated_at));

	return result;
}

/**
 * Get a Radarr quality definitions config by name
 */
export async function getRadarrByName(
	cache: PCDCache,
	name: string
): Promise<QualityDefinitionsConfig | null> {
	const rows = await cache.kb
		.selectFrom('radarr_quality_definitions')
		.where('name', '=', name)
		.select(['quality_name', 'min_size', 'max_size', 'preferred_size'])
		.execute();

	if (rows.length === 0) {
		return null;
	}

	const entries: QualityDefinitionEntry[] = rows.map((row) => ({
		quality_name: row.quality_name,
		min_size: row.min_size,
		max_size: row.max_size,
		preferred_size: row.preferred_size
	}));

	return {
		name,
		entries
	};
}

/**
 * Get a Sonarr quality definitions config by name
 */
export async function getSonarrByName(
	cache: PCDCache,
	name: string
): Promise<QualityDefinitionsConfig | null> {
	const rows = await cache.kb
		.selectFrom('sonarr_quality_definitions')
		.where('name', '=', name)
		.select(['quality_name', 'min_size', 'max_size', 'preferred_size'])
		.execute();

	if (rows.length === 0) {
		return null;
	}

	const entries: QualityDefinitionEntry[] = rows.map((row) => ({
		quality_name: row.quality_name,
		min_size: row.min_size,
		max_size: row.max_size,
		preferred_size: row.preferred_size
	}));

	return {
		name,
		entries
	};
}
