/**
 * Custom format test read queries
 */

import type { PCDCache } from '#pcd/index.ts';
import type { CustomFormatBasic, CustomFormatTest } from '#shared/pcd/display.ts';

/**
 * Get custom format basic info by ID
 */
export async function getById(
	cache: PCDCache,
	formatId: number
): Promise<CustomFormatBasic | null> {
	const db = cache.kb;

	const format = await db
		.selectFrom('custom_formats')
		.select(['id', 'name', 'description', 'include_in_rename'])
		.where('id', '=', formatId)
		.executeTakeFirst();

	if (!format) return null;

	return {
		...format,
		include_in_rename: format.include_in_rename === 1
	};
}

/**
 * Get all tests for a custom format
 */
export async function listTests(cache: PCDCache, formatName: string): Promise<CustomFormatTest[]> {
	const db = cache.kb;

	const tests = await db
		.selectFrom('custom_format_tests')
		.select(['custom_format_name', 'title', 'type', 'should_match', 'description'])
		.where('custom_format_name', '=', formatName)
		.orderBy('title')
		.execute();

	return tests.map((test) => ({
		...test,
		should_match: test.should_match === 1
	}));
}

/**
 * Get a single test by composite key
 */
export async function getTest(
	cache: PCDCache,
	formatName: string,
	title: string,
	type: string
): Promise<CustomFormatTest | null> {
	const db = cache.kb;

	const test = await db
		.selectFrom('custom_format_tests')
		.select(['custom_format_name', 'title', 'type', 'should_match', 'description'])
		.where('custom_format_name', '=', formatName)
		.where('title', '=', title)
		.where('type', '=', type)
		.executeTakeFirst();

	if (!test) return null;

	return {
		...test,
		should_match: test.should_match === 1
	};
}
