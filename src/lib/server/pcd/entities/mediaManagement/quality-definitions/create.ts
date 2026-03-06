/**
 * Quality definitions create operations
 */

import type { PCDCache } from '$pcd/index.ts';
import { writeOperation, type OperationLayer } from '$pcd/index.ts';
import type { QualityDefinitionEntry } from '$shared/pcd/display.ts';

export interface CreateQualityDefinitionsInput {
	name: string;
	entries: QualityDefinitionEntry[];
}

export interface CreateQualityDefinitionsOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	input: CreateQualityDefinitionsInput;
}

export async function createRadarrQualityDefinitions(options: CreateQualityDefinitionsOptions) {
	const { databaseId, cache, layer, input } = options;
	const db = cache.kb;

	ensureUniqueEntries(input.entries);

	// Check if name already exists
	const existing = await db
		.selectFrom('radarr_quality_definitions')
		.where((eb) => eb(eb.fn('lower', [eb.ref('name')]), '=', input.name.toLowerCase()))
		.select('name')
		.executeTakeFirst();

	if (existing) {
		throw new Error(`A radarr quality definitions config with name "${input.name}" already exists`);
	}

	const queries = input.entries.map((entry) =>
		db
			.insertInto('radarr_quality_definitions')
			.values({
				name: input.name,
				quality_name: entry.quality_name,
				min_size: entry.min_size,
				max_size: entry.max_size,
				preferred_size: entry.preferred_size
			})
			.compile()
	);

	return writeOperation({
		databaseId,
		layer,
		description: `create-radarr-quality-definitions-${input.name}`,
		queries,
		desiredState: {
			name: input.name,
			entries: input.entries
		},
		metadata: {
			operation: 'create',
			entity: 'radarr_quality_definitions',
			name: input.name,
			stableKey: { key: 'radarr_quality_definitions_name', value: input.name },
			summary: 'Create Radarr quality definitions',
			title: `Create Radarr quality definitions "${input.name}"`
		}
	});
}

export async function createSonarrQualityDefinitions(options: CreateQualityDefinitionsOptions) {
	const { databaseId, cache, layer, input } = options;
	const db = cache.kb;

	ensureUniqueEntries(input.entries);

	// Check if name already exists
	const existing = await db
		.selectFrom('sonarr_quality_definitions')
		.where((eb) => eb(eb.fn('lower', [eb.ref('name')]), '=', input.name.toLowerCase()))
		.select('name')
		.executeTakeFirst();

	if (existing) {
		throw new Error(`A sonarr quality definitions config with name "${input.name}" already exists`);
	}

	const queries = input.entries.map((entry) =>
		db
			.insertInto('sonarr_quality_definitions')
			.values({
				name: input.name,
				quality_name: entry.quality_name,
				min_size: entry.min_size,
				max_size: entry.max_size,
				preferred_size: entry.preferred_size
			})
			.compile()
	);

	return writeOperation({
		databaseId,
		layer,
		description: `create-sonarr-quality-definitions-${input.name}`,
		queries,
		desiredState: {
			name: input.name,
			entries: input.entries
		},
		metadata: {
			operation: 'create',
			entity: 'sonarr_quality_definitions',
			name: input.name,
			stableKey: { key: 'sonarr_quality_definitions_name', value: input.name },
			summary: 'Create Sonarr quality definitions',
			title: `Create Sonarr quality definitions "${input.name}"`
		}
	});
}

function ensureUniqueEntries(entries: QualityDefinitionEntry[]) {
	const normalized = entries.map((entry) => entry.quality_name.trim().toLowerCase());
	const unique = new Set(normalized);
	if (unique.size !== normalized.length) {
		throw new Error('Quality definitions cannot contain duplicate quality names');
	}
}
