/**
 * Custom format general read queries
 */

import type { PCDCache } from '#pcd/index.ts';
import type { CustomFormatGeneral } from '#shared/pcd/display.ts';

/**
 * Get general information for a single custom format
 */
export async function general(
	cache: PCDCache,
	formatId: number
): Promise<CustomFormatGeneral | null> {
	const db = cache.kb;

	// Get the custom format
	const format = await db
		.selectFrom('custom_formats')
		.select(['id', 'name', 'description', 'include_in_rename'])
		.where('id', '=', formatId)
		.executeTakeFirst();

	if (!format) return null;

	// Get tags for this format
	const tags = await db
		.selectFrom('custom_format_tags as cft')
		.innerJoin('tags as t', 't.name', 'cft.tag_name')
		.select(['t.name as tag_name', 't.created_at as tag_created_at'])
		.where('cft.custom_format_name', '=', format.name)
		.orderBy('t.name')
		.execute();

	return {
		id: format.id,
		name: format.name,
		description: format.description || '',
		include_in_rename: format.include_in_rename === 1,
		tags: tags.map((tag) => ({
			name: tag.tag_name,
			created_at: tag.tag_created_at
		}))
	};
}
