/**
 * Delete a regular expression operation
 */

import type { PCDCache } from '$pcd/index.ts';
import { writeOperation, type OperationLayer } from '$pcd/index.ts';
import { generalSettingsQueries } from '$db/queries/generalSettings.ts';
import { getConditionRefsForRegex } from '$pcd/references.ts';
import type { RegularExpressionWithTags } from '$shared/pcd/display.ts';
import { uuid } from '$shared/utils/uuid.ts';

interface DeleteRegularExpressionOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	/** The current regular expression data (for value guards) */
	current: RegularExpressionWithTags;
}

/**
 * Escape a string for SQL
 */
function esc(value: string): string {
	return value.replace(/'/g, "''");
}

/**
 * Delete a regular expression by writing an operation to the specified layer
 * Uses value guards to detect conflicts with upstream changes
 */
export async function remove(options: DeleteRegularExpressionOptions) {
	const { databaseId, cache, layer, current } = options;
	const db = cache.kb;

	const queries = [];
	const groupId = uuid();

	if (generalSettingsQueries.shouldFailOnReferencedDelete()) {
		const conditionRefs = await getConditionRefsForRegex(cache, current.name);
		const formatCount = new Set(conditionRefs.map((ref) => ref.cfId)).size;
		if (formatCount > 0) {
			return {
				success: false,
				error: `Referenced by ${formatCount} custom format${formatCount === 1 ? '' : 's'}`
			};
		}
	}

	// 1. Capture any custom format conditions that reference this regex
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

	// 2. Create custom format condition removal ops (so they appear as updates)
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

	const conditionOps = [];

	for (const [formatName, conditions] of conditionsByFormat.entries()) {
		const conditionQueries = conditions.map((condition) =>
			db
				.deleteFrom('custom_format_conditions')
				.where('custom_format_name', '=', condition.custom_format_name)
				.where('name', '=', condition.condition_name)
				.where('type', '=', condition.type ?? '')
				.where('arr_type', '=', condition.arr_type ?? 'all')
				.where('negate', '=', condition.negate ?? 0)
				.where('required', '=', condition.required ?? 0)
				.compile()
		);

		const removedConditions = conditions.map((condition) => ({
			name: condition.condition_name,
			base: {
				type: condition.type,
				arrType: condition.arr_type,
				negate: !!condition.negate,
				required: !!condition.required
			},
			values: {
				patterns: [
					{
						name: current.name,
						pattern: current.pattern
					}
				]
			}
		}));

		conditionOps.push({
			formatName,
			queries: conditionQueries,
			removedConditions
		});
	}

	// 2. Prepare regex delete query before any writes (cache will recompile)
	const deleteRegex = db
		.deleteFrom('regular_expressions')
		// Value guard by name only. Once the user has decided to delete, the
		// other field values don't matter — they're about to be gone. Matches
		// the delete contract used by custom_format and quality_profile.
		.where('name', '=', current.name)
		.compile();

	// 3. Write custom format condition removal ops first (ordered before regex delete)
	for (const conditionOp of conditionOps) {
		const result = await writeOperation({
			databaseId,
			layer,
			description: `update-conditions-${conditionOp.formatName}`,
			queries: conditionOp.queries,
			desiredState: {
				conditions: {
					removed: conditionOp.removedConditions
				}
			},
			metadata: {
				operation: 'update',
				entity: 'custom_format',
				name: conditionOp.formatName,
				stableKey: { key: 'custom_format_name', value: conditionOp.formatName },
				groupId,
				generated: true,
				changedFields: ['conditions'],
				summary: 'Update custom format conditions',
				title: `Update conditions for custom format "${conditionOp.formatName}"`
			}
		});

		if (!result.success) {
			return result;
		}
	}

	// 4. Delete tag links first (foreign key constraint)
	for (const tag of current.tags) {
		const removeTagLink = {
			sql: `DELETE FROM regular_expression_tags WHERE regular_expression_name = '${esc(current.name)}' AND tag_name = '${esc(tag.name)}'`,
			parameters: [],
			query: {} as never
		};
		queries.push(removeTagLink);
	}

	// 5. Delete the regular expression with value guards
	queries.push(deleteRegex);

	// Write the operation
	const result = await writeOperation({
		databaseId,
		layer,
		description: `delete-regular-expression-${current.name}`,
		queries,
		desiredState: {
			deleted: true,
			name: current.name,
			pattern: current.pattern,
			description: current.description ?? null,
			regex101_id: current.regex101_id ?? null,
			tags: current.tags.map((tag) => tag.name)
		},
		metadata: {
			operation: 'delete',
			entity: 'regular_expression',
			name: current.name,
			stableKey: { key: 'regular_expression_name', value: current.name },
			groupId,
			changedFields: ['deleted'],
			summary: 'Delete regular expression',
			title: `Delete regular expression "${current.name}"`
		}
	});

	return result;
}
