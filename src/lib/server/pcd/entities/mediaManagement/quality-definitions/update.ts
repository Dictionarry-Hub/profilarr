/**
 * Quality definitions update operations
 */

import type { PCDCache } from '$pcd/index.ts';
import { writeOperation, type OperationLayer } from '$pcd/index.ts';
import type { QualityDefinitionEntry, QualityDefinitionsConfig } from '$shared/pcd/display.ts';

export interface UpdateQualityDefinitionsInput {
	name: string;
	entries: QualityDefinitionEntry[];
}

export interface UpdateQualityDefinitionsOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	current: QualityDefinitionsConfig;
	input: UpdateQualityDefinitionsInput;
}

export async function updateRadarrQualityDefinitions(options: UpdateQualityDefinitionsOptions) {
	const { databaseId, cache, layer, current, input } = options;
	const db = cache.kb;

	ensureUniqueEntries(input.entries);

	// If renaming, check if new name already exists
	if (input.name !== current.name) {
		const existing = await db
			.selectFrom('radarr_quality_definitions')
			.where((eb) => eb(eb.fn('lower', [eb.ref('name')]), '=', input.name.toLowerCase()))
			.select('name')
			.executeTakeFirst();

		if (existing) {
			throw new Error(
				`A radarr quality definitions config with name "${input.name}" already exists`
			);
		}
	}

	if (isSameEntries(current.entries, input.entries) && current.name === input.name) {
		return { success: true };
	}

	const queries = [];

	// Delete existing entries with value guards
	for (const entry of current.entries) {
		const deleteQuery = db
			.deleteFrom('radarr_quality_definitions')
			.where('name', '=', current.name)
			.where('quality_name', '=', entry.quality_name)
			.where('min_size', '=', entry.min_size)
			.where('max_size', '=', entry.max_size)
			.where('preferred_size', '=', entry.preferred_size)
			.compile();
		queries.push(deleteQuery);
	}

	// Insert all new entries
	for (const entry of input.entries) {
		const insertQuery = db
			.insertInto('radarr_quality_definitions')
			.values({
				name: input.name,
				quality_name: entry.quality_name,
				min_size: entry.min_size,
				max_size: entry.max_size,
				preferred_size: entry.preferred_size
			})
			.compile();
		queries.push(insertQuery);
	}

	const changedFields: string[] = [];
	const desiredState: Record<string, unknown> = {};
	if (current.name !== input.name) {
		changedFields.push('name');
		desiredState.name = { from: current.name, to: input.name };
	}
	if (!isSameEntries(current.entries, input.entries)) {
		changedFields.push('entries');
		desiredState.entries = { from: current.entries, to: input.entries };
	}

	return writeOperation({
		databaseId,
		layer,
		description: `update-radarr-quality-definitions-${input.name}`,
		queries,
		desiredState,
		metadata: {
			operation: 'update',
			entity: 'radarr_quality_definitions',
			name: input.name,
			...(current.name !== input.name && { previousName: current.name }),
			stableKey: { key: 'radarr_quality_definitions_name', value: current.name },
			changedFields,
			summary: 'Update Radarr quality definitions',
			title: `Update Radarr quality definitions "${input.name}"`
		}
	});
}

export async function updateSonarrQualityDefinitions(options: UpdateQualityDefinitionsOptions) {
	const { databaseId, cache, layer, current, input } = options;
	const db = cache.kb;

	ensureUniqueEntries(input.entries);

	// If renaming, check if new name already exists
	if (input.name !== current.name) {
		const existing = await db
			.selectFrom('sonarr_quality_definitions')
			.where((eb) => eb(eb.fn('lower', [eb.ref('name')]), '=', input.name.toLowerCase()))
			.select('name')
			.executeTakeFirst();

		if (existing) {
			throw new Error(
				`A sonarr quality definitions config with name "${input.name}" already exists`
			);
		}
	}

	if (isSameEntries(current.entries, input.entries) && current.name === input.name) {
		return { success: true };
	}

	const queries = [];

	// Delete existing entries with value guards
	for (const entry of current.entries) {
		const deleteQuery = db
			.deleteFrom('sonarr_quality_definitions')
			.where('name', '=', current.name)
			.where('quality_name', '=', entry.quality_name)
			.where('min_size', '=', entry.min_size)
			.where('max_size', '=', entry.max_size)
			.where('preferred_size', '=', entry.preferred_size)
			.compile();
		queries.push(deleteQuery);
	}

	// Insert all new entries
	for (const entry of input.entries) {
		const insertQuery = db
			.insertInto('sonarr_quality_definitions')
			.values({
				name: input.name,
				quality_name: entry.quality_name,
				min_size: entry.min_size,
				max_size: entry.max_size,
				preferred_size: entry.preferred_size
			})
			.compile();
		queries.push(insertQuery);
	}

	const changedFields: string[] = [];
	const desiredState: Record<string, unknown> = {};
	if (current.name !== input.name) {
		changedFields.push('name');
		desiredState.name = { from: current.name, to: input.name };
	}
	if (!isSameEntries(current.entries, input.entries)) {
		changedFields.push('entries');
		desiredState.entries = { from: current.entries, to: input.entries };
	}

	return writeOperation({
		databaseId,
		layer,
		description: `update-sonarr-quality-definitions-${input.name}`,
		queries,
		desiredState,
		metadata: {
			operation: 'update',
			entity: 'sonarr_quality_definitions',
			name: input.name,
			...(current.name !== input.name && { previousName: current.name }),
			stableKey: { key: 'sonarr_quality_definitions_name', value: current.name },
			changedFields,
			summary: 'Update Sonarr quality definitions',
			title: `Update Sonarr quality definitions "${input.name}"`
		}
	});
}

function isSameEntries(current: QualityDefinitionEntry[], next: QualityDefinitionEntry[]): boolean {
	const normalize = (entries: QualityDefinitionEntry[]) =>
		entries
			.map((entry) => ({
				quality_name: entry.quality_name,
				min_size: entry.min_size,
				max_size: entry.max_size,
				preferred_size: entry.preferred_size
			}))
			.sort((a, b) => a.quality_name.localeCompare(b.quality_name));

	return JSON.stringify(normalize(current)) === JSON.stringify(normalize(next));
}

function ensureUniqueEntries(entries: QualityDefinitionEntry[]) {
	const normalized = entries.map((entry) => entry.quality_name.trim().toLowerCase());
	const unique = new Set(normalized);
	if (unique.size !== normalized.length) {
		throw new Error('Quality definitions cannot contain duplicate quality names');
	}
}
