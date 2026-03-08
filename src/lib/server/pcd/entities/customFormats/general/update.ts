/**
 * Update custom format general information
 */

import type { PCDCache } from '$pcd/index.ts';
import { writeOperation, type OperationLayer, type WriteResult } from '$pcd/index.ts';
import type { CustomFormatGeneral } from '$shared/pcd/display.ts';
import { uuid } from '$shared/utils/uuid.ts';
import { logger } from '$logger/logger.ts';
import type { CompiledQuery } from 'kysely';

interface UpdateGeneralInput {
	name: string;
	description: string;
	includeInRename: boolean;
	tags: string[];
}

interface UpdateGeneralOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	/** The current custom format data (for value guards) */
	current: CustomFormatGeneral;
	/** The new values */
	input: UpdateGeneralInput;
}

/**
 * Escape a string for SQL
 */
function esc(value: string): string {
	return value.replace(/'/g, "''");
}

/**
 * Update custom format general information
 */
export async function updateGeneral(options: UpdateGeneralOptions) {
	const { databaseId, cache, layer, current, input } = options;
	const db = cache.kb;
	const isRename = input.name !== current.name;

	if (input.name !== current.name) {
		const existing = await db
			.selectFrom('custom_formats')
			.where((eb) => eb(eb.fn('lower', [eb.ref('name')]), '=', input.name.toLowerCase()))
			.select('name')
			.executeTakeFirst();

		if (existing) {
			await logger.warn(`Duplicate custom format name "${input.name}"`, {
				source: 'CustomFormat',
				meta: { databaseId, name: input.name }
			});
			throw new Error(`A custom format with name "${input.name}" already exists`);
		}
	}

	// Query actual DB value for description (read.ts converts null to '' which breaks value guards)
	// This handles backwards compatibility for existing CFs with NULL descriptions
	const rawFormat = await db
		.selectFrom('custom_formats')
		.select('description')
		.where('name', '=', current.name)
		.executeTakeFirst();
	const rawCurrentDescription = rawFormat?.description ?? null;

	const normalizedCurrentDescription = rawCurrentDescription ?? '';
	const normalizedNextDescription = input.description?.trim() ?? '';
	const descriptionChanged = normalizedCurrentDescription !== normalizedNextDescription;

	// 1. Build per-field update queries with value guards
	// Store empty descriptions as '' (not null) to match v1 translator behavior
	const descriptionNext = normalizedNextDescription;
	const descriptionQueries: CompiledQuery[] = [];
	if (descriptionChanged) {
		let updateDescription = db
			.updateTable('custom_formats')
			.set({ description: descriptionNext })
			.where('name', '=', current.name);
		// Use actual DB value for value guard (handles both NULL and '' for backwards compat)
		if (rawCurrentDescription === null) {
			updateDescription = updateDescription.where('description', 'is', null);
		} else {
			updateDescription = updateDescription.where('description', '=', rawCurrentDescription);
		}
		descriptionQueries.push(updateDescription.compile());
	}

	const includeChanged = current.include_in_rename !== input.includeInRename;
	const includeQueries: CompiledQuery[] = [];
	if (includeChanged) {
		const updateInclude = db
			.updateTable('custom_formats')
			.set({ include_in_rename: input.includeInRename ? 1 : 0 })
			.where('name', '=', current.name)
			.where('include_in_rename', '=', current.include_in_rename ? 1 : 0);
		includeQueries.push(updateInclude.compile());
	}

	const renameQueries: CompiledQuery[] = [];
	if (isRename) {
		const updateName = db
			.updateTable('custom_formats')
			.set({ name: input.name })
			.where('name', '=', current.name);
		renameQueries.push(updateName.compile());
	}

	// 2. Handle tag changes
	const currentTagNames = current.tags.map((t) => t.name);
	const newTagNames = Array.from(new Set(input.tags.map((tag) => tag.trim()).filter(Boolean)));

	const formatNameForTags = current.name;

	// Tags to remove
	const tagsToRemove = currentTagNames.filter((t) => !newTagNames.includes(t));
	const tagQueries: CompiledQuery[] = [];
	for (const tagName of tagsToRemove) {
		const removeTag = {
			sql: `DELETE FROM custom_format_tags WHERE custom_format_name = '${esc(formatNameForTags)}' AND tag_name = '${esc(tagName)}'`,
			parameters: [],
			query: {} as never
		};
		tagQueries.push(removeTag);
	}

	// Tags to add
	const tagsToAdd = newTagNames.filter((t) => !currentTagNames.includes(t));
	for (const tagName of tagsToAdd) {
		// Insert tag if not exists
		const insertTag = db
			.insertInto('tags')
			.values({ name: tagName })
			.onConflict((oc) => oc.column('name').doNothing())
			.compile();

		tagQueries.push(insertTag);

		// Link tag to custom format
		const linkTag = {
			sql: `INSERT INTO custom_format_tags (custom_format_name, tag_name) VALUES ('${esc(formatNameForTags)}', '${esc(tagName)}')`,
			parameters: [],
			query: {} as never
		};

		tagQueries.push(linkTag);
	}

	const dependentScores = isRename
		? await db
				.selectFrom('quality_profile_custom_formats')
				.select(['quality_profile_name', 'custom_format_name', 'arr_type', 'score'])
				.where('custom_format_name', '=', current.name)
				.execute()
		: [];

	const dependentOps: Array<{
		profileName: string;
		queries: CompiledQuery[];
		customFormatScores: Array<{
			custom_format_name: string;
			arr_type: string;
			from: number | null;
			to: number | null;
		}>;
	}> = [];

	if (dependentScores.length > 0) {
		const scoresByProfile = new Map<
			string,
			Array<{ custom_format_name: string; arr_type: string; score: number }>
		>();

		for (const score of dependentScores) {
			if (!scoresByProfile.has(score.quality_profile_name)) {
				scoresByProfile.set(score.quality_profile_name, []);
			}
			scoresByProfile.get(score.quality_profile_name)!.push({
				custom_format_name: score.custom_format_name,
				arr_type: score.arr_type,
				score: score.score
			});
		}

		for (const [profileName, scores] of scoresByProfile.entries()) {
			const scoreQueries = scores.map((score) =>
				db
					.updateTable('quality_profile_custom_formats')
					.set({ custom_format_name: input.name })
					.where('quality_profile_name', '=', profileName)
					.where('custom_format_name', '=', current.name)
					.where('arr_type', '=', score.arr_type)
					.where('score', '=', score.score)
					.compile()
			);

			const customFormatScores = scores.flatMap((score) => [
				{
					custom_format_name: current.name,
					arr_type: score.arr_type,
					from: score.score,
					to: null
				},
				{
					custom_format_name: input.name,
					arr_type: score.arr_type,
					from: null,
					to: score.score
				}
			]);

			dependentOps.push({ profileName, queries: scoreQueries, customFormatScores });
		}
	}

	// Log what's being changed
	const changes: Record<string, { from: unknown; to: unknown }> = {};

	if (current.name !== input.name) {
		changes.name = { from: current.name, to: input.name };
	}
	if (descriptionChanged) {
		changes.description = {
			from: rawCurrentDescription ?? '',
			to: normalizedNextDescription
		};
	}
	if (current.include_in_rename !== input.includeInRename) {
		changes.include_in_rename = {
			from: current.include_in_rename,
			to: input.includeInRename
		};
	}
	if (tagsToAdd.length > 0 || tagsToRemove.length > 0) {
		changes.tags = { from: currentTagNames, to: newTagNames };
	}

	await logger.info(`Save custom format "${input.name}"`, {
		source: 'CustomFormat',
		meta: {
			id: current.id,
			changes
		}
	});

	const hasDescriptionChanges = descriptionQueries.length > 0;
	const hasIncludeChanges = includeQueries.length > 0;
	const hasTagChanges = tagsToAdd.length > 0 || tagsToRemove.length > 0;
	const hasRenameChanges = renameQueries.length > 0;
	const opCount = [
		hasDescriptionChanges,
		hasIncludeChanges,
		hasTagChanges,
		hasRenameChanges
	].filter(Boolean).length;
	const shouldGroup = opCount > 1 || (hasRenameChanges && dependentOps.length > 0);
	const groupId = shouldGroup ? uuid() : undefined;

	if (opCount === 0) {
		return { success: true };
	}

	let lastResult: WriteResult | null = null;

	if (hasDescriptionChanges) {
		const descriptionResult = await writeOperation({
			databaseId,
			layer,
			description: `update-custom-format-description-${input.name}`,
			queries: descriptionQueries,
			desiredState: {
				description: {
					from: rawCurrentDescription ?? '',
					to: normalizedNextDescription
				}
			},
			metadata: {
				operation: 'update',
				entity: 'custom_format',
				name: input.name,
				stableKey: { key: 'custom_format_name', value: current.name },
				...(groupId && { groupId }),
				changedFields: ['description'],
				summary: 'Update custom format description',
				title: `Update description for custom format "${input.name}"`
			}
		});

		if (!descriptionResult.success) {
			return descriptionResult;
		}
		lastResult = descriptionResult;
	}

	if (hasIncludeChanges) {
		const includeResult = await writeOperation({
			databaseId,
			layer,
			description: `update-custom-format-include-rename-${input.name}`,
			queries: includeQueries,
			desiredState: {
				include_in_rename: {
					from: current.include_in_rename,
					to: input.includeInRename
				}
			},
			metadata: {
				operation: 'update',
				entity: 'custom_format',
				name: input.name,
				stableKey: { key: 'custom_format_name', value: current.name },
				...(groupId && { groupId }),
				changedFields: ['include_in_rename'],
				summary: 'Update custom format include in rename',
				title: `Update include in rename for custom format "${input.name}"`
			}
		});

		if (!includeResult.success) {
			return includeResult;
		}
		lastResult = includeResult;
	}

	if (hasTagChanges) {
		const tagsResult = await writeOperation({
			databaseId,
			layer,
			description: `update-custom-format-tags-${input.name}`,
			queries: tagQueries,
			desiredState: { tags: { add: tagsToAdd, remove: tagsToRemove } },
			metadata: {
				operation: 'update',
				entity: 'custom_format',
				name: input.name,
				stableKey: { key: 'custom_format_name', value: current.name },
				...(groupId && { groupId }),
				changedFields: ['tags'],
				summary: 'Update custom format tags',
				title: `Update tags for custom format "${input.name}"`
			}
		});

		if (!tagsResult.success) {
			return tagsResult;
		}
		lastResult = tagsResult;
	}

	if (hasRenameChanges) {
		const renameResult = await writeOperation({
			databaseId,
			layer,
			description: `update-custom-format-name-${input.name}`,
			queries: renameQueries,
			desiredState: {
				name: { from: current.name, to: input.name }
			},
			metadata: {
				operation: 'update',
				entity: 'custom_format',
				name: input.name,
				previousName: current.name,
				stableKey: { key: 'custom_format_name', value: current.name },
				...(groupId && { groupId }),
				changedFields: ['name'],
				summary: 'Rename custom format',
				title: `Rename custom format "${current.name}"`
			}
		});

		if (!renameResult.success) {
			return renameResult;
		}
		lastResult = renameResult;
	}

	if (!hasRenameChanges || dependentScores.length === 0 || !groupId) {
		return lastResult ?? { success: true };
	}
	if (dependentOps.length === 0) {
		return lastResult ?? { success: true };
	}

	for (const op of dependentOps) {
		const scoreResult = await writeOperation({
			databaseId,
			layer,
			description: `update-quality-profile-scoring-${op.profileName}`,
			queries: op.queries,
			desiredState: {
				custom_format_scores: op.customFormatScores
			},
			metadata: {
				operation: 'update',
				entity: 'quality_profile',
				name: op.profileName,
				stableKey: { key: 'quality_profile_name', value: op.profileName },
				groupId,
				generated: true,
				dependsOn: [
					{
						entity: 'custom_format',
						key: 'custom_format_name',
						value: input.name
					}
				],
				changedFields: ['custom_format_scores'],
				summary: 'Update quality profile scoring',
				title: `Update scoring for quality profile "${op.profileName}"`
			}
		});

		if (!scoreResult.success) {
			return scoreResult;
		}
	}

	return lastResult ?? { success: true };
}
