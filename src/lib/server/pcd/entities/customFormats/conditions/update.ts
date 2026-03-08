/**
 * Update custom format conditions
 *
 * This mutation handles:
 * - Deleting removed conditions
 * - Inserting new conditions (from drafts with negative IDs)
 * - Updating existing conditions
 */

import type { PCDCache } from '$pcd/index.ts';
import {
	writeOperation,
	recompileCache,
	type OperationLayer,
	type WriteResult
} from '$pcd/index.ts';
import type { ConditionData } from '$shared/pcd/display.ts';
import { uuid } from '$shared/utils/uuid.ts';
import { logger } from '$logger/logger.ts';

interface UpdateConditionsOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	/** The custom format name */
	formatName: string;
	/** Current conditions from the database (for comparison) */
	originalConditions: ConditionData[];
	/** The new/modified conditions from the client */
	conditions: ConditionData[];
}

/**
 * Escape a string for SQL
 */
function esc(value: string): string {
	return value.replace(/'/g, "''");
}

/**
 * Generate SQL to insert a condition's type-specific data using name-based FKs
 */
function generateConditionValueSql(
	formatName: string,
	conditionName: string,
	condition: ConditionData
): string[] {
	const sqls: string[] = [];

	switch (condition.type) {
		case 'release_title':
		case 'release_group':
		case 'edition':
			if (condition.patterns && condition.patterns.length > 0) {
				for (const pattern of condition.patterns) {
					sqls.push(
						`INSERT INTO condition_patterns (custom_format_name, condition_name, regular_expression_name) VALUES ('${esc(formatName)}', '${esc(conditionName)}', '${esc(pattern.name)}')`
					);
				}
			}
			break;

		case 'language':
			if (condition.languages && condition.languages.length > 0) {
				for (const lang of condition.languages) {
					sqls.push(
						`INSERT INTO condition_languages (custom_format_name, condition_name, language_name, except_language) VALUES ('${esc(formatName)}', '${esc(conditionName)}', '${esc(lang.name)}', ${lang.except ? 1 : 0})`
					);
				}
			}
			break;

		case 'source':
			if (condition.sources && condition.sources.length > 0) {
				for (const source of condition.sources) {
					sqls.push(
						`INSERT INTO condition_sources (custom_format_name, condition_name, source) VALUES ('${esc(formatName)}', '${esc(conditionName)}', '${esc(source)}')`
					);
				}
			}
			break;

		case 'resolution':
			if (condition.resolutions && condition.resolutions.length > 0) {
				for (const res of condition.resolutions) {
					sqls.push(
						`INSERT INTO condition_resolutions (custom_format_name, condition_name, resolution) VALUES ('${esc(formatName)}', '${esc(conditionName)}', '${esc(res)}')`
					);
				}
			}
			break;

		case 'quality_modifier':
			if (condition.qualityModifiers && condition.qualityModifiers.length > 0) {
				for (const qm of condition.qualityModifiers) {
					sqls.push(
						`INSERT INTO condition_quality_modifiers (custom_format_name, condition_name, quality_modifier) VALUES ('${esc(formatName)}', '${esc(conditionName)}', '${esc(qm)}')`
					);
				}
			}
			break;

		case 'release_type':
			if (condition.releaseTypes && condition.releaseTypes.length > 0) {
				for (const rt of condition.releaseTypes) {
					sqls.push(
						`INSERT INTO condition_release_types (custom_format_name, condition_name, release_type) VALUES ('${esc(formatName)}', '${esc(conditionName)}', '${esc(rt)}')`
					);
				}
			}
			break;

		case 'indexer_flag':
			if (condition.indexerFlags && condition.indexerFlags.length > 0) {
				for (const flag of condition.indexerFlags) {
					sqls.push(
						`INSERT INTO condition_indexer_flags (custom_format_name, condition_name, flag) VALUES ('${esc(formatName)}', '${esc(conditionName)}', '${esc(flag)}')`
					);
				}
			}
			break;

		case 'size':
			if (condition.size) {
				const minBytes = condition.size.minBytes ?? 'NULL';
				const maxBytes = condition.size.maxBytes ?? 'NULL';
				sqls.push(
					`INSERT INTO condition_sizes (custom_format_name, condition_name, min_bytes, max_bytes) VALUES ('${esc(formatName)}', '${esc(conditionName)}', ${minBytes}, ${maxBytes})`
				);
			}
			break;

		case 'year':
			if (condition.years) {
				const minYear = condition.years.minYear ?? 'NULL';
				const maxYear = condition.years.maxYear ?? 'NULL';
				sqls.push(
					`INSERT INTO condition_years (custom_format_name, condition_name, min_year, max_year) VALUES ('${esc(formatName)}', '${esc(conditionName)}', ${minYear}, ${maxYear})`
				);
			}
			break;
	}

	return sqls;
}

/**
 * Update conditions for a custom format
 *
 * Strategy:
 * 1. Find conditions to delete (in original but not in new)
 * 2. Find conditions to add (new conditions not in original)
 * 3. Find conditions to update (names that exist in both)
 */
export async function updateConditions(options: UpdateConditionsOptions) {
	const { databaseId, layer, formatName, originalConditions, conditions } = options;

	// Validate unique condition names (case-insensitive)
	const normalizedNames = conditions.map((c) => c.name.trim().toLowerCase());
	const uniqueNames = new Set(normalizedNames);
	if (uniqueNames.size !== normalizedNames.length) {
		throw new Error('Condition names must be unique');
	}

	const typeFieldMap: Record<string, { field: keyof ConditionData; label: string } | null> = {
		release_title: { field: 'patterns', label: 'pattern' },
		release_group: { field: 'patterns', label: 'pattern' },
		edition: { field: 'patterns', label: 'pattern' },
		language: { field: 'languages', label: 'language' },
		source: { field: 'sources', label: 'source' },
		resolution: { field: 'resolutions', label: 'resolution' },
		quality_modifier: { field: 'qualityModifiers', label: 'quality modifier' },
		release_type: { field: 'releaseTypes', label: 'release type' },
		indexer_flag: { field: 'indexerFlags', label: 'indexer flag' },
		size: null,
		year: null
	};

	for (const condition of conditions) {
		const mapping = typeFieldMap[condition.type] ?? null;
		if (!mapping) continue;
		const values = condition[mapping.field] as unknown[] | undefined;
		if (Array.isArray(values) && values.length > 1) {
			throw new Error(`Condition "${condition.name}" must have a single ${mapping.label}`);
		}
	}

	// Get names of conditions to keep
	const newConditionNames = new Set(conditions.map((c) => c.name));
	const originalConditionNames = new Set(originalConditions.map((c) => c.name));

	const conditionOps: Array<{
		description: string;
		queries: Array<{ sql: string; parameters: unknown[]; query: never }>;
		desiredState: Record<string, unknown>;
		summary: string;
		title: string;
		changedFields: string[];
		groupId?: string;
		dependsOn?: Array<{ entity: string; key: string; value: string }>;
	}> = [];

	// 1. Delete removed conditions (cascade will handle type-specific tables)
	const conditionsToDelete = originalConditions.filter((c) => !newConditionNames.has(c.name));
	const newConditions = conditions.filter((c) => !originalConditionNames.has(c.name));

	// Renames are emitted as delete+add. Group matching pairs so align drops both together.
	const groupedDeleteByName = new Map<string, string>();
	const groupedAddByName = new Map<string, string>();
	const newConditionsByFingerprint = new Map<string, ConditionData[]>();

	for (const condition of newConditions) {
		const fingerprint = getConditionFingerprint(condition);
		const existing = newConditionsByFingerprint.get(fingerprint) ?? [];
		existing.push(condition);
		newConditionsByFingerprint.set(fingerprint, existing);
	}

	for (const condition of conditionsToDelete) {
		const fingerprint = getConditionFingerprint(condition);
		const candidates = newConditionsByFingerprint.get(fingerprint);
		if (!candidates || candidates.length === 0) continue;

		const match = candidates.shift();
		if (!match) continue;

		const groupId = uuid();
		groupedDeleteByName.set(condition.name, groupId);
		groupedAddByName.set(match.name, groupId);
	}

	for (const condition of conditionsToDelete) {
		const deleteQueries = [
			{
				sql: `DELETE FROM custom_format_conditions
	WHERE custom_format_name = '${esc(formatName)}'
	  AND name = '${esc(condition.name)}'
	  AND type = '${esc(condition.type)}'
	  AND arr_type = '${esc(condition.arrType ?? 'all')}'
	  AND negate = ${condition.negate ? 1 : 0}
	  AND required = ${condition.required ? 1 : 0}`,
				parameters: [],
				query: {} as never
			}
		];

		conditionOps.push({
			description: `delete-condition-${formatName}-${condition.name}`,
			queries: deleteQueries,
			desiredState: {
				conditions: {
					removed: [
						{
							name: condition.name,
							base: baseSnapshot(condition),
							values: getConditionValues(condition)
						}
					]
				}
			},
			summary: 'Remove custom format condition',
			title: `Remove condition "${condition.name}" from "${formatName}"`,
			changedFields: ['conditions', `condition:${condition.name}`],
			groupId: groupedDeleteByName.get(condition.name)
		});
	}

	// 2. Handle new conditions (names not in original)
	for (const condition of newConditions) {
		const insertQueries: Array<{ sql: string; parameters: unknown[]; query: never }> = [];

		// Insert the base condition
		insertQueries.push({
			sql: `INSERT INTO custom_format_conditions (custom_format_name, name, type, arr_type, negate, required)
VALUES ('${esc(formatName)}', '${esc(condition.name)}', '${esc(condition.type)}', '${esc(condition.arrType ?? 'all')}', ${condition.negate ? 1 : 0}, ${condition.required ? 1 : 0})`,
			parameters: [],
			query: {} as never
		});

		// Insert type-specific data
		const valueSqls = generateConditionValueSql(formatName, condition.name, condition);
		for (const sql of valueSqls) {
			insertQueries.push({
				sql,
				parameters: [],
				query: {} as never
			});
		}

		const regexDependencies = getRegexDependencies(condition);

		conditionOps.push({
			description: `add-condition-${formatName}-${condition.name}`,
			queries: insertQueries,
			desiredState: {
				conditions: {
					added: [
						{
							name: condition.name,
							base: baseSnapshot(condition),
							values: getConditionValues(condition)
						}
					]
				}
			},
			summary: 'Add custom format condition',
			title: `Add condition "${condition.name}" to "${formatName}"`,
			changedFields: ['conditions', `condition:${condition.name}`],
			groupId: groupedAddByName.get(condition.name),
			dependsOn: regexDependencies.map((name) => ({
				entity: 'regular_expression',
				key: 'regular_expression_name',
				value: name
			}))
		});
	}

	// 3. Handle updated conditions (names that exist in both)
	const existingConditions = conditions.filter((c) => originalConditionNames.has(c.name));
	const updatedConditions: ConditionData[] = [];
	for (const condition of existingConditions) {
		const original = originalConditions.find((c) => c.name === condition.name);
		if (!original) continue;

		const originalArrType = normalizeArrType(original);
		const nextArrType = normalizeArrType(condition);

		// Check if base condition changed
		const baseChanged =
			original.type !== condition.type ||
			originalArrType !== nextArrType ||
			original.negate !== condition.negate ||
			original.required !== condition.required;

		// For type-specific data, if type changed, delete old and insert new
		// If type same but values changed, also delete and insert
		const typeChanged = original.type !== condition.type;
		const valuesChanged = !deepEquals(getConditionValues(original), getConditionValues(condition));

		if (!baseChanged && !valuesChanged) {
			continue;
		}

		updatedConditions.push(condition);

		const updateQueries: Array<{ sql: string; parameters: unknown[]; query: never }> = [];

		if (baseChanged) {
			const setParts: string[] = [];
			if (original.type !== condition.type) {
				setParts.push(`type = '${esc(condition.type)}'`);
			}
			if (originalArrType !== nextArrType) {
				setParts.push(`arr_type = '${esc(nextArrType)}'`);
			}
			if (original.negate !== condition.negate) {
				setParts.push(`negate = ${condition.negate ? 1 : 0}`);
			}
			if (original.required !== condition.required) {
				setParts.push(`required = ${condition.required ? 1 : 0}`);
			}

			if (setParts.length > 0) {
				updateQueries.push({
					sql: `UPDATE custom_format_conditions
SET ${setParts.join(', ')}
WHERE custom_format_name = '${esc(formatName)}'
  AND name = '${esc(condition.name)}'
  AND type = '${esc(original.type)}'
  AND arr_type = '${esc(originalArrType)}'
  AND negate = ${original.negate ? 1 : 0}
  AND required = ${original.required ? 1 : 0}`,
					parameters: [],
					query: {} as never
				});
			}
		}

		if (typeChanged || valuesChanged) {
			// Delete old type-specific data based on original values
			const deleteSqls = generateConditionValueDeleteSql(formatName, condition.name, original);
			for (const sql of deleteSqls) {
				updateQueries.push({
					sql,
					parameters: [],
					query: {} as never
				});
			}

			// Insert new type-specific data
			const valueSqls = generateConditionValueSql(formatName, condition.name, condition);
			for (const sql of valueSqls) {
				updateQueries.push({
					sql,
					parameters: [],
					query: {} as never
				});
			}
		}

		const regexDependencies = getRegexDependencies(condition);

		conditionOps.push({
			description: `update-condition-${formatName}-${condition.name}`,
			queries: updateQueries,
			desiredState: {
				conditions: {
					updated: [
						{
							name: condition.name,
							base: {
								from: baseSnapshot(original),
								to: baseSnapshot(condition)
							},
							values: {
								from: getConditionValues(original),
								to: getConditionValues(condition)
							}
						}
					]
				}
			},
			summary: 'Update custom format condition',
			title: `Update condition "${condition.name}" on "${formatName}"`,
			changedFields: ['conditions', `condition:${condition.name}`],
			dependsOn: regexDependencies.map((name) => ({
				entity: 'regular_expression',
				key: 'regular_expression_name',
				value: name
			}))
		});
	}

	// If no changes, return success without writing
	if (conditionOps.length === 0) {
		return { success: true };
	}

	// Log what's being changed
	await logger.info(`Save conditions for custom format "${formatName}"`, {
		source: 'CustomFormat',
		meta: {
			formatName,
			deleted: conditionsToDelete.length,
			added: newConditions.length,
			updated: updatedConditions.length
		}
	});

	let lastResult: WriteResult | null = null;

	for (const op of conditionOps) {
		const result = await writeOperation({
			databaseId,
			layer,
			description: op.description,
			queries: op.queries,
			desiredState: op.desiredState,
			skipRecompile: true,
			metadata: {
				operation: 'update',
				entity: 'custom_format',
				name: formatName,
				stableKey: { key: 'custom_format_name', value: formatName },
				changedFields: op.changedFields,
				summary: op.summary,
				title: op.title,
				...(op.groupId ? { groupId: op.groupId } : {}),
				...(op.dependsOn && op.dependsOn.length > 0 ? { dependsOn: op.dependsOn } : {})
			}
		});

		if (!result.success) {
			await recompileCache(databaseId);
			return result;
		}

		lastResult = result;
	}

	await recompileCache(databaseId);
	return lastResult ?? { success: true };
}

function baseSnapshot(condition: ConditionData): Record<string, unknown> {
	return {
		type: condition.type,
		arrType: normalizeArrType(condition),
		negate: condition.negate,
		required: condition.required
	};
}

function normalizeArrType(condition: ConditionData): string {
	return condition.arrType || 'all';
}

function generateConditionValueDeleteSql(
	formatName: string,
	conditionName: string,
	condition: ConditionData
): string[] {
	const sqls: string[] = [];

	switch (condition.type) {
		case 'release_title':
		case 'release_group':
		case 'edition':
			if (condition.patterns && condition.patterns.length > 0) {
				for (const pattern of condition.patterns) {
					sqls.push(
						`DELETE FROM condition_patterns WHERE custom_format_name = '${esc(formatName)}' AND condition_name = '${esc(conditionName)}' AND regular_expression_name = '${esc(pattern.name)}'`
					);
				}
			} else {
				sqls.push(
					`DELETE FROM condition_patterns WHERE custom_format_name = '${esc(formatName)}' AND condition_name = '${esc(conditionName)}'`
				);
			}
			break;

		case 'language':
			if (condition.languages && condition.languages.length > 0) {
				for (const lang of condition.languages) {
					sqls.push(
						`DELETE FROM condition_languages WHERE custom_format_name = '${esc(formatName)}' AND condition_name = '${esc(conditionName)}' AND language_name = '${esc(lang.name)}' AND except_language = ${lang.except ? 1 : 0}`
					);
				}
			} else {
				sqls.push(
					`DELETE FROM condition_languages WHERE custom_format_name = '${esc(formatName)}' AND condition_name = '${esc(conditionName)}'`
				);
			}
			break;

		case 'source':
			if (condition.sources && condition.sources.length > 0) {
				for (const source of condition.sources) {
					sqls.push(
						`DELETE FROM condition_sources WHERE custom_format_name = '${esc(formatName)}' AND condition_name = '${esc(conditionName)}' AND source = '${esc(source)}'`
					);
				}
			} else {
				sqls.push(
					`DELETE FROM condition_sources WHERE custom_format_name = '${esc(formatName)}' AND condition_name = '${esc(conditionName)}'`
				);
			}
			break;

		case 'resolution':
			if (condition.resolutions && condition.resolutions.length > 0) {
				for (const res of condition.resolutions) {
					sqls.push(
						`DELETE FROM condition_resolutions WHERE custom_format_name = '${esc(formatName)}' AND condition_name = '${esc(conditionName)}' AND resolution = '${esc(res)}'`
					);
				}
			} else {
				sqls.push(
					`DELETE FROM condition_resolutions WHERE custom_format_name = '${esc(formatName)}' AND condition_name = '${esc(conditionName)}'`
				);
			}
			break;

		case 'quality_modifier':
			if (condition.qualityModifiers && condition.qualityModifiers.length > 0) {
				for (const qm of condition.qualityModifiers) {
					sqls.push(
						`DELETE FROM condition_quality_modifiers WHERE custom_format_name = '${esc(formatName)}' AND condition_name = '${esc(conditionName)}' AND quality_modifier = '${esc(qm)}'`
					);
				}
			} else {
				sqls.push(
					`DELETE FROM condition_quality_modifiers WHERE custom_format_name = '${esc(formatName)}' AND condition_name = '${esc(conditionName)}'`
				);
			}
			break;

		case 'release_type':
			if (condition.releaseTypes && condition.releaseTypes.length > 0) {
				for (const rt of condition.releaseTypes) {
					sqls.push(
						`DELETE FROM condition_release_types WHERE custom_format_name = '${esc(formatName)}' AND condition_name = '${esc(conditionName)}' AND release_type = '${esc(rt)}'`
					);
				}
			} else {
				sqls.push(
					`DELETE FROM condition_release_types WHERE custom_format_name = '${esc(formatName)}' AND condition_name = '${esc(conditionName)}'`
				);
			}
			break;

		case 'indexer_flag':
			if (condition.indexerFlags && condition.indexerFlags.length > 0) {
				for (const flag of condition.indexerFlags) {
					sqls.push(
						`DELETE FROM condition_indexer_flags WHERE custom_format_name = '${esc(formatName)}' AND condition_name = '${esc(conditionName)}' AND flag = '${esc(flag)}'`
					);
				}
			} else {
				sqls.push(
					`DELETE FROM condition_indexer_flags WHERE custom_format_name = '${esc(formatName)}' AND condition_name = '${esc(conditionName)}'`
				);
			}
			break;

		case 'size':
			if (condition.size) {
				const minBytes = condition.size.minBytes ?? 'NULL';
				const maxBytes = condition.size.maxBytes ?? 'NULL';
				sqls.push(
					`DELETE FROM condition_sizes WHERE custom_format_name = '${esc(formatName)}' AND condition_name = '${esc(conditionName)}' AND min_bytes IS ${minBytes === 'NULL' ? 'NULL' : minBytes} AND max_bytes IS ${maxBytes === 'NULL' ? 'NULL' : maxBytes}`
				);
			} else {
				sqls.push(
					`DELETE FROM condition_sizes WHERE custom_format_name = '${esc(formatName)}' AND condition_name = '${esc(conditionName)}'`
				);
			}
			break;

		case 'year':
			if (condition.years) {
				const minYear = condition.years.minYear ?? 'NULL';
				const maxYear = condition.years.maxYear ?? 'NULL';
				sqls.push(
					`DELETE FROM condition_years WHERE custom_format_name = '${esc(formatName)}' AND condition_name = '${esc(conditionName)}' AND min_year IS ${minYear === 'NULL' ? 'NULL' : minYear} AND max_year IS ${maxYear === 'NULL' ? 'NULL' : maxYear}`
				);
			} else {
				sqls.push(
					`DELETE FROM condition_years WHERE custom_format_name = '${esc(formatName)}' AND condition_name = '${esc(conditionName)}'`
				);
			}
			break;
	}

	return sqls;
}

/**
 * Get condition values for comparison
 */
function getConditionValues(condition: ConditionData): unknown {
	return {
		patterns: condition.patterns,
		languages: condition.languages,
		sources: condition.sources,
		resolutions: condition.resolutions,
		qualityModifiers: condition.qualityModifiers,
		releaseTypes: condition.releaseTypes,
		indexerFlags: condition.indexerFlags,
		size: condition.size,
		years: condition.years
	};
}

function getRegexDependencies(condition: ConditionData): string[] {
	return (condition.patterns ?? []).map((pattern) => pattern.name.trim()).filter(Boolean);
}

function getConditionFingerprint(condition: ConditionData): string {
	return JSON.stringify({
		base: baseSnapshot(condition),
		values: getConditionValues(condition)
	});
}

/**
 * Deep equality check
 */
function deepEquals(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (typeof a !== typeof b) return false;
	if (a === null || b === null) return a === b;

	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		return a.every((item, i) => deepEquals(item, b[i]));
	}

	if (typeof a === 'object' && typeof b === 'object') {
		const aObj = a as Record<string, unknown>;
		const bObj = b as Record<string, unknown>;
		const aKeys = Object.keys(aObj);
		const bKeys = Object.keys(bObj);
		if (aKeys.length !== bKeys.length) return false;
		return aKeys.every((key) => deepEquals(aObj[key], bObj[key]));
	}

	return false;
}
