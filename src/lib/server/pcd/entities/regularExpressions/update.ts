/**
 * Update a regular expression operation
 */

import type { PCDCache } from '$pcd/index.ts';
import { writeOperation, type OperationLayer, type WriteResult } from '$pcd/index.ts';
import type { RegularExpressionWithTags } from '$shared/pcd/display.ts';
import { uuid } from '$shared/utils/uuid.ts';
import { logger } from '$logger/logger.ts';
import type { CompiledQuery } from 'kysely';

interface UpdateRegularExpressionInput {
	name: string;
	pattern: string;
	tags: string[];
	description: string | null;
	regex101Id: string | null;
}

interface UpdateRegularExpressionOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	/** The current regular expression data (for value guards) */
	current: RegularExpressionWithTags;
	/** The new values */
	input: UpdateRegularExpressionInput;
}

/**
 * Escape a string for SQL
 */
function esc(value: string): string {
	return value.replace(/'/g, "''");
}

/**
 * Update a regular expression by writing per-field operations to the specified
 * layer. Each changed field is emitted as its own op so non-conflicting changes
 * survive when an upstream PCD modifies a different field. Renames cascade to
 * dependent custom format conditions in grouped, generated ops.
 */
export async function update(options: UpdateRegularExpressionOptions) {
	const { databaseId, cache, layer, current, input } = options;
	const db = cache.kb;
	const isRename = input.name !== current.name;

	if (isRename) {
		const existing = await db
			.selectFrom('regular_expressions')
			.where((eb) => eb(eb.fn('lower', [eb.ref('name')]), '=', input.name.toLowerCase()))
			.select('name')
			.executeTakeFirst();

		if (existing) {
			await logger.warn(`Duplicate regular expression name "${input.name}"`, {
				source: 'RegularExpression',
				meta: { databaseId, name: input.name }
			});
			throw new Error(`A regular expression with name "${input.name}" already exists`);
		}
	}

	const rawCurrentDescription = current.description;
	const normalizedCurrentDescription = rawCurrentDescription?.trim() ?? '';
	const normalizedNextDescription = input.description?.trim() ?? '';
	const rawCurrentRegex101Id = current.regex101_id;
	const normalizedCurrentRegex101Id = rawCurrentRegex101Id?.trim() ?? '';
	const normalizedNextRegex101Id = input.regex101Id?.trim() ?? '';
	const descriptionChanged = normalizedCurrentDescription !== normalizedNextDescription;
	const regex101Changed = normalizedCurrentRegex101Id !== normalizedNextRegex101Id;
	const patternChanged = current.pattern !== input.pattern;

	const descriptionNext = normalizedNextDescription === '' ? null : normalizedNextDescription;
	const regex101Next = normalizedNextRegex101Id === '' ? null : normalizedNextRegex101Id;

	// Per-field query arrays
	const descriptionQueries: CompiledQuery[] = [];
	if (descriptionChanged) {
		let updateDescription = db
			.updateTable('regular_expressions')
			.set({ description: descriptionNext })
			.where('name', '=', current.name);
		if (rawCurrentDescription === null) {
			updateDescription = updateDescription.where('description', 'is', null);
		} else {
			updateDescription = updateDescription.where('description', '=', rawCurrentDescription);
		}
		descriptionQueries.push(updateDescription.compile());
	}

	const regex101Queries: CompiledQuery[] = [];
	if (regex101Changed) {
		let updateRegex101 = db
			.updateTable('regular_expressions')
			.set({ regex101_id: regex101Next })
			.where('name', '=', current.name);
		if (rawCurrentRegex101Id === null) {
			updateRegex101 = updateRegex101.where('regex101_id', 'is', null);
		} else {
			updateRegex101 = updateRegex101.where('regex101_id', '=', rawCurrentRegex101Id);
		}
		regex101Queries.push(updateRegex101.compile());
	}

	const patternQueries: CompiledQuery[] = [];
	if (patternChanged) {
		const updatePattern = db
			.updateTable('regular_expressions')
			.set({ pattern: input.pattern })
			.where('name', '=', current.name)
			.where('pattern', '=', current.pattern);
		patternQueries.push(updatePattern.compile());
	}

	const renameQueries: CompiledQuery[] = [];
	if (isRename) {
		const updateName = db
			.updateTable('regular_expressions')
			.set({ name: input.name })
			.where('name', '=', current.name);
		renameQueries.push(updateName.compile());
	}

	// Tag changes — emitted before rename so the row name still matches current.name
	const currentTagNames = current.tags.map((t) => t.name);
	const newTagNames = Array.from(new Set(input.tags.map((tag) => tag.trim()).filter(Boolean)));
	const regexNameForTags = current.name;

	const tagsToRemove = currentTagNames.filter((t) => !newTagNames.includes(t));
	const tagsToAdd = newTagNames.filter((t) => !currentTagNames.includes(t));
	const tagQueries: CompiledQuery[] = [];

	for (const tagName of tagsToRemove) {
		const removeTag = {
			sql: `DELETE FROM regular_expression_tags WHERE regular_expression_name = '${esc(regexNameForTags)}' AND tag_name = '${esc(tagName)}'`,
			parameters: [],
			query: {} as never
		};
		tagQueries.push(removeTag);
	}

	for (const tagName of tagsToAdd) {
		const insertTag = db
			.insertInto('tags')
			.values({ name: tagName })
			.onConflict((oc) => oc.column('name').doNothing())
			.compile();

		tagQueries.push(insertTag);

		const linkTag = {
			sql: `INSERT INTO regular_expression_tags (regular_expression_name, tag_name) VALUES ('${esc(regexNameForTags)}', '${esc(tagName)}')`,
			parameters: [],
			query: {} as never
		};
		tagQueries.push(linkTag);
	}

	// Dependent custom format conditions when the regex is renamed
	const dependentOps: Array<{
		formatName: string;
		queries: CompiledQuery[];
		updatedConditions: Array<{
			name: string;
			base: {
				from: { type?: string; arrType?: string; negate: boolean; required: boolean };
				to: { type?: string; arrType?: string; negate: boolean; required: boolean };
			};
			values: {
				from: { patterns: Array<{ name: string; pattern: string }> };
				to: { patterns: Array<{ name: string; pattern: string }> };
			};
		}>;
	}> = [];

	if (isRename) {
		const dependentConditions = await db
			.selectFrom('condition_patterns as cp')
			.innerJoin('custom_format_conditions as cfc', (join) =>
				join
					.onRef('cfc.custom_format_name', '=', 'cp.custom_format_name')
					.onRef('cfc.name', '=', 'cp.condition_name')
			)
			.select([
				'cp.custom_format_name',
				'cp.condition_name',
				'cfc.type',
				'cfc.arr_type',
				'cfc.negate',
				'cfc.required'
			])
			.where('cp.regular_expression_name', '=', current.name)
			.orderBy('cp.custom_format_name')
			.orderBy('cp.condition_name')
			.execute();

		const conditionsByFormat = new Map<
			string,
			Array<{
				custom_format_name: string;
				condition_name: string;
				type?: string;
				arr_type?: string;
				negate?: number;
				required?: number;
			}>
		>();

		for (const condition of dependentConditions) {
			if (!conditionsByFormat.has(condition.custom_format_name)) {
				conditionsByFormat.set(condition.custom_format_name, []);
			}
			conditionsByFormat.get(condition.custom_format_name)!.push(condition);
		}

		// The next pattern value seen by dependent ops depends on whether the
		// pattern itself is being changed in this batch.
		const patternForDependents = patternChanged ? input.pattern : current.pattern;

		for (const [formatName, conditions] of conditionsByFormat.entries()) {
			const conditionQueries = conditions.map((condition) =>
				db
					.updateTable('condition_patterns')
					.set({ regular_expression_name: input.name })
					.where('custom_format_name', '=', condition.custom_format_name)
					.where('condition_name', '=', condition.condition_name)
					.where('regular_expression_name', '=', current.name)
					.compile()
			);

			const updatedConditions = conditions.map((condition) => ({
				name: condition.condition_name,
				base: {
					from: {
						type: condition.type,
						arrType: condition.arr_type,
						negate: !!condition.negate,
						required: !!condition.required
					},
					to: {
						type: condition.type,
						arrType: condition.arr_type,
						negate: !!condition.negate,
						required: !!condition.required
					}
				},
				values: {
					from: {
						patterns: [
							{
								name: current.name,
								pattern: current.pattern
							}
						]
					},
					to: {
						patterns: [
							{
								name: input.name,
								pattern: patternForDependents
							}
						]
					}
				}
			}));

			if (conditionQueries.length > 0) {
				dependentOps.push({ formatName, queries: conditionQueries, updatedConditions });
			}
		}
	}

	// Log what's being changed
	const changes: Record<string, { from: unknown; to: unknown }> = {};
	if (isRename) {
		changes.name = { from: current.name, to: input.name };
	}
	if (patternChanged) {
		changes.pattern = { from: current.pattern, to: input.pattern };
	}
	if (descriptionChanged) {
		changes.description = {
			from: rawCurrentDescription ?? null,
			to: descriptionNext
		};
	}
	if (regex101Changed) {
		changes.regex101_id = {
			from: rawCurrentRegex101Id ?? null,
			to: regex101Next
		};
	}
	if (tagsToAdd.length > 0 || tagsToRemove.length > 0) {
		changes.tags = { from: currentTagNames, to: newTagNames };
	}

	const hasDescriptionChanges = descriptionQueries.length > 0;
	const hasRegex101Changes = regex101Queries.length > 0;
	const hasPatternChanges = patternQueries.length > 0;
	const hasTagChanges = tagQueries.length > 0;
	const hasRenameChanges = renameQueries.length > 0;

	const opCount = [
		hasDescriptionChanges,
		hasRegex101Changes,
		hasPatternChanges,
		hasTagChanges,
		hasRenameChanges
	].filter(Boolean).length;
	const shouldGroup = opCount > 1 || (hasRenameChanges && dependentOps.length > 0);
	const groupId = shouldGroup ? uuid() : undefined;

	if (opCount === 0) {
		return { success: true };
	}

	await logger.info(`Save regular expression "${input.name}"`, {
		source: 'RegularExpression',
		meta: {
			id: current.id,
			changes
		}
	});

	let lastResult: WriteResult | null = null;

	if (hasDescriptionChanges) {
		const descriptionResult = await writeOperation({
			databaseId,
			layer,
			description: `update-regular-expression-description-${current.name}`,
			queries: descriptionQueries,
			desiredState: {
				description: {
					from: rawCurrentDescription ?? null,
					to: descriptionNext
				}
			},
			metadata: {
				operation: 'update',
				entity: 'regular_expression',
				name: current.name,
				stableKey: { key: 'regular_expression_name', value: current.name },
				...(groupId && { groupId }),
				changedFields: ['description'],
				summary: 'Update regular expression description',
				title: `Update description for regular expression "${current.name}"`
			}
		});

		if (!descriptionResult.success) {
			return descriptionResult;
		}
		lastResult = descriptionResult;
	}

	if (hasRegex101Changes) {
		const regex101Result = await writeOperation({
			databaseId,
			layer,
			description: `update-regular-expression-regex101-${current.name}`,
			queries: regex101Queries,
			desiredState: {
				regex101_id: {
					from: rawCurrentRegex101Id ?? null,
					to: regex101Next
				}
			},
			metadata: {
				operation: 'update',
				entity: 'regular_expression',
				name: current.name,
				stableKey: { key: 'regular_expression_name', value: current.name },
				...(groupId && { groupId }),
				changedFields: ['regex101_id'],
				summary: 'Update regular expression regex101 link',
				title: `Update regex101 link for regular expression "${current.name}"`
			}
		});

		if (!regex101Result.success) {
			return regex101Result;
		}
		lastResult = regex101Result;
	}

	if (hasPatternChanges) {
		const patternResult = await writeOperation({
			databaseId,
			layer,
			description: `update-regular-expression-pattern-${current.name}`,
			queries: patternQueries,
			desiredState: {
				pattern: { from: current.pattern, to: input.pattern }
			},
			metadata: {
				operation: 'update',
				entity: 'regular_expression',
				name: current.name,
				stableKey: { key: 'regular_expression_name', value: current.name },
				...(groupId && { groupId }),
				changedFields: ['pattern'],
				summary: 'Update regular expression pattern',
				title: `Update pattern for regular expression "${current.name}"`
			}
		});

		if (!patternResult.success) {
			return patternResult;
		}
		lastResult = patternResult;
	}

	if (hasTagChanges) {
		const tagsResult = await writeOperation({
			databaseId,
			layer,
			description: `update-regular-expression-tags-${current.name}`,
			queries: tagQueries,
			desiredState: { tags: { add: tagsToAdd, remove: tagsToRemove } },
			metadata: {
				operation: 'update',
				entity: 'regular_expression',
				name: current.name,
				stableKey: { key: 'regular_expression_name', value: current.name },
				...(groupId && { groupId }),
				changedFields: ['tags'],
				summary: 'Update regular expression tags',
				title: `Update tags for regular expression "${current.name}"`
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
			description: `update-regular-expression-name-${input.name}`,
			queries: renameQueries,
			desiredState: {
				name: { from: current.name, to: input.name }
			},
			metadata: {
				operation: 'update',
				entity: 'regular_expression',
				name: input.name,
				previousName: current.name,
				stableKey: { key: 'regular_expression_name', value: current.name },
				...(groupId && { groupId }),
				changedFields: ['name'],
				summary: 'Rename regular expression',
				title: `Rename regular expression "${current.name}"`
			}
		});

		if (!renameResult.success) {
			return renameResult;
		}
		lastResult = renameResult;
	}

	if (!hasRenameChanges || dependentOps.length === 0 || !groupId) {
		return lastResult ?? { success: true };
	}

	for (const op of dependentOps) {
		const conditionResult = await writeOperation({
			databaseId,
			layer,
			description: `update-conditions-${op.formatName}`,
			queries: op.queries,
			desiredState: {
				conditions: {
					updated: op.updatedConditions
				}
			},
			metadata: {
				operation: 'update',
				entity: 'custom_format',
				name: op.formatName,
				stableKey: { key: 'custom_format_name', value: op.formatName },
				groupId,
				generated: true,
				dependsOn: [
					{
						entity: 'regular_expression',
						key: 'regular_expression_name',
						value: input.name
					}
				],
				changedFields: ['conditions'],
				summary: 'Update custom format conditions',
				title: `Update conditions for custom format "${op.formatName}"`
			}
		});

		if (!conditionResult.success) {
			return conditionResult;
		}
	}

	return lastResult ?? { success: true };
}
