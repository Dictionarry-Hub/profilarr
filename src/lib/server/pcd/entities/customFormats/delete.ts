/**
 * Delete a custom format operation
 */

import type { PCDCache } from '$pcd/index.ts';
import { writeOperation, type OperationLayer } from '$pcd/index.ts';
import { uuid } from '$shared/utils/uuid.ts';

interface DeleteCustomFormatOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	/** The custom format ID */
	formatId: number;
	/** The custom format name (for metadata and value guards) */
	formatName: string;
}

/**
 * Delete a custom format by writing an operation to the specified layer
 * Cascading deletes handle conditions, tests, and tag links
 */
export async function remove(options: DeleteCustomFormatOptions) {
	const { databaseId, cache, layer, formatName } = options;
	const db = cache.kb;

	const queries = [];
	const groupId = uuid();

	const dependentScores = await db
		.selectFrom('quality_profile_custom_formats')
		.select(['quality_profile_name', 'custom_format_name', 'arr_type', 'score'])
		.where('custom_format_name', '=', formatName)
		.orderBy('quality_profile_name')
		.orderBy('arr_type')
		.execute();

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

	const formatRow = await db
		.selectFrom('custom_formats')
		.select(['description', 'include_in_rename'])
		.where('name', '=', formatName)
		.executeTakeFirst();

	const conditionCountRow = await db
		.selectFrom('custom_format_conditions')
		.select(db.fn.count<number>('custom_format_name').as('count'))
		.where('custom_format_name', '=', formatName)
		.executeTakeFirst();
	const testCountRow = await db
		.selectFrom('custom_format_tests')
		.select(db.fn.count<number>('custom_format_name').as('count'))
		.where('custom_format_name', '=', formatName)
		.executeTakeFirst();
	const tagCountRow = await db
		.selectFrom('custom_format_tags')
		.select(db.fn.count<number>('custom_format_name').as('count'))
		.where('custom_format_name', '=', formatName)
		.executeTakeFirst();

	// Prepare custom format delete query before writing other ops
	const deleteFormat = db
		.deleteFrom('custom_formats')
		// Value guard - ensure this is the format we expect
		.where('name', '=', formatName)
		.compile();

	// Write quality profile scoring removals first (so they appear as updates)
	for (const [profileName, scores] of scoresByProfile.entries()) {
		const scoreQueries = scores.map((score) =>
			db
				.deleteFrom('quality_profile_custom_formats')
				.where('quality_profile_name', '=', profileName)
				.where('custom_format_name', '=', score.custom_format_name)
				.where('arr_type', '=', score.arr_type)
				.where('score', '=', score.score)
				.compile()
		);

		const result = await writeOperation({
			databaseId,
			layer,
			description: `update-quality-profile-scoring-${profileName}`,
			queries: scoreQueries,
			desiredState: {
				custom_format_scores: scores.map((score) => ({
					custom_format_name: score.custom_format_name,
					arr_type: score.arr_type,
					from: score.score,
					to: null
				}))
			},
			metadata: {
				operation: 'update',
				entity: 'quality_profile',
				name: profileName,
				stableKey: { key: 'quality_profile_name', value: profileName },
				groupId,
				generated: true,
				changedFields: ['custom_format_scores'],
				summary: 'Update quality profile scoring',
				title: `Update scoring for quality profile "${profileName}"`
			}
		});

		if (!result.success) {
			return result;
		}
	}

	// Delete the custom format with value guards
	// Foreign key cascades will handle:
	// - custom_format_tags
	// - custom_format_conditions (and their type-specific tables)
	// - custom_format_tests
	queries.push(deleteFormat);

	// Write the operation
	const result = await writeOperation({
		databaseId,
		layer,
		description: `delete-custom-format-${formatName}`,
		queries,
		desiredState: {
			deleted: true,
			name: formatName,
			description: formatRow?.description ?? null,
			include_in_rename: formatRow?.include_in_rename === 1,
			counts: {
				conditions: conditionCountRow?.count ?? 0,
				tests: testCountRow?.count ?? 0,
				tags: tagCountRow?.count ?? 0
			}
		},
		metadata: {
			operation: 'delete',
			entity: 'custom_format',
			name: formatName,
			stableKey: { key: 'custom_format_name', value: formatName },
			groupId,
			changedFields: ['deleted'],
			summary: 'Delete custom format',
			title: `Delete custom format "${formatName}"`
		}
	});

	return result;
}
