/**
 * Update quality profile scoring settings
 */

import type { PCDCache } from '$pcd/index.ts';
import {
	writeOperation,
	recompileCache,
	type OperationLayer,
	type WriteResult
} from '$pcd/index.ts';
import { logger } from '$logger/logger.ts';
import type { CompiledQuery } from 'kysely';

// ============================================================================
// Input types
// ============================================================================

interface CustomFormatScore {
	customFormatName: string;
	arrType: string;
	score: number | null;
}

interface UpdateScoringInput {
	minimumScore: number;
	upgradeUntilScore: number;
	upgradeScoreIncrement: number;
	customFormatScores: CustomFormatScore[];
}

interface UpdateScoringOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	profileName: string;
	input: UpdateScoringInput;
}

interface ScoringOp {
	description: string;
	queries: CompiledQuery[];
	desiredState: Record<string, unknown>;
	changedFields: string[];
	summary: string;
	title: string;
	dependsOn?: Array<{ entity: string; key: string; value: string }>;
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Update quality profile scoring settings
 */
export async function updateScoring(options: UpdateScoringOptions) {
	const { databaseId, cache, layer, profileName, input } = options;
	const db = cache.kb;

	if (input.upgradeScoreIncrement < 1) {
		throw new Error('Upgrade score increment must be at least 1');
	}

	const currentProfile = await db
		.selectFrom('quality_profiles')
		.select(['minimum_custom_format_score', 'upgrade_until_score', 'upgrade_score_increment'])
		.where('name', '=', profileName)
		.executeTakeFirst();

	if (!currentProfile) {
		return { success: false, error: `Quality profile "${profileName}" not found` };
	}

	const currentScores = await db
		.selectFrom('quality_profile_custom_formats')
		.select(['custom_format_name', 'arr_type', 'score'])
		.where('quality_profile_name', '=', profileName)
		.execute();

	const currentScoreMap = new Map<string, number>();
	for (const row of currentScores) {
		currentScoreMap.set(`${row.custom_format_name}::${row.arr_type}`, row.score);
	}

	const ops: ScoringOp[] = [];

	// Expand 'all' rows into per-arr-type rows for any CFs being modified.
	// This prevents ghost fallbacks when a specific arr_type score is deleted
	// but an old 'all' row still exists in the database.
	// Only expand when at least one arr_type score actually differs from the
	// 'all' value — otherwise the user didn't change anything and expanding
	// would create spurious user ops that can later conflict.
	const modifiedCfNames = new Set(input.customFormatScores.map((s) => s.customFormatName));
	const arrTypes = ['radarr', 'sonarr'];

	for (const cfName of modifiedCfNames) {
		const allKey = `${cfName}::all`;
		const allScore = currentScoreMap.get(allKey);
		if (allScore === undefined) continue;

		// Check whether the input actually changes any score away from the
		// 'all' value.  If every per-arr-type input score matches the shared
		// score, the user didn't edit this CF and we should leave the 'all'
		// row intact.
		const cfInputs = input.customFormatScores.filter(
			(s) => s.customFormatName === cfName && s.arrType !== 'all'
		);
		if (cfInputs.length > 0 && cfInputs.every((s) => s.score === allScore)) {
			// Populate per-arr-type entries so the CF score loop below doesn't
			// see undefined and generate spurious INSERT ops for unchanged CFs.
			for (const arrType of arrTypes) {
				const key = `${cfName}::${arrType}`;
				if (!currentScoreMap.has(key)) {
					currentScoreMap.set(key, allScore);
				}
			}
			continue;
		}

		for (const arrType of arrTypes) {
			const key = `${cfName}::${arrType}`;
			if (!currentScoreMap.has(key)) {
				const insertQuery = {
					sql: `INSERT INTO quality_profile_custom_formats (quality_profile_name, custom_format_name, arr_type, score)
SELECT '${esc(profileName)}', '${esc(cfName)}', '${esc(arrType)}', ${allScore}
WHERE NOT EXISTS (
  SELECT 1 FROM quality_profile_custom_formats
  WHERE quality_profile_name = '${esc(profileName)}'
    AND custom_format_name = '${esc(cfName)}'
    AND arr_type = '${esc(arrType)}'
)`,
					parameters: [],
					query: {} as never
				};

				ops.push({
					description: `expand-all-score-${profileName}-${arrType}-${cfName}`,
					queries: [insertQuery],
					desiredState: {
						custom_format_scores: [
							{
								custom_format_name: cfName,
								arr_type: arrType,
								from: null,
								to: allScore
							}
						]
					},
					changedFields: [`custom_format_score:${cfName}:${arrType}`],
					summary: `Expand shared score to ${arrType}`,
					title: `Expand shared score for "${cfName}" to ${arrType} on "${profileName}"`,
					dependsOn: [{ entity: 'custom_format', key: 'custom_format_name', value: cfName }]
				});

				currentScoreMap.set(key, allScore);
			}
		}

		const deleteAllQuery = {
			sql: `DELETE FROM quality_profile_custom_formats
WHERE quality_profile_name = '${esc(profileName)}'
  AND custom_format_name = '${esc(cfName)}'
  AND arr_type = 'all'
  AND score = ${allScore}`,
			parameters: [],
			query: {} as never
		};

		ops.push({
			description: `remove-all-score-${profileName}-${cfName}`,
			queries: [deleteAllQuery],
			desiredState: {
				custom_format_scores: [
					{
						custom_format_name: cfName,
						arr_type: 'all',
						from: allScore,
						to: null
					}
				]
			},
			changedFields: [`custom_format_score:${cfName}:all`],
			summary: `Remove shared score after expansion`,
			title: `Remove shared score for "${cfName}" on "${profileName}"`,
			dependsOn: [{ entity: 'custom_format', key: 'custom_format_name', value: cfName }]
		});

		currentScoreMap.delete(allKey);
	}

	if (currentProfile.minimum_custom_format_score !== input.minimumScore) {
		const query = db
			.updateTable('quality_profiles')
			.set({ minimum_custom_format_score: input.minimumScore })
			.where('name', '=', profileName)
			.where('minimum_custom_format_score', '=', currentProfile.minimum_custom_format_score)
			.compile();

		ops.push({
			description: `update-quality-profile-minimum-score-${profileName}`,
			queries: [query],
			desiredState: {
				minimum_custom_format_score: {
					from: currentProfile.minimum_custom_format_score,
					to: input.minimumScore
				}
			},
			changedFields: ['minimum_custom_format_score'],
			summary: 'Update quality profile minimum score',
			title: `Update minimum score for quality profile "${profileName}"`
		});
	}

	if (currentProfile.upgrade_until_score !== input.upgradeUntilScore) {
		const query = db
			.updateTable('quality_profiles')
			.set({ upgrade_until_score: input.upgradeUntilScore })
			.where('name', '=', profileName)
			.where('upgrade_until_score', '=', currentProfile.upgrade_until_score)
			.compile();

		ops.push({
			description: `update-quality-profile-upgrade-until-score-${profileName}`,
			queries: [query],
			desiredState: {
				upgrade_until_score: {
					from: currentProfile.upgrade_until_score,
					to: input.upgradeUntilScore
				}
			},
			changedFields: ['upgrade_until_score'],
			summary: 'Update quality profile upgrade-until score',
			title: `Update upgrade-until score for quality profile "${profileName}"`
		});
	}

	if (currentProfile.upgrade_score_increment !== input.upgradeScoreIncrement) {
		const query = db
			.updateTable('quality_profiles')
			.set({ upgrade_score_increment: input.upgradeScoreIncrement })
			.where('name', '=', profileName)
			.where('upgrade_score_increment', '=', currentProfile.upgrade_score_increment)
			.compile();

		ops.push({
			description: `update-quality-profile-upgrade-score-increment-${profileName}`,
			queries: [query],
			desiredState: {
				upgrade_score_increment: {
					from: currentProfile.upgrade_score_increment,
					to: input.upgradeScoreIncrement
				}
			},
			changedFields: ['upgrade_score_increment'],
			summary: 'Update quality profile score increment',
			title: `Update score increment for quality profile "${profileName}"`
		});
	}

	for (const score of input.customFormatScores) {
		const key = `${score.customFormatName}::${score.arrType}`;
		const currentScore = currentScoreMap.get(key);
		const dependsOn = [
			{
				entity: 'custom_format',
				key: 'custom_format_name',
				value: score.customFormatName
			}
		];
		const rowField = `custom_format_score:${score.customFormatName}:${score.arrType}`;

		if (currentScore === undefined) {
			if (score.score === null) continue;

			const insertScore = {
				sql: `INSERT INTO quality_profile_custom_formats (quality_profile_name, custom_format_name, arr_type, score)
SELECT '${esc(profileName)}', '${esc(score.customFormatName)}', '${esc(score.arrType)}', ${score.score}
WHERE NOT EXISTS (
  SELECT 1 FROM quality_profile_custom_formats
  WHERE quality_profile_name = '${esc(profileName)}'
    AND custom_format_name = '${esc(score.customFormatName)}'
    AND arr_type = '${esc(score.arrType)}'
)`,
				parameters: [],
				query: {} as never
			};

			ops.push({
				description: `add-quality-profile-cf-score-${profileName}-${score.arrType}-${score.customFormatName}`,
				queries: [insertScore],
				desiredState: {
					custom_format_scores: [
						{
							custom_format_name: score.customFormatName,
							arr_type: score.arrType,
							from: null,
							to: score.score
						}
					]
				},
				changedFields: [rowField],
				summary: 'Add quality profile custom format score',
				title: `Add ${score.arrType} score for "${score.customFormatName}" on "${profileName}"`,
				dependsOn
			});
			continue;
		}

		if (score.score === null) {
			const deleteScore = {
				sql: `DELETE FROM quality_profile_custom_formats
WHERE quality_profile_name = '${esc(profileName)}'
  AND custom_format_name = '${esc(score.customFormatName)}'
  AND arr_type = '${esc(score.arrType)}'
  AND score = ${currentScore}`,
				parameters: [],
				query: {} as never
			};

			ops.push({
				description: `remove-quality-profile-cf-score-${profileName}-${score.arrType}-${score.customFormatName}`,
				queries: [deleteScore],
				desiredState: {
					custom_format_scores: [
						{
							custom_format_name: score.customFormatName,
							arr_type: score.arrType,
							from: currentScore,
							to: null
						}
					]
				},
				changedFields: [rowField],
				summary: 'Remove quality profile custom format score',
				title: `Remove ${score.arrType} score for "${score.customFormatName}" on "${profileName}"`,
				dependsOn
			});
			continue;
		}

		if (score.score !== currentScore) {
			const updateScore = {
				sql: `UPDATE quality_profile_custom_formats
SET score = ${score.score}
WHERE quality_profile_name = '${esc(profileName)}'
  AND custom_format_name = '${esc(score.customFormatName)}'
  AND arr_type = '${esc(score.arrType)}'
  AND score = ${currentScore}`,
				parameters: [],
				query: {} as never
			};

			ops.push({
				description: `update-quality-profile-cf-score-${profileName}-${score.arrType}-${score.customFormatName}`,
				queries: [updateScore],
				desiredState: {
					custom_format_scores: [
						{
							custom_format_name: score.customFormatName,
							arr_type: score.arrType,
							from: currentScore,
							to: score.score
						}
					]
				},
				changedFields: [rowField],
				summary: 'Update quality profile custom format score',
				title: `Update ${score.arrType} score for "${score.customFormatName}" on "${profileName}"`,
				dependsOn
			});
		}
	}

	if (ops.length === 0) {
		return { success: true };
	}

	await logger.info(`Save quality profile scoring "${profileName}"`, {
		source: 'QualityProfile',
		meta: {
			profileName,
			opCount: ops.length
		}
	});

	let lastResult: WriteResult | null = null;

	for (const op of ops) {
		const result = await writeOperation({
			databaseId,
			layer,
			description: op.description,
			queries: op.queries,
			desiredState: op.desiredState,
			skipRecompile: true,
			metadata: {
				operation: 'update',
				entity: 'quality_profile',
				name: profileName,
				stableKey: { key: 'quality_profile_name', value: profileName },
				changedFields: op.changedFields,
				summary: op.summary,
				title: op.title,
				...(op.dependsOn ? { dependsOn: op.dependsOn } : {})
			}
		});

		if (!result.success) {
			await recompileCache(databaseId);
			return result;
		}
		lastResult = result;
	}

	await recompileCache(databaseId);
	return lastResult ?? { success: true };
}

function esc(value: string): string {
	return value.replace(/'/g, "''");
}
