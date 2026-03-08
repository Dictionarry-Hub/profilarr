import { getCache } from '$pcd/index.ts';
import type { WriteResult } from '$pcd/index.ts';
import { getTest } from '../tests/read.ts';
import { createTest } from '../tests/create.ts';
import { updateTest } from '../tests/update.ts';
import type { StoredOpMetadata, StoredDesiredState } from '$pcd/conflicts/overrideUtils.ts';
import { getDesiredTo, normalizeText } from '$pcd/conflicts/overrideUtils.ts';
import { resolveFormatName } from './resolve.ts';

/**
 * Extract the desired test values from the op's desired_state.
 * Test ops store flat fields: test_title, test_type, test_should_match, test_description.
 * Update ops may also have {from, to} diffs on title/type/should_match/description.
 */
function resolveTestValues(desiredState: StoredDesiredState): {
	title: string;
	type: 'movie' | 'series';
	should_match: boolean;
	description: string | null;
} | null {
	const title =
		getDesiredTo<string>(desiredState.title) ??
		(typeof desiredState.test_title === 'string' ? desiredState.test_title : null);
	if (!title) return null;

	const rawType =
		getDesiredTo<string>(desiredState.type) ??
		(typeof desiredState.test_type === 'string' ? desiredState.test_type : 'movie');
	const type = rawType === 'series' ? 'series' : 'movie';

	const rawMatch = getDesiredTo(desiredState.should_match) ?? desiredState.test_should_match;
	const should_match =
		typeof rawMatch === 'boolean' ? rawMatch : rawMatch === 1 || rawMatch === true;

	const rawDesc =
		getDesiredTo<string | null>(desiredState.description) ?? desiredState.test_description;
	const description = typeof rawDesc === 'string' ? rawDesc.trim() || null : null;

	return { title, type, should_match, description };
}

/**
 * Resolve the original test title (before rename) so we can find the current row.
 */
function resolveOriginalTitle(desiredState: StoredDesiredState): string | null {
	// If title has {from, to}, the original is "from"
	const titleField = desiredState.title;
	if (titleField && typeof titleField === 'object' && 'from' in titleField) {
		return (titleField as { from: string }).from;
	}
	// Otherwise the title hasn't changed — use the flat value
	return typeof desiredState.test_title === 'string' ? desiredState.test_title : null;
}

function resolveOriginalType(desiredState: StoredDesiredState): string {
	const typeField = desiredState.type;
	if (typeField && typeof typeField === 'object' && 'from' in typeField) {
		return (typeField as { from: string }).from;
	}
	return typeof desiredState.test_type === 'string' ? desiredState.test_type : 'movie';
}

/**
 * Override a test for a custom format.
 *
 * For creates: ensure the test exists with desired values.
 * For updates: apply desired values to the existing test.
 */
export async function overrideTests(
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<WriteResult> {
	if (!desiredState) {
		return { success: false, error: 'Missing desired state for test override' };
	}

	const cache = getCache(databaseId);
	if (!cache) {
		return { success: false, error: 'Cache not available' };
	}

	const formatName = await resolveFormatName(cache, databaseId, metadata, desiredState);
	if (!formatName) {
		return { success: false, error: 'Custom format not found for test override' };
	}

	const desired = resolveTestValues(desiredState);
	if (!desired) {
		return { success: false, error: 'Cannot resolve test values from desired state' };
	}

	// Try to find the existing test by its original title/type (pre-rename)
	const origTitle = resolveOriginalTitle(desiredState);
	const origType = resolveOriginalType(desiredState);
	const current = origTitle ? await getTest(cache, formatName, origTitle, origType) : null;

	if (current) {
		// Test exists — check if it already matches desired
		const matches =
			normalizeText(current.title) === normalizeText(desired.title) &&
			current.type === desired.type &&
			current.should_match === desired.should_match &&
			normalizeText(current.description) === normalizeText(desired.description ?? '');

		if (matches) {
			return { success: true };
		}

		return updateTest({
			databaseId,
			layer: 'user',
			formatName,
			current,
			input: desired
		});
	}

	// Test doesn't exist — check if it already exists with the desired title/type
	const existingWithDesiredKey = await getTest(cache, formatName, desired.title, desired.type);
	if (existingWithDesiredKey) {
		const matches =
			existingWithDesiredKey.should_match === desired.should_match &&
			normalizeText(existingWithDesiredKey.description) ===
				normalizeText(desired.description ?? '');

		if (matches) {
			return { success: true };
		}

		return updateTest({
			databaseId,
			layer: 'user',
			formatName,
			current: existingWithDesiredKey,
			input: desired
		});
	}

	// Doesn't exist at all — create it
	return createTest({
		databaseId,
		layer: 'user',
		formatName,
		input: desired
	});
}
