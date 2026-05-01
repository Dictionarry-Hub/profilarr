/**
 * Custom format list queries
 */

import { sql } from 'kysely';
import type { PCDCache } from '$pcd/index.ts';
import type { Tag, CustomFormatTableRow, ConditionRef } from '$shared/pcd/display.ts';
import { getProfileRefCountsForCustomFormats } from '$pcd/references.ts';

/**
 * Get custom formats with full data for table/card views
 */
export async function list(cache: PCDCache): Promise<CustomFormatTableRow[]> {
	const db = cache.kb;

	// 1. Get all custom formats
	const formats = await db
		.selectFrom('custom_formats')
		.select(['id', 'name', 'description'])
		.orderBy(sql`name COLLATE NOCASE`)
		.execute();

	if (formats.length === 0) return [];

	const formatNames = formats.map((f) => f.name);

	// 2. Get all tags for all custom formats
	const allTags = await db
		.selectFrom('custom_format_tags as cft')
		.innerJoin('tags as t', 't.name', 'cft.tag_name')
		.select(['cft.custom_format_name', 't.name as tag_name', 't.created_at as tag_created_at'])
		.where('cft.custom_format_name', 'in', formatNames)
		.orderBy('cft.custom_format_name')
		.orderBy('t.name')
		.execute();

	// 3. Get all conditions for all custom formats
	const allConditions = await db
		.selectFrom('custom_format_conditions')
		.select(['custom_format_name', 'name', 'type', 'required', 'negate'])
		.where('custom_format_name', 'in', formatNames)
		.execute();

	// 4. Get test counts for all custom formats
	const testCounts = await db
		.selectFrom('custom_format_tests')
		.select(['custom_format_name'])
		.select((eb) => eb.fn.count('title').as('count'))
		.where('custom_format_name', 'in', formatNames)
		.groupBy('custom_format_name')
		.execute();

	const referenceCounts = await getProfileRefCountsForCustomFormats(cache, formatNames);

	// Build test count map
	const testCountMap = new Map<string, number>();
	for (const tc of testCounts) {
		testCountMap.set(tc.custom_format_name, Number(tc.count));
	}

	// Build tags map
	const tagsMap = new Map<string, Tag[]>();
	for (const tag of allTags) {
		if (!tagsMap.has(tag.custom_format_name)) {
			tagsMap.set(tag.custom_format_name, []);
		}
		tagsMap.get(tag.custom_format_name)!.push({
			name: tag.tag_name,
			created_at: tag.tag_created_at
		});
	}

	// Build conditions map
	const conditionsMap = new Map<string, ConditionRef[]>();
	for (const condition of allConditions) {
		if (!conditionsMap.has(condition.custom_format_name)) {
			conditionsMap.set(condition.custom_format_name, []);
		}
		conditionsMap.get(condition.custom_format_name)!.push({
			name: condition.name,
			type: condition.type,
			required: condition.required === 1,
			negate: condition.negate === 1
		});
	}

	// Build the final result
	return formats.map((format) => ({
		id: format.id,
		name: format.name,
		description: format.description,
		tags: tagsMap.get(format.name) || [],
		conditions: conditionsMap.get(format.name) || [],
		testCount: testCountMap.get(format.name) || 0,
		referenceCount: referenceCounts.get(format.name) || 0
	}));
}
