/**
 * Delete a custom format test operation
 */

import { writeOperation, type OperationLayer } from '#pcd/index.ts';
import type { CustomFormatTest } from '#shared/pcd/display.ts';

interface DeleteTestOptions {
	databaseId: number;
	layer: OperationLayer;
	formatName: string;
	/** The current test data (for value guards) */
	current: CustomFormatTest;
}

/**
 * Escape a string for SQL
 */
function esc(value: string): string {
	return value.replace(/'/g, "''");
}

/**
 * Delete a custom format test by writing an operation to the specified layer
 * Uses value guards to detect conflicts with upstream changes
 */
export async function deleteTest(options: DeleteTestOptions) {
	const { databaseId, layer, formatName, current } = options;

	const currentDescription = current.description ?? null;

	// Delete with value guards to ensure we're deleting the expected record
	const deleteTestQuery = {
		sql: `DELETE FROM custom_format_tests
WHERE custom_format_name = '${esc(formatName)}'
  AND title = '${esc(current.title)}'
  AND type = '${esc(current.type)}'
  AND should_match = ${current.should_match ? 1 : 0}
  AND description ${currentDescription === null ? 'IS NULL' : `= '${esc(currentDescription)}'`}`,
		parameters: [],
		query: {} as never
	};

	// Write the operation
	const result = await writeOperation({
		databaseId,
		layer,
		description: `delete-test-${formatName}`,
		queries: [deleteTestQuery],
		desiredState: {
			deleted: true,
			custom_format_name: formatName,
			title: current.title,
			type: current.type,
			should_match: current.should_match,
			description: currentDescription,
			test_title: current.title,
			test_type: current.type,
			test_should_match: current.should_match,
			test_description: currentDescription
		},
		metadata: {
			operation: 'delete',
			entity: 'custom_format',
			name: formatName,
			stableKey: { key: 'custom_format_name', value: formatName },
			changedFields: ['deleted'],
			summary: 'Delete custom format test',
			title: `Delete test for custom format "${formatName}"`
		}
	});

	return result;
}
