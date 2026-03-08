/**
 * Update a custom format test operation
 */

import { getCache, writeOperation, type OperationLayer } from '$pcd/index.ts';
import type { CustomFormatTest } from '$shared/pcd/display.ts';

interface UpdateTestInput {
	title: string;
	type: 'movie' | 'series';
	should_match: boolean;
	description: string | null;
}

interface UpdateTestOptions {
	databaseId: number;
	layer: OperationLayer;
	formatName: string;
	/** The current test data (for value guards) */
	current: CustomFormatTest;
	/** The new values */
	input: UpdateTestInput;
}

/**
 * Escape a string for SQL
 */
function esc(value: string): string {
	return value.replace(/'/g, "''");
}

/**
 * Update a custom format test by writing an operation to the specified layer
 * Uses value guards to detect conflicts with upstream changes
 */
export async function updateTest(options: UpdateTestOptions) {
	const { databaseId, layer, formatName, current, input } = options;

	// Ensure unique (format, title, type) when changing key fields
	if (
		input.title.toLowerCase() !== current.title.toLowerCase() ||
		input.type.toLowerCase() !== current.type.toLowerCase()
	) {
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
	}

	const rawCurrentDescription = current.description;
	const normalizedCurrentDescription = rawCurrentDescription ?? '';
	const normalizedNextDescription = input.description?.trim() ?? '';
	const descriptionChanged = normalizedCurrentDescription !== normalizedNextDescription;

	// Update with value guards on the current values
	// We match on id AND verify the current values haven't changed
	const setParts: string[] = [];
	if (current.title !== input.title) {
		setParts.push(`title = '${esc(input.title)}'`);
	}
	if (current.type !== input.type) {
		setParts.push(`type = '${esc(input.type)}'`);
	}
	if (current.should_match !== input.should_match) {
		setParts.push(`should_match = ${input.should_match ? 1 : 0}`);
	}
	if (descriptionChanged) {
		const descriptionValue =
			normalizedNextDescription === '' ? 'NULL' : `'${esc(normalizedNextDescription)}'`;
		setParts.push(`description = ${descriptionValue}`);
	}

	const guardParts: string[] = [
		`custom_format_name = '${esc(formatName)}'`,
		`title = '${esc(current.title)}'`,
		`type = '${esc(current.type)}'`
	];
	if (current.should_match !== input.should_match) {
		guardParts.push(`should_match = ${current.should_match ? 1 : 0}`);
	}
	if (descriptionChanged) {
		if (rawCurrentDescription === null) {
			guardParts.push(`description IS NULL`);
		} else {
			guardParts.push(`description = '${esc(rawCurrentDescription)}'`);
		}
	}

	const updateTest =
		setParts.length > 0
			? {
					sql: `UPDATE custom_format_tests SET ${setParts.join(', ')} WHERE ${guardParts.join(
						' AND '
					)}`,
					parameters: [],
					query: {} as never
				}
			: null;

	const changedFields = [];
	if (current.title !== input.title) changedFields.push('title');
	if (current.type !== input.type) changedFields.push('type');
	if (current.should_match !== input.should_match) changedFields.push('should_match');
	if (descriptionChanged) changedFields.push('description');

	const desiredState: Record<string, unknown> = {};

	desiredState.test_title = input.title;
	desiredState.test_type = input.type;
	desiredState.test_should_match = input.should_match;
	desiredState.test_description =
		normalizedNextDescription === '' ? null : normalizedNextDescription;
	if (current.title !== input.title) {
		desiredState.title = { from: current.title, to: input.title };
	}
	if (current.type !== input.type) {
		desiredState.type = { from: current.type, to: input.type };
	}
	if (current.should_match !== input.should_match) {
		desiredState.should_match = { from: current.should_match, to: input.should_match };
	}
	if (descriptionChanged) {
		desiredState.description = {
			from: rawCurrentDescription ?? null,
			to: normalizedNextDescription === '' ? null : normalizedNextDescription
		};
	}

	if (!updateTest) {
		return { success: true };
	}

	// Write the operation
	const result = await writeOperation({
		databaseId,
		layer,
		description: `update-test-${formatName}`,
		queries: [updateTest],
		desiredState,
		metadata: {
			operation: 'update',
			entity: 'custom_format',
			name: formatName,
			stableKey: { key: 'custom_format_name', value: formatName },
			changedFields,
			summary: 'Update custom format test',
			title: `Update test for custom format "${formatName}"`
		}
	});

	return result;
}
