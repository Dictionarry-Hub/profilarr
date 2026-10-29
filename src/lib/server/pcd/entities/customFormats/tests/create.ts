/**
 * Create a custom format test operation
 */

import { getCache, writeOperation, type OperationLayer } from '#pcd/index.ts';

interface CreateTestInput {
	title: string;
	type: 'movie' | 'series';
	should_match: boolean;
	description: string | null;
}

interface CreateTestOptions {
	databaseId: number;
	layer: OperationLayer;
	formatName: string;
	input: CreateTestInput;
	skipRecompile?: boolean;
}

/**
 * Escape a string for SQL
 */
function esc(value: string): string {
	return value.replace(/'/g, "''");
}

/**
 * Create a custom format test by writing an operation to the specified layer
 */
export async function createTest(options: CreateTestOptions) {
	const { databaseId, layer, formatName, input, skipRecompile } = options;

	// Ensure unique (format, title, type)
	const cache = getCache(databaseId);
	if (!cache) {
		throw new Error('Database cache not available');
	}

	const existing = await cache.kb
		.selectFrom('custom_format_tests')
		.where('custom_format_name', '=', formatName)
		.where((eb) => eb(eb.fn('lower', [eb.ref('title')]), '=', input.title.toLowerCase()))
		.where((eb) => eb(eb.fn('lower', [eb.ref('type')]), '=', input.type.toLowerCase()))
		.select('id')
		.executeTakeFirst();

	if (existing) {
		throw new Error('A test with this title and type already exists for this custom format');
	}

	// Build raw SQL using cf() helper to resolve custom format by name
	const descriptionValue = input.description ? `'${esc(input.description)}'` : 'NULL';

	const insertTest = {
		sql: `INSERT INTO custom_format_tests (custom_format_name, title, type, should_match, description) VALUES ('${esc(formatName)}', '${esc(input.title)}', '${esc(input.type)}', ${input.should_match ? 1 : 0}, ${descriptionValue})`,
		parameters: [],
		query: {} as never
	};

	// Write the operation
	const result = await writeOperation({
		databaseId,
		layer,
		description: `create-test-${formatName}`,
		queries: [insertTest],
		skipRecompile,
		desiredState: {
			custom_format_name: formatName,
			title: input.title,
			type: input.type,
			should_match: input.should_match,
			description: input.description ?? null,
			test_title: input.title,
			test_type: input.type,
			test_should_match: input.should_match,
			test_description: input.description ?? null
		},
		metadata: {
			operation: 'create',
			entity: 'custom_format',
			name: formatName,
			stableKey: { key: 'custom_format_name', value: formatName },
			summary: 'Create custom format test',
			title: `Create test for custom format "${formatName}"`
		}
	});

	return result;
}
