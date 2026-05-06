/**
 * Quality definitions update operations
 */

import type { CompiledQuery } from 'kysely';
import type { PCDCache, WriteResult } from '$pcd/index.ts';
import { writeOperation, type OperationLayer } from '$pcd/index.ts';
import type { QualityDefinitionEntry, QualityDefinitionsConfig } from '$shared/pcd/display.ts';
import { uuid } from '$shared/utils/uuid.ts';

type QualityDefinitionsTable = 'radarr_quality_definitions' | 'sonarr_quality_definitions';

type SizeField = 'min_size' | 'max_size' | 'preferred_size';

type SizeValues = Pick<QualityDefinitionEntry, 'min_size' | 'max_size' | 'preferred_size'>;

interface TierChange {
	kind: 'tier';
	qualityName: string;
	changedFields: SizeField[];
	from: SizeValues;
	to: SizeValues;
}

interface NameChange {
	kind: 'name';
	from: string;
	to: string;
}

type Change = TierChange | NameChange;

interface QualityDefinitionsConfigShape {
	table: QualityDefinitionsTable;
	stableKey: string;
	label: 'Radarr' | 'Sonarr';
}

const RADARR_CONFIG: QualityDefinitionsConfigShape = {
	table: 'radarr_quality_definitions',
	stableKey: 'radarr_quality_definitions_name',
	label: 'Radarr'
};

const SONARR_CONFIG: QualityDefinitionsConfigShape = {
	table: 'sonarr_quality_definitions',
	stableKey: 'sonarr_quality_definitions_name',
	label: 'Sonarr'
};

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

export async function updateRadarrQualityDefinitions(
	options: UpdateQualityDefinitionsOptions
): Promise<WriteResult> {
	return updateQualityDefinitions({ ...options, config: RADARR_CONFIG });
}

export async function updateSonarrQualityDefinitions(
	options: UpdateQualityDefinitionsOptions
): Promise<WriteResult> {
	return updateQualityDefinitions({ ...options, config: SONARR_CONFIG });
}

async function updateQualityDefinitions(options: {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	current: QualityDefinitionsConfig;
	input: UpdateQualityDefinitionsInput;
	config: QualityDefinitionsConfigShape;
}): Promise<WriteResult> {
	const { databaseId, cache, layer, current, input, config } = options;
	const db = cache.kb;

	ensureUniqueEntries(input.entries);

	if (input.name !== current.name) {
		const existing = await db
			.selectFrom(config.table)
			.where((eb) => eb(eb.fn('lower', [eb.ref('name')]), '=', input.name.toLowerCase()))
			.select('name')
			.executeTakeFirst();

		if (existing) {
			throw new Error(
				`A ${config.label.toLowerCase()} quality definitions config with name "${input.name}" already exists`
			);
		}
	}

	const changes: Change[] = collectTierChanges(current.entries, input.entries);
	if (current.name !== input.name) {
		changes.push({ kind: 'name', from: current.name, to: input.name });
	}

	if (changes.length === 0) {
		return { success: true };
	}

	const groupId = changes.length > 1 ? uuid() : undefined;
	let lastResult: WriteResult | null = null;

	for (let index = 0; index < changes.length; index++) {
		const change = changes[index];
		const result = await writeOperation({
			databaseId,
			layer,
			description:
				change.kind === 'name'
					? `update-${config.label.toLowerCase()}-quality-definitions-name-${input.name}`
					: `update-${config.label.toLowerCase()}-quality-definitions-${change.qualityName}-${input.name}`,
			queries: [buildUpdateQuery(cache, config.table, current.name, change)],
			desiredState: buildDesiredState(change),
			metadata: buildMetadata(change, config, current.name, input.name, groupId),
			skipRecompile: index < changes.length - 1
		});

		if (!result.success) {
			return result;
		}
		lastResult = result;
	}

	return lastResult ?? { success: true };
}

function collectTierChanges(
	current: QualityDefinitionEntry[],
	next: QualityDefinitionEntry[]
): TierChange[] {
	const currentByName = new Map(current.map((entry) => [entry.quality_name, entry]));
	const changes: TierChange[] = [];

	for (const nextEntry of next) {
		const currentEntry = currentByName.get(nextEntry.quality_name);
		if (!currentEntry) continue;

		const changedFields: SizeField[] = [];
		if (currentEntry.min_size !== nextEntry.min_size) changedFields.push('min_size');
		if (currentEntry.max_size !== nextEntry.max_size) changedFields.push('max_size');
		if (currentEntry.preferred_size !== nextEntry.preferred_size) {
			changedFields.push('preferred_size');
		}
		if (changedFields.length === 0) continue;

		changes.push({
			kind: 'tier',
			qualityName: nextEntry.quality_name,
			changedFields,
			from: {
				min_size: currentEntry.min_size,
				max_size: currentEntry.max_size,
				preferred_size: currentEntry.preferred_size
			},
			to: {
				min_size: nextEntry.min_size,
				max_size: nextEntry.max_size,
				preferred_size: nextEntry.preferred_size
			}
		});
	}

	return changes;
}

function buildUpdateQuery(
	cache: PCDCache,
	table: QualityDefinitionsTable,
	currentName: string,
	change: Change
): CompiledQuery {
	if (change.kind === 'name') {
		if (table === 'radarr_quality_definitions') {
			return cache.kb
				.updateTable('radarr_quality_definitions')
				.set({ name: change.to })
				.where('name', '=', change.from)
				.compile();
		}
		return cache.kb
			.updateTable('sonarr_quality_definitions')
			.set({ name: change.to })
			.where('name', '=', change.from)
			.compile();
	}

	if (table === 'radarr_quality_definitions') {
		return cache.kb
			.updateTable('radarr_quality_definitions')
			.set({
				min_size: change.to.min_size,
				max_size: change.to.max_size,
				preferred_size: change.to.preferred_size
			})
			.where('name', '=', currentName)
			.where('quality_name', '=', change.qualityName)
			.where('min_size', '=', change.from.min_size)
			.where('max_size', '=', change.from.max_size)
			.where('preferred_size', '=', change.from.preferred_size)
			.compile();
	}

	return cache.kb
		.updateTable('sonarr_quality_definitions')
		.set({
			min_size: change.to.min_size,
			max_size: change.to.max_size,
			preferred_size: change.to.preferred_size
		})
		.where('name', '=', currentName)
		.where('quality_name', '=', change.qualityName)
		.where('min_size', '=', change.from.min_size)
		.where('max_size', '=', change.from.max_size)
		.where('preferred_size', '=', change.from.preferred_size)
		.compile();
}

function buildDesiredState(change: Change): Record<string, unknown> {
	if (change.kind === 'name') {
		return { name: { from: change.from, to: change.to } };
	}
	const desired: Record<string, unknown> = {};
	for (const field of change.changedFields) {
		desired[field] = { from: change.from[field], to: change.to[field] };
	}
	return desired;
}

function buildMetadata(
	change: Change,
	config: QualityDefinitionsConfigShape,
	currentName: string,
	inputName: string,
	groupId: string | undefined
) {
	if (change.kind === 'name') {
		return {
			operation: 'update' as const,
			entity: config.table,
			name: inputName,
			previousName: currentName,
			stableKey: { key: config.stableKey, value: currentName },
			...(groupId && { groupId }),
			changedFields: ['name'],
			summary: `Rename ${config.label} quality definitions`,
			title: `Rename ${config.label} quality definitions "${currentName}"`
		};
	}

	return {
		operation: 'update' as const,
		entity: config.table,
		name: inputName,
		stableKey: { key: config.stableKey, value: currentName },
		qualityName: change.qualityName,
		...(groupId && { groupId }),
		changedFields: change.changedFields,
		summary: `Update ${config.label} quality definitions`,
		title: `Update ${config.label} quality definitions "${inputName}" tier "${change.qualityName}"`
	};
}

function ensureUniqueEntries(entries: QualityDefinitionEntry[]) {
	const normalized = entries.map((entry) => entry.quality_name.trim().toLowerCase());
	const unique = new Set(normalized);
	if (unique.size !== normalized.length) {
		throw new Error('Quality definitions cannot contain duplicate quality names');
	}
}
