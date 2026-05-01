/**
 * Regular expression read operations
 */

import { sql } from 'kysely';
import type { PCDCache } from '$pcd/index.ts';
import type { Tag, RegularExpressionWithTags } from '$shared/pcd/display.ts';
import { getConditionRefCountsForRegexes } from '$pcd/references.ts';

/**
 * List all regular expressions with tags
 */
export async function list(cache: PCDCache): Promise<RegularExpressionWithTags[]> {
	const db = cache.kb;

	// Get all regular expressions
	const expressions = await db
		.selectFrom('regular_expressions')
		.select(['id', 'name', 'pattern', 'regex101_id', 'description', 'created_at', 'updated_at'])
		.orderBy(sql`name COLLATE NOCASE`)
		.execute();

	if (expressions.length === 0) return [];

	const expressionNames = expressions.map((e) => e.name);
	const referenceCounts = await getConditionRefCountsForRegexes(cache, expressionNames);

	// Get all tags for all expressions
	const allTags = await db
		.selectFrom('regular_expression_tags as ret')
		.innerJoin('tags as t', 't.name', 'ret.tag_name')
		.select(['ret.regular_expression_name', 't.name as tag_name', 't.created_at as tag_created_at'])
		.where('ret.regular_expression_name', 'in', expressionNames)
		.orderBy('ret.regular_expression_name')
		.orderBy('t.name')
		.execute();

	// Build tags map
	const tagsMap = new Map<string, Tag[]>();
	for (const tag of allTags) {
		if (!tagsMap.has(tag.regular_expression_name)) {
			tagsMap.set(tag.regular_expression_name, []);
		}
		tagsMap.get(tag.regular_expression_name)!.push({
			name: tag.tag_name,
			created_at: tag.tag_created_at
		});
	}

	// Build the final result
	return expressions.map((expression) => ({
		...expression,
		tags: tagsMap.get(expression.name) || [],
		referenceCount: referenceCounts.get(expression.name) || 0
	}));
}

/**
 * Get a single regular expression by ID with tags
 */
export async function get(cache: PCDCache, id: number): Promise<RegularExpressionWithTags | null> {
	const db = cache.kb;

	// Get the regular expression
	const regex = await db
		.selectFrom('regular_expressions')
		.select(['id', 'name', 'pattern', 'regex101_id', 'description', 'created_at', 'updated_at'])
		.where('id', '=', id)
		.executeTakeFirst();

	if (!regex) {
		return null;
	}

	// Get tags for this regular expression
	const tags = await db
		.selectFrom('regular_expression_tags as ret')
		.innerJoin('tags as t', 't.name', 'ret.tag_name')
		.select(['t.name', 't.created_at'])
		.where('ret.regular_expression_name', '=', regex.name)
		.execute();
	const referenceCounts = await getConditionRefCountsForRegexes(cache, [regex.name]);

	return {
		...regex,
		tags,
		referenceCount: referenceCounts.get(regex.name) || 0
	};
}
