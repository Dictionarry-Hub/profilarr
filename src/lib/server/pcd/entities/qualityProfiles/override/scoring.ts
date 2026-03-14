import { getCache, writeOperation } from '$pcd/index.ts';
import type { WriteResult } from '$pcd/index.ts';
import { scoring as readScoring } from '../scoring/read.ts';
import type { StoredOpMetadata, StoredDesiredState } from '$pcd/conflicts/overrideUtils.ts';
import { getDesiredTo, valuesEqual, followRenameChain } from '$pcd/conflicts/overrideUtils.ts';
import { resolveProfileName } from './resolve.ts';

/**
 * Extract desired CF score changes from the op's desired_state.
 * Scoring ops store: custom_format_scores as an array of { custom_format_name, arr_type, from, to }
 */
function resolveScoreChanges(desiredState: StoredDesiredState): Array<{
	customFormatName: string;
	arrType: string;
	score: number | null;
}> {
	const raw = desiredState.custom_format_scores;
	if (!Array.isArray(raw)) return [];

	return raw
		.map((entry) => {
			const typed = entry as {
				custom_format_name?: string;
				arr_type?: string;
				from?: number | null;
				to?: number | null;
			};
			if (!typed.custom_format_name || !typed.arr_type) return null;
			return {
				customFormatName: typed.custom_format_name,
				arrType: typed.arr_type,
				score: typed.to ?? null
			};
		})
		.filter((e): e is NonNullable<typeof e> => e !== null);
}

export async function overrideScoring(
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<WriteResult> {
	if (!desiredState) {
		return { success: false, error: 'Missing desired state for scoring override' };
	}

	const cache = getCache(databaseId);
	if (!cache) {
		return { success: false, error: 'Cache not available' };
	}

	const profileName = await resolveProfileName(cache, databaseId, metadata, desiredState);
	if (!profileName) {
		return { success: false, error: 'Quality profile not found for scoring override' };
	}

	const currentScoring = await readScoring(cache, databaseId, profileName);
	const queries: Array<{ sql: string; parameters: unknown[]; query: never }> = [];
	const nextDesiredState: StoredDesiredState = {};
	const changedFields: string[] = [];

	const desiredMinimum = getDesiredTo<number>(desiredState.minimum_custom_format_score);
	if (
		desiredMinimum !== undefined &&
		!valuesEqual(desiredMinimum, currentScoring.minimum_custom_format_score)
	) {
		queries.push({
			sql: `UPDATE quality_profiles
SET minimum_custom_format_score = ${desiredMinimum}
WHERE name = '${esc(profileName)}'
  AND minimum_custom_format_score = ${currentScoring.minimum_custom_format_score}`,
			parameters: [],
			query: {} as never
		});
		nextDesiredState.minimum_custom_format_score = {
			from: currentScoring.minimum_custom_format_score,
			to: desiredMinimum
		};
		changedFields.push('minimum_custom_format_score');
	}

	const desiredUpgradeUntil = getDesiredTo<number>(desiredState.upgrade_until_score);
	if (
		desiredUpgradeUntil !== undefined &&
		!valuesEqual(desiredUpgradeUntil, currentScoring.upgrade_until_score)
	) {
		queries.push({
			sql: `UPDATE quality_profiles
SET upgrade_until_score = ${desiredUpgradeUntil}
WHERE name = '${esc(profileName)}'
  AND upgrade_until_score = ${currentScoring.upgrade_until_score}`,
			parameters: [],
			query: {} as never
		});
		nextDesiredState.upgrade_until_score = {
			from: currentScoring.upgrade_until_score,
			to: desiredUpgradeUntil
		};
		changedFields.push('upgrade_until_score');
	}

	const desiredIncrement = getDesiredTo<number>(desiredState.upgrade_score_increment);
	if (
		desiredIncrement !== undefined &&
		!valuesEqual(desiredIncrement, currentScoring.upgrade_score_increment)
	) {
		queries.push({
			sql: `UPDATE quality_profiles
SET upgrade_score_increment = ${desiredIncrement}
WHERE name = '${esc(profileName)}'
  AND upgrade_score_increment = ${currentScoring.upgrade_score_increment}`,
			parameters: [],
			query: {} as never
		});
		nextDesiredState.upgrade_score_increment = {
			from: currentScoring.upgrade_score_increment,
			to: desiredIncrement
		};
		changedFields.push('upgrade_score_increment');
	}

	const scoreChanges = resolveScoreChanges(desiredState);
	const desiredScoreStates: Array<{
		custom_format_name: string;
		arr_type: string;
		from: number | null;
		to: number | null;
	}> = [];

	for (const change of scoreChanges) {
		const resolvedName = followRenameChain(databaseId, 'custom_format', change.customFormatName);
		const currentRow = await cache.kb
			.selectFrom('quality_profile_custom_formats')
			.select(['score'])
			.where('quality_profile_name', '=', profileName)
			.where('custom_format_name', '=', resolvedName)
			.where('arr_type', '=', change.arrType)
			.executeTakeFirst();
		const currentScore = currentRow?.score ?? null;

		if (valuesEqual(change.score, currentScore)) {
			continue;
		}

		if (currentRow && change.score === null) {
			queries.push({
				sql: `DELETE FROM quality_profile_custom_formats
WHERE quality_profile_name = '${esc(profileName)}'
  AND custom_format_name = '${esc(resolvedName)}'
  AND arr_type = '${esc(change.arrType)}'
  AND score = ${currentRow.score}`,
				parameters: [],
				query: {} as never
			});
		} else if (currentRow) {
			queries.push({
				sql: `UPDATE quality_profile_custom_formats
SET score = ${change.score}
WHERE quality_profile_name = '${esc(profileName)}'
  AND custom_format_name = '${esc(resolvedName)}'
  AND arr_type = '${esc(change.arrType)}'
  AND score = ${currentRow.score}`,
				parameters: [],
				query: {} as never
			});
		} else if (change.score !== null) {
			queries.push({
				sql: `INSERT INTO quality_profile_custom_formats (quality_profile_name, custom_format_name, arr_type, score)
SELECT '${esc(profileName)}', '${esc(resolvedName)}', '${esc(change.arrType)}', ${change.score}
WHERE NOT EXISTS (
  SELECT 1 FROM quality_profile_custom_formats
  WHERE quality_profile_name = '${esc(profileName)}'
    AND custom_format_name = '${esc(resolvedName)}'
    AND arr_type = '${esc(change.arrType)}'
)`,
				parameters: [],
				query: {} as never
			});
		}

		desiredScoreStates.push({
			custom_format_name: resolvedName,
			arr_type: change.arrType,
			from: currentScore,
			to: change.score
		});
		changedFields.push(`custom_format_score:${resolvedName}:${change.arrType}`);
	}

	if (desiredScoreStates.length > 0) {
		nextDesiredState.custom_format_scores = desiredScoreStates;
	}

	if (queries.length === 0) {
		return { success: true };
	}

	return writeOperation({
		databaseId,
		layer: 'user',
		description: metadata?.summary ?? `override-quality-profile-scoring-${profileName}`,
		queries,
		desiredState: nextDesiredState,
		metadata: {
			operation: 'update',
			entity: 'quality_profile',
			name: profileName,
			stableKey: { key: 'quality_profile_name', value: profileName },
			changedFields,
			summary: metadata?.summary ?? 'Override quality profile scoring conflict',
			title: metadata?.title ?? `Override scoring for quality profile "${profileName}"`
		}
	});
}

function esc(value: string): string {
	return value.replace(/'/g, "''");
}
