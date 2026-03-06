import { getCache } from '$pcd/index.ts';
import type { WriteResult } from '$pcd/index.ts';
import type { ConditionData } from '$shared/pcd/display.ts';
import { getConditionsForEvaluation } from '../conditions/read.ts';
import { updateConditions } from '../conditions/update.ts';
import type { StoredOpMetadata, StoredDesiredState } from '$pcd/conflicts/overrideUtils.ts';
import { resolveFormatName } from './resolve.ts';

/**
 * Reconstruct a ConditionData from a desired-state condition entry.
 * Handles both "added" entries (flat base + values) and "updated" entries ({from, to}).
 */
function toConditionData(entry: Record<string, unknown>): ConditionData | null {
	const name = entry.name as string | undefined;
	if (!name) return null;

	// "updated" entries have {from, to} for base and values
	const base = (
		entry.base && typeof entry.base === 'object' && 'to' in entry.base
			? (entry.base as { to: Record<string, unknown> }).to
			: entry.base
	) as Record<string, unknown> | undefined;

	const values = (
		entry.values && typeof entry.values === 'object' && 'to' in entry.values
			? (entry.values as { to: Record<string, unknown> }).to
			: entry.values
	) as Record<string, unknown> | undefined;

	return {
		name,
		type: (base?.type as string) ?? '',
		arrType: (base?.arrType as 'all' | 'radarr' | 'sonarr') ?? 'all',
		negate: (base?.negate as boolean) ?? false,
		required: (base?.required as boolean) ?? false,
		patterns: values?.patterns as ConditionData['patterns'],
		languages: values?.languages as ConditionData['languages'],
		sources: values?.sources as ConditionData['sources'],
		resolutions: values?.resolutions as ConditionData['resolutions'],
		qualityModifiers: values?.qualityModifiers as ConditionData['qualityModifiers'],
		releaseTypes: values?.releaseTypes as ConditionData['releaseTypes'],
		indexerFlags: values?.indexerFlags as ConditionData['indexerFlags'],
		size: values?.size as ConditionData['size'],
		years: values?.years as ConditionData['years']
	};
}

/**
 * Override conditions for a custom format.
 *
 * Reads current conditions, applies the desired diff (added/removed/updated),
 * and writes the result via updateConditions.
 */
export async function overrideConditions(
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<WriteResult> {
	if (!desiredState) {
		return { success: false, error: 'Missing desired state for condition override' };
	}

	const cache = getCache(databaseId);
	if (!cache) {
		return { success: false, error: 'Cache not available' };
	}

	const formatName = await resolveFormatName(cache, databaseId, metadata, desiredState);
	if (!formatName) {
		return { success: false, error: 'Custom format not found for condition override' };
	}

	const currentConditions = await getConditionsForEvaluation(cache, formatName);

	// Parse the desired diff
	const conditionsDiff = desiredState.conditions as
		| {
				added?: Record<string, unknown>[];
				removed?: Record<string, unknown>[];
				updated?: Record<string, unknown>[];
		  }
		| undefined;

	if (!conditionsDiff) {
		// No conditions diff — nothing to do
		return { success: true };
	}

	const added = (conditionsDiff.added ?? [])
		.map(toConditionData)
		.filter((c): c is ConditionData => c !== null);
	const removedNames = new Set(
		(conditionsDiff.removed ?? []).map((e) => e.name as string).filter(Boolean)
	);
	const updatedMap = new Map<string, ConditionData>();
	for (const entry of conditionsDiff.updated ?? []) {
		const c = toConditionData(entry);
		if (c) updatedMap.set(c.name, c);
	}

	// Reconstruct target conditions: current minus removed, with updates applied, plus added
	const target: ConditionData[] = [];
	for (const c of currentConditions) {
		if (removedNames.has(c.name)) continue;
		const updated = updatedMap.get(c.name);
		target.push(updated ?? c);
	}
	// If an updated condition no longer exists, treat it as an add.
	for (const [name, updated] of updatedMap.entries()) {
		if (currentConditions.some((c) => c.name === name)) continue;
		if (removedNames.has(name)) continue;
		target.push(updated);
	}
	for (const c of added) {
		target.push(c);
	}

	return updateConditions({
		databaseId,
		cache,
		layer: 'user',
		formatName,
		originalConditions: currentConditions,
		conditions: target
	});
}
