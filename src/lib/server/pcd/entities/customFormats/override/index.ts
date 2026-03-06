import type { WriteResult } from '$pcd/index.ts';
import type { StoredOpMetadata, StoredDesiredState } from '$pcd/conflicts/overrideUtils.ts';
import { overrideGeneral } from './general.ts';
import { overrideConditions } from './conditions.ts';
import { overrideTests } from './tests.ts';

const GENERAL_FIELDS = new Set(['name', 'description', 'include_in_rename', 'tags']);

function hasGeneralChanges(metadata: StoredOpMetadata | null): boolean {
	if (!metadata?.changed_fields?.length) return true; // no field info = assume general
	return metadata.changed_fields.some((f) => GENERAL_FIELDS.has(f));
}

function hasConditionChanges(
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): boolean {
	if (metadata?.changed_fields?.includes('conditions')) return true;
	if (desiredState?.conditions) return true;
	return false;
}

function hasTestChanges(
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): boolean {
	if (metadata?.summary?.toLowerCase().includes('test')) return true;
	if (metadata?.title?.toLowerCase().includes('test')) return true;
	if (desiredState?.test_title) return true;
	return false;
}

export async function overrideCreate(
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<WriteResult> {
	// Test creates are standalone ops
	if (hasTestChanges(metadata, desiredState)) {
		return overrideTests(databaseId, metadata, desiredState);
	}

	// Creates may touch general + conditions
	const generalResult = await overrideGeneral(databaseId, metadata, desiredState);
	if (!generalResult.success) return generalResult;

	if (hasConditionChanges(metadata, desiredState)) {
		return overrideConditions(databaseId, metadata, desiredState);
	}

	return generalResult;
}

export async function overrideUpdate(
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<WriteResult> {
	// Test updates are standalone ops
	if (hasTestChanges(metadata, desiredState)) {
		return overrideTests(databaseId, metadata, desiredState);
	}

	// Route based on changed_fields
	if (hasConditionChanges(metadata, desiredState)) {
		return overrideConditions(databaseId, metadata, desiredState);
	}

	if (hasGeneralChanges(metadata)) {
		return overrideGeneral(databaseId, metadata, desiredState);
	}

	return { success: true };
}
