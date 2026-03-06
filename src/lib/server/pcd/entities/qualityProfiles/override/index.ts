import type { WriteResult } from '$pcd/index.ts';
import type { StoredOpMetadata, StoredDesiredState } from '$pcd/conflicts/overrideUtils.ts';
import { overrideGeneral } from './general.ts';
import { overrideQualities } from './qualities.ts';
import { overrideScoring } from './scoring.ts';

const GENERAL_FIELDS = new Set(['name', 'description', 'tags', 'language']);

function hasGeneralChanges(metadata: StoredOpMetadata | null): boolean {
	if (!metadata?.changed_fields?.length) return true;
	return metadata.changed_fields.some((f) => GENERAL_FIELDS.has(f));
}

function hasQualitiesChanges(
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): boolean {
	if (metadata?.changed_fields?.includes('qualities')) return true;
	if (metadata?.changed_fields?.some((field) => field.startsWith('quality_item:'))) return true;
	if (desiredState?.ordered_items) return true;
	return false;
}

function hasScoringChanges(
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): boolean {
	if (metadata?.changed_fields?.includes('minimum_custom_format_score')) return true;
	if (metadata?.changed_fields?.includes('upgrade_until_score')) return true;
	if (metadata?.changed_fields?.includes('upgrade_score_increment')) return true;
	if (metadata?.changed_fields?.includes('custom_format_scores')) return true;
	if (metadata?.changed_fields?.some((field) => field.startsWith('custom_format_score:')))
		return true;
	if (desiredState?.custom_format_scores) return true;
	if (desiredState?.minimum_custom_format_score) return true;
	if (desiredState?.upgrade_until_score) return true;
	if (desiredState?.upgrade_score_increment) return true;
	return false;
}

export async function overrideCreate(
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<WriteResult> {
	// Profile creates touch general at minimum
	const generalResult = await overrideGeneral(databaseId, metadata, desiredState);
	if (!generalResult.success) return generalResult;

	if (hasQualitiesChanges(metadata, desiredState)) {
		const qualitiesResult = await overrideQualities(databaseId, metadata, desiredState);
		if (!qualitiesResult.success) return qualitiesResult;
	}

	if (hasScoringChanges(metadata, desiredState)) {
		return overrideScoring(databaseId, metadata, desiredState);
	}

	return generalResult;
}

export async function overrideUpdate(
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<WriteResult> {
	if (hasQualitiesChanges(metadata, desiredState)) {
		return overrideQualities(databaseId, metadata, desiredState);
	}

	if (hasScoringChanges(metadata, desiredState)) {
		return overrideScoring(databaseId, metadata, desiredState);
	}

	if (hasGeneralChanges(metadata)) {
		return overrideGeneral(databaseId, metadata, desiredState);
	}

	return { success: true };
}
