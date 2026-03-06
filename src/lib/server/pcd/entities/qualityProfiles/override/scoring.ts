import { getCache } from '$pcd/index.ts';
import type { WriteResult } from '$pcd/index.ts';
import { scoring as readScoring } from '../scoring/read.ts';
import { updateScoring } from '../scoring/update.ts';
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

	// Resolve desired profile-level settings
	const desiredMinimum =
		getDesiredTo<number>(desiredState.minimum_custom_format_score) ??
		currentScoring.minimum_custom_format_score;
	const desiredUpgradeUntil =
		getDesiredTo<number>(desiredState.upgrade_until_score) ?? currentScoring.upgrade_until_score;
	const desiredIncrement =
		getDesiredTo<number>(desiredState.upgrade_score_increment) ??
		currentScoring.upgrade_score_increment;

	// Build the full CF scores list: start with current, apply desired changes
	const currentScoreMap = new Map<string, number | null>();
	for (const cf of currentScoring.customFormats) {
		for (const [arrType, score] of Object.entries(cf.scores)) {
			currentScoreMap.set(`${cf.name}::${arrType}`, score);
		}
	}

	// Apply desired score changes on top, resolving CF renames
	const scoreChanges = resolveScoreChanges(desiredState);
	for (const change of scoreChanges) {
		const resolvedName = followRenameChain(databaseId, 'custom_format', change.customFormatName);
		currentScoreMap.set(`${resolvedName}::${change.arrType}`, change.score);
	}

	// Check if anything actually changed
	const profileMatches =
		valuesEqual(desiredMinimum, currentScoring.minimum_custom_format_score) &&
		valuesEqual(desiredUpgradeUntil, currentScoring.upgrade_until_score) &&
		valuesEqual(desiredIncrement, currentScoring.upgrade_score_increment);

	const scoresMatch = scoreChanges.every((change) => {
		const resolvedName = followRenameChain(databaseId, 'custom_format', change.customFormatName);
		const cf = currentScoring.customFormats.find((c) => c.name === resolvedName);
		if (!cf) return change.score === null;
		const currentScore = cf.scores[change.arrType] ?? null;
		return valuesEqual(change.score, currentScore);
	});

	if (profileMatches && scoresMatch) {
		return { success: true };
	}

	// Build the full scores array for updateScoring
	const customFormatScores: Array<{
		customFormatName: string;
		arrType: string;
		score: number | null;
	}> = [];
	for (const [key, score] of currentScoreMap) {
		const [customFormatName, arrType] = key.split('::');
		customFormatScores.push({ customFormatName, arrType, score });
	}

	return updateScoring({
		databaseId,
		cache,
		layer: 'user',
		profileName,
		input: {
			minimumScore: desiredMinimum,
			upgradeUntilScore: desiredUpgradeUntil,
			upgradeScoreIncrement: desiredIncrement,
			customFormatScores
		}
	});
}
