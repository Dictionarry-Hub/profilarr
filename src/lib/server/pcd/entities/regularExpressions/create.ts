/**
 * Create a regular expression operation
 */

import type { PCDCache } from '$pcd/index.ts';
import { writeOperation, type OperationLayer } from '$pcd/index.ts';
import { logger } from '$logger/logger.ts';

interface CreateRegularExpressionInput {
	name: string;
	pattern: string;
	tags: string[];
	description: string | null;
	regex101Id: string | null;
}

interface CreateRegularExpressionOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	input: CreateRegularExpressionInput;
	skipRecompile?: boolean;
}

/**
 * Escape a string for SQL
 */
function esc(value: string): string {
	return value.replace(/'/g, "''");
}

/**
 * Create a regular expression by writing an operation to the specified layer
 */
export async function create(options: CreateRegularExpressionOptions) {
	const { databaseId, cache, layer, input, skipRecompile } = options;
	const db = cache.kb;

	const queries = [];

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

	// 1. Insert the regular expression
	const insertRegex = db
		.insertInto('regular_expressions')
		.values({
			name: input.name,
			pattern: input.pattern,
			description: input.description,
			regex101_id: input.regex101Id
		})
		.compile();

	queries.push(insertRegex);

	const uniqueTags = Array.from(new Set(input.tags.map((tag) => tag.trim()).filter(Boolean)));

	// 2. Insert tags (create if not exist, then link)
	for (const tagName of uniqueTags) {
		// Insert tag if not exists
		const insertTag = db
			.insertInto('tags')
			.values({ name: tagName })
			.onConflict((oc) => oc.column('name').doNothing())
			.compile();

		queries.push(insertTag);

		// Link tag to regular expression using name-based FKs
		const linkTag = {
			sql: `INSERT INTO regular_expression_tags (regular_expression_name, tag_name) VALUES ('${esc(input.name)}', '${esc(tagName)}')`,
			parameters: [],
			query: {} as never
		};

		queries.push(linkTag);
	}

	// Write the operation
	const result = await writeOperation({
		databaseId,
		layer,
		description: `create-regular-expression-${input.name}`,
		queries,
		skipRecompile,
		desiredState: {
			name: input.name,
			pattern: input.pattern,
			description: input.description ?? null,
			regex101_id: input.regex101Id ?? null,
			tags: uniqueTags
		},
		metadata: {
			operation: 'create',
			entity: 'regular_expression',
			name: input.name,
			stableKey: { key: 'regular_expression_name', value: input.name },
			summary: 'Create regular expression',
			title: `Create regular expression "${input.name}"`
		}
	});

	return result;
}
