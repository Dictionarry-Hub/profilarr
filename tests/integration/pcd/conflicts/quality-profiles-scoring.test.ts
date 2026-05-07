/**
 * PCD conflict tests: quality profile scoring.
 */

import { assertEquals, assertExists } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { openDb } from '$test-harness/db.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { base } from '../harness/fixtures.ts';
import {
	compilePcd,
	insertOp,
	opCheckpoint,
	parseMetadata,
	queryOpsSince,
	seedBase,
	setupPcd,
	type ConflictStrategy,
	type OpRow,
	type PcdTestContext,
	type SeedOperation
} from '../harness/pcd.ts';
import { write } from '../harness/write.ts';

const PORT = PORTS.pcd.conflictsQualityProfilesScoring;
const ORIGIN = `http://localhost:${PORT}`;
const STRATEGIES: ConflictStrategy[] = ['ask', 'align', 'override'];
const PROFILE_NAME = 'Scoring Profile';
const CUSTOM_FORMAT_NAME = 'Scoring CF';
const CUSTOM_FORMAT_NAME_2 = 'Scoring CF Upstream';

type LatestHistory = {
	status: string;
	conflict_reason: string | null;
};

type QualityProfileScoringRow = {
	name: string;
	description: string | null;
	minimum_custom_format_score: number;
	upgrade_until_score: number;
	upgrade_score_increment: number;
};

type QualityProfileCustomFormatScoreRow = {
	quality_profile_name: string;
	custom_format_name: string;
	arr_type: string;
	score: number;
};

let counter = 0;

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

/**
 * Migrates old 2.11.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='Scoring Profile', minimum_custom_format_score=0
 *
 * User
 *   POST scoring update changes:
 *     minimum_custom_format_score = 9
 *
 * Upstream
 *   Published base op changes:
 *     minimum_custom_format_score 0 -> 9
 *
 * Expect
 *   - user minimum score op auto-aligns/drops for every strategy
 *   - no pending conflicts remain
 *   - final minimum score is the shared value
 */
test('matching upstream minimum score auto-aligns user op', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'minimum-score-auto-align', [
			base.qualityProfile({
				name: PROFILE_NAME
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateScoring(ctx, 1, {
			minimumScore: 9
		});

		seedUpstream(
			ctx,
			upstreamProfileScoringUpdate(PROFILE_NAME, {
				minimum_custom_format_score: { from: 0, to: 9 }
			})
		);
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			'minimum_custom_format_score'
		]);
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped', 'aligned');
		assertNoPendingConflicts(ctx);

		const row = assertQualityProfileScoring(ctx, PROFILE_NAME);
		assertEquals(row.minimum_custom_format_score, 9);
	}
});

/**
 * Migrates old 2.4.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='Scoring Profile', description='Original', minimum_custom_format_score=0
 *
 * User
 *   POST scoring update changes:
 *     minimum_custom_format_score = 7
 *
 * Upstream
 *   Published base op changes:
 *     description 'Original' -> 'Upstream description'
 *
 * Expect
 *   - user minimum score op applies cleanly for every strategy
 *   - no pending conflicts remain
 *   - final quality profile has the local minimum score and upstream description
 */
test('minimum score applies after upstream description change', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'minimum-score-upstream-description', [
			base.qualityProfile({
				name: PROFILE_NAME,
				description: 'Original'
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateScoring(ctx, 1, {
			minimumScore: 7
		});

		seedUpstream(
			ctx,
			upstreamProfileScoringUpdate(PROFILE_NAME, {
				description: { from: 'Original', to: 'Upstream description' }
			})
		);
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			'minimum_custom_format_score'
		]);
		assertEquals(op.state, 'published');
		assertLatestHistory(ctx, op, 'applied');
		assertNoPendingConflicts(ctx);

		const row = assertQualityProfileScoring(ctx, PROFILE_NAME);
		assertEquals(row.description, 'Upstream description');
		assertEquals(row.minimum_custom_format_score, 7);
	}
});

/**
 * Migrates old 2.12.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='Scoring Profile', upgrade_until_score=0
 *
 * User
 *   POST scoring update changes:
 *     upgrade_until_score = 13
 *
 * Upstream
 *   Published base op changes:
 *     upgrade_until_score 0 -> 13
 *
 * Expect
 *   - user upgrade-until score op auto-aligns/drops for every strategy
 *   - no pending conflicts remain
 *   - final upgrade-until score is the shared value
 */
test('matching upstream upgrade-until score auto-aligns user op', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'upgrade-until-score-auto-align', [
			base.qualityProfile({
				name: PROFILE_NAME
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateScoring(ctx, 1, {
			upgradeUntilScore: 13
		});

		seedUpstream(
			ctx,
			upstreamProfileScoringUpdate(PROFILE_NAME, {
				upgrade_until_score: { from: 0, to: 13 }
			})
		);
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['upgrade_until_score']);
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped', 'aligned');
		assertNoPendingConflicts(ctx);

		const row = assertQualityProfileScoring(ctx, PROFILE_NAME);
		assertEquals(row.upgrade_until_score, 13);
	}
});

/**
 * Migrates old 2.13.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='Scoring Profile', upgrade_score_increment=1
 *
 * User
 *   POST scoring update changes:
 *     upgrade_score_increment = 2
 *
 * Upstream
 *   Published base op changes:
 *     upgrade_score_increment 1 -> 2
 *
 * Expect
 *   - user upgrade score increment op auto-aligns/drops for every strategy
 *   - no pending conflicts remain
 *   - final upgrade score increment is the shared value
 */
test('matching upstream upgrade score increment auto-aligns user op', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'upgrade-score-increment-auto-align', [
			base.qualityProfile({
				name: PROFILE_NAME
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateScoring(ctx, 1, {
			upgradeScoreIncrement: 2
		});

		seedUpstream(
			ctx,
			upstreamProfileScoringUpdate(PROFILE_NAME, {
				upgrade_score_increment: { from: 1, to: 2 }
			})
		);
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['upgrade_score_increment']);
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped', 'aligned');
		assertNoPendingConflicts(ctx);

		const row = assertQualityProfileScoring(ctx, PROFILE_NAME);
		assertEquals(row.upgrade_score_increment, 2);
	}
});

/**
 * Migrates old 2.14.
 *
 * Context
 *   Base layer seeded with one custom format and one quality profile score:
 *     custom_format_score:Scoring CF:radarr = 10
 *
 * User
 *   POST scoring update changes:
 *     custom_format_score:Scoring CF:radarr = 21
 *
 * Upstream
 *   Published base op changes:
 *     custom_format_score:Scoring CF:radarr 10 -> 21
 *
 * Expect
 *   - user custom format score op auto-aligns/drops for every strategy
 *   - no pending conflicts remain
 *   - final score is the shared value
 */
test('matching upstream custom format score auto-aligns user op', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'custom-format-score-auto-align', [
			base.customFormat({ name: CUSTOM_FORMAT_NAME }),
			base.qualityProfile({
				name: PROFILE_NAME,
				customFormatScores: [
					{ customFormatName: CUSTOM_FORMAT_NAME, arrType: 'radarr', score: 10 }
				]
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateScoring(ctx, 1, {
			customFormatScores: [
				{ customFormatName: CUSTOM_FORMAT_NAME, arrType: 'radarr', score: 21 }
			]
		});

		seedUpstream(ctx, upstreamUpdateCustomFormatScore(PROFILE_NAME, CUSTOM_FORMAT_NAME, 'radarr', 10, 21));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			`custom_format_score:${CUSTOM_FORMAT_NAME}:radarr`
		]);
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped', 'aligned');
		assertNoPendingConflicts(ctx);
		assertEquals(compiledCustomFormatScore(ctx, PROFILE_NAME, CUSTOM_FORMAT_NAME, 'radarr'), 21);
	}
});

/**
 * Migrates old 2.15.
 *
 * Context
 *   Base layer seeded with one custom format and one quality profile:
 *     no score row exists for custom_format_score:Scoring CF:radarr
 *
 * User
 *   POST scoring update changes:
 *     custom_format_score:Scoring CF:radarr null -> 17
 *
 * Upstream
 *   Published base op changes:
 *     custom_format_score:Scoring CF:radarr null -> 17
 *
 * Expect
 *   - user add score op auto-aligns/drops for every strategy
 *   - no pending conflicts remain
 *   - final score is the shared value
 */
test('matching upstream add custom format score auto-aligns user op', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'add-custom-format-score-auto-align', [
			base.customFormat({ name: CUSTOM_FORMAT_NAME }),
			base.qualityProfile({
				name: PROFILE_NAME
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateScoring(ctx, 1, {
			customFormatScores: [
				{ customFormatName: CUSTOM_FORMAT_NAME, arrType: 'radarr', score: 17 }
			]
		});

		seedUpstream(ctx, upstreamAddCustomFormatScore(PROFILE_NAME, CUSTOM_FORMAT_NAME, 'radarr', 17));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			`custom_format_score:${CUSTOM_FORMAT_NAME}:radarr`
		]);
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped', 'aligned');
		assertNoPendingConflicts(ctx);
		assertEquals(compiledCustomFormatScore(ctx, PROFILE_NAME, CUSTOM_FORMAT_NAME, 'radarr'), 17);
	}
});

/**
 * Migrates old 2.16.
 *
 * Context
 *   Base layer seeded with one custom format and one quality profile score:
 *     custom_format_score:Scoring CF:radarr = 10
 *
 * User
 *   POST scoring update changes:
 *     custom_format_score:Scoring CF:radarr 10 -> null
 *
 * Upstream
 *   Published base op changes:
 *     custom_format_score:Scoring CF:radarr 10 -> null
 *
 * Expect
 *   - user remove score op auto-aligns/drops for every strategy
 *   - no pending conflicts remain
 *   - final score row is absent
 */
test('matching upstream remove custom format score auto-aligns user op', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'remove-custom-format-score-auto-align', [
			base.customFormat({ name: CUSTOM_FORMAT_NAME }),
			base.qualityProfile({
				name: PROFILE_NAME,
				customFormatScores: [
					{ customFormatName: CUSTOM_FORMAT_NAME, arrType: 'radarr', score: 10 }
				]
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateScoring(ctx, 1, {
			customFormatScores: [
				{ customFormatName: CUSTOM_FORMAT_NAME, arrType: 'radarr', score: null }
			]
		});

		seedUpstream(ctx, upstreamRemoveCustomFormatScore(PROFILE_NAME, CUSTOM_FORMAT_NAME, 'radarr', 10));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			`custom_format_score:${CUSTOM_FORMAT_NAME}:radarr`
		]);
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped', 'aligned');
		assertNoPendingConflicts(ctx);
		assertEquals(compiledCustomFormatScore(ctx, PROFILE_NAME, CUSTOM_FORMAT_NAME, 'radarr'), null);
	}
});

/**
 * Migrates old 2.19.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='Scoring Profile', minimum_custom_format_score=0
 *
 * User
 *   POST scoring update changes:
 *     minimum_custom_format_score = 7
 *
 * Upstream
 *   Published base rename changes:
 *     name 'Scoring Profile' -> 'Scoring Profile Upstream'
 *
 * Expect
 *   - minimum score op conflicts by strategy
 *   - final name is the upstream name
 *   - final minimum score is local only for override, otherwise upstream
 */
test('minimum score update after upstream rename resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'minimum-score-upstream-rename', [
			base.qualityProfile({
				name: PROFILE_NAME
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateScoring(ctx, 1, {
			minimumScore: 7
		});

		seedUpstream(ctx, upstreamRename(PROFILE_NAME, 'Scoring Profile Upstream'));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			'minimum_custom_format_score'
		]);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		const row = assertQualityProfileScoring(ctx, 'Scoring Profile Upstream');
		assertEquals(row.minimum_custom_format_score, strategy === 'override' ? 7 : 0);
		assertNoQualityProfileScoring(ctx, PROFILE_NAME);
	}
});

/**
 * Migrates old 2.22.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='Scoring Profile', minimum_custom_format_score=0
 *
 * User
 *   POST general update changes:
 *     name = 'Scoring Profile Local'
 *   POST scoring update changes:
 *     minimum_custom_format_score = 7
 *
 * Upstream
 *   Published base op changes:
 *     minimum_custom_format_score 0 -> 13
 *
 * Expect
 *   - rename op applies cleanly for every strategy
 *   - minimum score op conflicts by strategy
 *   - final name keeps the local rename
 *   - final minimum score is local only for override, otherwise upstream
 */
test('rename survives when minimum score conflicts', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'rename-minimum-score-upstream-minimum-score', [
			base.qualityProfile({
				name: PROFILE_NAME
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateGeneral(ctx, 1, {
			name: 'Scoring Profile Local'
		});
		await write.qualityProfile.updateScoring(ctx, 1, {
			minimumScore: 7
		});

		seedUpstream(
			ctx,
			upstreamProfileScoringUpdate(PROFILE_NAME, {
				minimum_custom_format_score: { from: 0, to: 13 }
			})
		);
		await compilePcd(ctx);

		const ops = opsSince(ctx, checkpoint);
		const renameOp = firstOpForChangedFields(ops, ['name']);
		assertEquals(renameOp.state, 'published');
		assertLatestHistory(ctx, renameOp, 'applied');

		const minimumScoreOp = firstOpForChangedFields(ops, ['minimum_custom_format_score']);
		assertStrategyOutcome(ctx, minimumScoreOp, strategy, 'guard_mismatch');

		const row = assertQualityProfileScoring(ctx, 'Scoring Profile Local');
		assertEquals(row.minimum_custom_format_score, strategy === 'override' ? 7 : 13);
		assertNoQualityProfileScoring(ctx, PROFILE_NAME);
	}
});

/**
 * Migrates old 2.32.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='Scoring Profile', minimum_custom_format_score=0
 *
 * User
 *   POST scoring update changes:
 *     minimum_custom_format_score = 10
 *
 * Upstream
 *   Published base op changes:
 *     minimum_custom_format_score 0 -> 20
 *
 * Expect
 *   - minimum score op conflicts by strategy
 *   - final minimum score is local only for override, otherwise upstream
 */
test('minimum score conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'minimum-score-conflict', [
			base.qualityProfile({
				name: PROFILE_NAME
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateScoring(ctx, 1, {
			minimumScore: 10
		});

		seedUpstream(
			ctx,
			upstreamProfileScoringUpdate(PROFILE_NAME, {
				minimum_custom_format_score: { from: 0, to: 20 }
			})
		);
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			'minimum_custom_format_score'
		]);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		const row = assertQualityProfileScoring(ctx, PROFILE_NAME);
		assertEquals(row.minimum_custom_format_score, strategy === 'override' ? 10 : 20);
	}
});

/**
 * Migrates old 2.33.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='Scoring Profile', upgrade_until_score=0
 *
 * User
 *   POST scoring update changes:
 *     upgrade_until_score = 10
 *
 * Upstream
 *   Published base op changes:
 *     upgrade_until_score 0 -> 20
 *
 * Expect
 *   - upgrade-until score op conflicts by strategy
 *   - final upgrade-until score is local only for override, otherwise upstream
 */
test('upgrade-until score conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'upgrade-until-score-conflict', [
			base.qualityProfile({
				name: PROFILE_NAME
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateScoring(ctx, 1, {
			upgradeUntilScore: 10
		});

		seedUpstream(
			ctx,
			upstreamProfileScoringUpdate(PROFILE_NAME, {
				upgrade_until_score: { from: 0, to: 20 }
			})
		);
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['upgrade_until_score']);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		const row = assertQualityProfileScoring(ctx, PROFILE_NAME);
		assertEquals(row.upgrade_until_score, strategy === 'override' ? 10 : 20);
	}
});

/**
 * Migrates old 2.34.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='Scoring Profile', upgrade_score_increment=1
 *
 * User
 *   POST scoring update changes:
 *     upgrade_score_increment = 6
 *
 * Upstream
 *   Published base op changes:
 *     upgrade_score_increment 1 -> 16
 *
 * Expect
 *   - upgrade score increment op conflicts by strategy
 *   - final upgrade score increment is local only for override, otherwise upstream
 */
test('upgrade score increment conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'upgrade-score-increment-conflict', [
			base.qualityProfile({
				name: PROFILE_NAME
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateScoring(ctx, 1, {
			upgradeScoreIncrement: 6
		});

		seedUpstream(
			ctx,
			upstreamProfileScoringUpdate(PROFILE_NAME, {
				upgrade_score_increment: { from: 1, to: 16 }
			})
		);
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['upgrade_score_increment']);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		const row = assertQualityProfileScoring(ctx, PROFILE_NAME);
		assertEquals(row.upgrade_score_increment, strategy === 'override' ? 6 : 16);
	}
});

/**
 * Migrates old 2.35.
 *
 * Context
 *   Base layer seeded with one custom format and one quality profile score:
 *     custom_format_score:Scoring CF:radarr = 10
 *
 * User
 *   POST scoring update changes:
 *     custom_format_score:Scoring CF:radarr = 20
 *
 * Upstream
 *   Published base op changes:
 *     custom_format_score:Scoring CF:radarr 10 -> 30
 *
 * Expect
 *   - custom format score op conflicts by strategy
 *   - final score is local only for override, otherwise upstream
 */
test('custom format score conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'custom-format-score-conflict', [
			base.customFormat({ name: CUSTOM_FORMAT_NAME }),
			base.qualityProfile({
				name: PROFILE_NAME,
				customFormatScores: [
					{ customFormatName: CUSTOM_FORMAT_NAME, arrType: 'radarr', score: 10 }
				]
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateScoring(ctx, 1, {
			customFormatScores: [
				{ customFormatName: CUSTOM_FORMAT_NAME, arrType: 'radarr', score: 20 }
			]
		});

		seedUpstream(ctx, upstreamUpdateCustomFormatScore(PROFILE_NAME, CUSTOM_FORMAT_NAME, 'radarr', 10, 30));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			`custom_format_score:${CUSTOM_FORMAT_NAME}:radarr`
		]);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		assertEquals(
			compiledCustomFormatScore(ctx, PROFILE_NAME, CUSTOM_FORMAT_NAME, 'radarr'),
			strategy === 'override' ? 20 : 30
		);
	}
});

/**
 * Migrates old 2.36.
 *
 * Context
 *   Base layer seeded with two custom formats and two quality profile scores:
 *     custom_format_score:Scoring CF:radarr = 10
 *     custom_format_score:Scoring CF Upstream:sonarr = 20
 *
 * User
 *   POST scoring update changes:
 *     custom_format_score:Scoring CF:radarr = 11
 *
 * Upstream
 *   Published base op changes:
 *     custom_format_score:Scoring CF Upstream:sonarr 20 -> 22
 *
 * Expect
 *   - user custom format score op applies cleanly for every strategy
 *   - no pending conflicts remain
 *   - final scores include both changes
 */
test('different custom format score rows apply without conflict', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'custom-format-score-different-row', [
			base.customFormat({ name: CUSTOM_FORMAT_NAME }),
			base.customFormat({ name: CUSTOM_FORMAT_NAME_2 }),
			base.qualityProfile({
				name: PROFILE_NAME,
				customFormatScores: [
					{ customFormatName: CUSTOM_FORMAT_NAME, arrType: 'radarr', score: 10 },
					{ customFormatName: CUSTOM_FORMAT_NAME_2, arrType: 'sonarr', score: 20 }
				]
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateScoring(ctx, 1, {
			customFormatScores: [
				{ customFormatName: CUSTOM_FORMAT_NAME, arrType: 'radarr', score: 11 }
			]
		});

		seedUpstream(
			ctx,
			upstreamUpdateCustomFormatScore(PROFILE_NAME, CUSTOM_FORMAT_NAME_2, 'sonarr', 20, 22)
		);
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			`custom_format_score:${CUSTOM_FORMAT_NAME}:radarr`
		]);
		assertEquals(op.state, 'published');
		assertLatestHistory(ctx, op, 'applied');
		assertNoPendingConflicts(ctx);
		assertEquals(compiledCustomFormatScore(ctx, PROFILE_NAME, CUSTOM_FORMAT_NAME, 'radarr'), 11);
		assertEquals(compiledCustomFormatScore(ctx, PROFILE_NAME, CUSTOM_FORMAT_NAME_2, 'sonarr'), 22);
	}
});

/**
 * Migrates old 2.37.
 *
 * Context
 *   Base layer seeded with one custom format and one quality profile:
 *     no score row exists for custom_format_score:Scoring CF:radarr
 *
 * User
 *   POST scoring update changes:
 *     custom_format_score:Scoring CF:radarr null -> 50
 *
 * Upstream
 *   Published base op changes:
 *     custom_format_score:Scoring CF:radarr null -> 100
 *
 * Expect
 *   - add score op conflicts by strategy
 *   - final score is local only for override, otherwise upstream
 */
test('add custom format score conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'add-custom-format-score-conflict', [
			base.customFormat({ name: CUSTOM_FORMAT_NAME }),
			base.qualityProfile({
				name: PROFILE_NAME
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateScoring(ctx, 1, {
			customFormatScores: [
				{ customFormatName: CUSTOM_FORMAT_NAME, arrType: 'radarr', score: 50 }
			]
		});

		seedUpstream(ctx, upstreamAddCustomFormatScore(PROFILE_NAME, CUSTOM_FORMAT_NAME, 'radarr', 100));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			`custom_format_score:${CUSTOM_FORMAT_NAME}:radarr`
		]);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		assertEquals(
			compiledCustomFormatScore(ctx, PROFILE_NAME, CUSTOM_FORMAT_NAME, 'radarr'),
			strategy === 'override' ? 50 : 100
		);
	}
});

/**
 * Migrates old 2.38.
 *
 * Context
 *   Base layer seeded with one custom format and one quality profile score:
 *     custom_format_score:Scoring CF:radarr = 10
 *
 * User
 *   POST scoring update changes:
 *     custom_format_score:Scoring CF:radarr 10 -> null
 *
 * Upstream
 *   Published base op changes:
 *     custom_format_score:Scoring CF:radarr 10 -> 30
 *
 * Expect
 *   - remove score op conflicts by strategy
 *   - final score is absent only for override, otherwise upstream
 */
test('remove custom format score conflicts with upstream update', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'remove-custom-format-score-upstream-update', [
			base.customFormat({ name: CUSTOM_FORMAT_NAME }),
			base.qualityProfile({
				name: PROFILE_NAME,
				customFormatScores: [
					{ customFormatName: CUSTOM_FORMAT_NAME, arrType: 'radarr', score: 10 }
				]
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateScoring(ctx, 1, {
			customFormatScores: [
				{ customFormatName: CUSTOM_FORMAT_NAME, arrType: 'radarr', score: null }
			]
		});

		seedUpstream(ctx, upstreamUpdateCustomFormatScore(PROFILE_NAME, CUSTOM_FORMAT_NAME, 'radarr', 10, 30));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			`custom_format_score:${CUSTOM_FORMAT_NAME}:radarr`
		]);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		assertEquals(
			compiledCustomFormatScore(ctx, PROFILE_NAME, CUSTOM_FORMAT_NAME, 'radarr'),
			strategy === 'override' ? null : 30
		);
	}
});

/**
 * Migrates old 2.39.
 *
 * Context
 *   Base layer seeded with one custom format and one quality profile score:
 *     minimum_custom_format_score = 0
 *     custom_format_score:Scoring CF:radarr = 10
 *
 * User
 *   POST scoring update changes:
 *     minimum_custom_format_score = 10
 *     custom_format_score:Scoring CF:radarr = 20
 *
 * Upstream
 *   Published base op changes:
 *     minimum_custom_format_score 0 -> 30
 *
 * Expect
 *   - custom format score op applies cleanly for every strategy
 *   - minimum score op conflicts by strategy
 *   - final custom format score keeps the local value
 *   - final minimum score is local only for override, otherwise upstream
 */
test('custom format score survives when same-save minimum score conflicts', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'minimum-score-custom-format-score', [
			base.customFormat({ name: CUSTOM_FORMAT_NAME }),
			base.qualityProfile({
				name: PROFILE_NAME,
				customFormatScores: [
					{ customFormatName: CUSTOM_FORMAT_NAME, arrType: 'radarr', score: 10 }
				]
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateScoring(ctx, 1, {
			minimumScore: 10,
			customFormatScores: [
				{ customFormatName: CUSTOM_FORMAT_NAME, arrType: 'radarr', score: 20 }
			]
		});

		seedUpstream(
			ctx,
			upstreamProfileScoringUpdate(PROFILE_NAME, {
				minimum_custom_format_score: { from: 0, to: 30 }
			})
		);
		await compilePcd(ctx);

		const ops = opsSince(ctx, checkpoint);
		const minimumScoreOp = firstOpForChangedFields(ops, ['minimum_custom_format_score']);
		assertStrategyOutcome(ctx, minimumScoreOp, strategy, 'guard_mismatch');

		const scoreOp = firstOpForChangedFields(ops, [
			`custom_format_score:${CUSTOM_FORMAT_NAME}:radarr`
		]);
		assertEquals(scoreOp.state, 'published');
		assertLatestHistory(ctx, scoreOp, 'applied');

		const row = assertQualityProfileScoring(ctx, PROFILE_NAME);
		assertEquals(row.minimum_custom_format_score, strategy === 'override' ? 10 : 30);
		assertEquals(compiledCustomFormatScore(ctx, PROFILE_NAME, CUSTOM_FORMAT_NAME, 'radarr'), 20);
	}
});

/**
 * Migrates old 2.44.
 *
 * Context
 *   Base layer seeded with one custom format and one quality profile score:
 *     custom_format_name='Scoring CF'
 *     custom_format_score:Scoring CF:radarr = 10
 *
 * User
 *   POST scoring update changes:
 *     custom_format_score:Scoring CF:radarr = 20
 *
 * Upstream
 *   Published base op renames the custom format:
 *     'Scoring CF' -> 'Scoring CF Renamed'
 *
 * Expect
 *   - custom format score op conflicts by strategy
 *   - final score is carried to the renamed custom format only for override
 */
test('custom format score dependency rename resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'custom-format-score-cf-renamed', [
			base.customFormat({ name: CUSTOM_FORMAT_NAME }),
			base.qualityProfile({
				name: PROFILE_NAME,
				customFormatScores: [
					{ customFormatName: CUSTOM_FORMAT_NAME, arrType: 'radarr', score: 10 }
				]
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateScoring(ctx, 1, {
			customFormatScores: [
				{ customFormatName: CUSTOM_FORMAT_NAME, arrType: 'radarr', score: 20 }
			]
		});

		seedUpstream(ctx, upstreamCustomFormatRename(CUSTOM_FORMAT_NAME, 'Scoring CF Renamed'));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			`custom_format_score:${CUSTOM_FORMAT_NAME}:radarr`
		]);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		assertEquals(compiledCustomFormatScore(ctx, PROFILE_NAME, CUSTOM_FORMAT_NAME, 'radarr'), null);
		assertEquals(
			compiledCustomFormatScore(ctx, PROFILE_NAME, 'Scoring CF Renamed', 'radarr'),
			strategy === 'override' ? 20 : 10
		);
	}
});

/**
 * Migrates old 2.45.
 *
 * Context
 *   Base layer seeded with one custom format and one quality profile score:
 *     custom_format_name='Scoring CF'
 *     custom_format_score:Scoring CF:radarr = 10
 *
 * User
 *   POST scoring update changes:
 *     custom_format_score:Scoring CF:radarr = 20
 *
 * Upstream
 *   Published base op deletes the custom format:
 *     'Scoring CF'
 *
 * Expect
 *   - custom format score op conflicts by strategy
 *   - final score row is absent because the custom format dependency is gone
 */
test('custom format score dependency delete resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'custom-format-score-cf-deleted', [
			base.customFormat({ name: CUSTOM_FORMAT_NAME }),
			base.qualityProfile({
				name: PROFILE_NAME,
				customFormatScores: [
					{ customFormatName: CUSTOM_FORMAT_NAME, arrType: 'radarr', score: 10 }
				]
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateScoring(ctx, 1, {
			customFormatScores: [
				{ customFormatName: CUSTOM_FORMAT_NAME, arrType: 'radarr', score: 20 }
			]
		});

		seedUpstream(ctx, upstreamCustomFormatDelete(CUSTOM_FORMAT_NAME));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			`custom_format_score:${CUSTOM_FORMAT_NAME}:radarr`
		]);
		assertDependencyDeletedOutcome(ctx, op, strategy);
		assertEquals(compiledCustomFormatScore(ctx, PROFILE_NAME, CUSTOM_FORMAT_NAME, 'radarr'), null);
	}
});

async function newScenario(strategy: ConflictStrategy, name: string): Promise<PcdTestContext> {
	counter++;
	return setupPcd({
		port: PORT,
		name: `pcd-conflict-quality-profile-scoring-${counter}-${strategy}-${name}`,
		conflictStrategy: strategy
	});
}

async function seededScenario(
	strategy: ConflictStrategy,
	name: string,
	operations: Array<string | SeedOperation>
): Promise<PcdTestContext> {
	const ctx = await newScenario(strategy, name);
	seedBase(ctx, operations);
	await compilePcd(ctx);
	return ctx;
}

function seedUpstream(ctx: PcdTestContext, operation: SeedOperation): number {
	return insertOp(ctx, {
		...operation,
		origin: 'base',
		state: 'published',
		source: 'repo'
	});
}

function opsSince(ctx: PcdTestContext, checkpoint: number): OpRow[] {
	return queryOpsSince(ctx, checkpoint, { origin: 'user' });
}

function firstOpForChangedFields(ops: OpRow[], fields: string[]): OpRow {
	const expected = [...fields].sort();
	const op = ops.find((candidate) => {
		const actual = changedFields(candidate).sort();
		return (
			actual.length === expected.length && actual.every((field, index) => field === expected[index])
		);
	});
	assertExists(op, `Expected a user op for ${fields.join(', ')}`);
	return op;
}

function firstOpForOperation(ops: OpRow[], operation: string): OpRow {
	const op = ops.find((candidate) => parseMetadata(candidate).operation === operation);
	assertExists(op, `Expected a user op for operation ${operation}`);
	return op;
}

function changedFields(op: OpRow): string[] {
	const fields = parseMetadata(op).changed_fields;
	if (!Array.isArray(fields)) return [];
	return fields.filter((field): field is string => typeof field === 'string');
}

function assertStrategyOutcome(
	ctx: PcdTestContext,
	op: OpRow,
	strategy: ConflictStrategy,
	reason: string
): void {
	if (strategy === 'ask') {
		assertEquals(op.state, 'published');
		assertLatestHistory(ctx, op, 'conflicted_pending', reason);
		return;
	}

	if (strategy === 'align') {
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped', 'aligned');
		return;
	}

	assertEquals(op.state, 'superseded');
	assertExists(op.superseded_by_op_id, 'Expected override to link a replacement op');
	assertLatestHistory(ctx, op, 'superseded');
}

function assertDependencyDeletedOutcome(
	ctx: PcdTestContext,
	op: OpRow,
	strategy: ConflictStrategy
): void {
	if (strategy === 'override') {
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped');
		assertNoPendingConflicts(ctx);
		return;
	}

	assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');
}

function assertLatestHistory(
	ctx: PcdTestContext,
	op: OpRow,
	status: string,
	reason?: string
): void {
	const history = latestHistory(ctx, op.id);
	assertEquals(history.status, status);
	if (reason !== undefined) {
		assertEquals(history.conflict_reason, reason);
	}
}

function latestHistory(ctx: PcdTestContext, opId: number): LatestHistory {
	const db = openDb(ctx.dbPath);
	try {
		const row = db
			.prepare(
				`SELECT status, conflict_reason
				 FROM pcd_op_history
				 WHERE database_id = ?
				   AND op_id = ?
				 ORDER BY applied_at DESC, id DESC
				 LIMIT 1`
			)
			.get(ctx.dbId, opId) as LatestHistory | undefined;
		assertExists(row, `Expected latest history for op ${opId}`);
		return row;
	} finally {
		db.close();
	}
}

function assertNoPendingConflicts(ctx: PcdTestContext): void {
	const db = openDb(ctx.dbPath);
	try {
		const row = db
			.prepare(
				`SELECT COUNT(*) AS count
				 FROM pcd_op_history h
				 INNER JOIN (
				     SELECT op_id, MAX(id) AS max_id
				     FROM pcd_op_history
				     WHERE database_id = ?
				     GROUP BY op_id
				 ) latest ON h.id = latest.max_id
				 WHERE h.status IN ('conflicted', 'conflicted_pending')`
			)
			.get(ctx.dbId) as { count: number };
		assertEquals(row.count, 0);
	} finally {
		db.close();
	}
}

function assertQualityProfileScoring(
	ctx: PcdTestContext,
	name: string
): QualityProfileScoringRow {
	const row = compiledQualityProfileScoring(ctx).find((profile) => profile.name === name);
	assertExists(row, `Expected quality profile ${name}`);
	return row;
}

function assertNoQualityProfileScoring(ctx: PcdTestContext, name: string): void {
	const row = compiledQualityProfileScoring(ctx).find((profile) => profile.name === name);
	assertEquals(row, undefined, `Expected no quality profile ${name}`);
}

function compiledQualityProfileScoring(ctx: PcdTestContext): QualityProfileScoringRow[] {
	return compiledQualityProfileState(ctx).profiles;
}

function compiledQualityProfileCustomFormatScores(
	ctx: PcdTestContext,
	name: string
): QualityProfileCustomFormatScoreRow[] {
	return compiledQualityProfileState(ctx).customFormatScores.filter(
		(score) => score.quality_profile_name === name
	);
}

function compiledCustomFormatScore(
	ctx: PcdTestContext,
	profileName: string,
	customFormatName: string,
	arrType: string
): number | null {
	return (
		compiledQualityProfileCustomFormatScores(ctx, profileName).find(
			(score) => score.custom_format_name === customFormatName && score.arr_type === arrType
		)?.score ?? null
	);
}

function compiledQualityProfileState(ctx: PcdTestContext): {
	profiles: QualityProfileScoringRow[];
	customFormatScores: QualityProfileCustomFormatScoreRow[];
} {
	const source = openDb(ctx.dbPath);
	const replay = openDb(':memory:');

	try {
		replay.exec('PRAGMA foreign_keys = ON');
		replay.exec(Deno.readTextFileSync('docs/backend/0.schema.sql'));

		const baseOps = source
			.prepare(
				`SELECT *
				 FROM pcd_ops
				 WHERE database_id = ?
				   AND origin = 'base'
				   AND state = 'published'
				 ORDER BY COALESCE(sequence, id), id`
			)
			.all(ctx.dbId) as OpRow[];

		const userOps = source
			.prepare(
				`SELECT *
				 FROM pcd_ops
				 WHERE database_id = ?
				   AND origin = 'user'
				   AND state = 'published'
				 ORDER BY COALESCE(sequence, id), id`
			)
			.all(ctx.dbId) as OpRow[];
		const histories = latestHistories(source, ctx.dbId);

		for (const op of baseOps) {
			replay.exec(op.sql);
		}
		for (const op of userOps) {
			if (histories.get(op.id)?.status !== 'applied') continue;
			replay.exec(op.sql);
		}

		const profiles = replay
			.prepare(
				`SELECT name,
				        description,
				        minimum_custom_format_score,
				        upgrade_until_score,
				        upgrade_score_increment
				 FROM quality_profiles
				 ORDER BY name`
			)
			.all() as QualityProfileScoringRow[];
		const customFormatScores = replay
			.prepare(
				`SELECT quality_profile_name, custom_format_name, arr_type, score
				 FROM quality_profile_custom_formats
				 ORDER BY quality_profile_name, custom_format_name, arr_type`
			)
			.all() as QualityProfileCustomFormatScoreRow[];

		return { profiles, customFormatScores };
	} finally {
		replay.close();
		source.close();
	}
}

function latestHistories(
	db: ReturnType<typeof openDb>,
	databaseId: number
): Map<number, LatestHistory> {
	const rows = db
		.prepare(
			`SELECT op_id, status, conflict_reason
			 FROM pcd_op_history
			 WHERE database_id = ?
			 ORDER BY applied_at ASC, id ASC`
		)
		.all(databaseId) as Array<LatestHistory & { op_id: number }>;
	const latest = new Map<number, LatestHistory>();
	for (const row of rows) {
		latest.set(row.op_id, row);
	}
	return latest;
}

function upstreamProfileScoringUpdate(
	name: string,
	changes: Record<string, { from: unknown; to: unknown }>
): SeedOperation {
	const fields = Object.keys(changes);
	const setSql = fields.map((field) => `${field} = ${sqlValue(changes[field].to)}`).join(', ');
	return {
		sql: `UPDATE quality_profiles SET ${setSql} WHERE name = ${sqlValue(name)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'quality_profile',
			name,
			stable_key: { key: 'quality_profile_name', value: name },
			changed_fields: fields
		}),
		desiredState: JSON.stringify(changes)
	};
}

function upstreamRename(from: string, to: string): SeedOperation {
	return {
		sql: `UPDATE quality_profiles SET name = ${sqlValue(to)} WHERE name = ${sqlValue(from)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'quality_profile',
			name: to,
			previousName: from,
			stable_key: { key: 'quality_profile_name', value: from },
			changed_fields: ['name']
		}),
		desiredState: JSON.stringify({ name: { from, to } })
	};
}

function upstreamCustomFormatRename(from: string, to: string): SeedOperation {
	return {
		sql: `UPDATE custom_formats SET name = ${sqlValue(to)} WHERE name = ${sqlValue(from)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'custom_format',
			name: to,
			previousName: from,
			stable_key: { key: 'custom_format_name', value: from },
			changed_fields: ['name']
		}),
		desiredState: JSON.stringify({ name: { from, to } })
	};
}

function upstreamCustomFormatDelete(name: string): SeedOperation {
	return {
		sql: `DELETE FROM custom_formats WHERE name = ${sqlValue(name)};`,
		metadata: JSON.stringify({
			operation: 'delete',
			entity: 'custom_format',
			name,
			stable_key: { key: 'custom_format_name', value: name },
			changed_fields: ['deleted']
		}),
		desiredState: JSON.stringify({ deleted: true, name })
	};
}

function upstreamUpdateCustomFormatScore(
	profileName: string,
	customFormatName: string,
	arrType: 'all' | 'radarr' | 'sonarr',
	from: number,
	to: number
): SeedOperation {
	return {
		sql: `UPDATE quality_profile_custom_formats
		      SET score = ${sqlValue(to)}
		      WHERE quality_profile_name = ${sqlValue(profileName)}
		        AND custom_format_name = ${sqlValue(customFormatName)}
		        AND arr_type = ${sqlValue(arrType)}
		        AND score = ${sqlValue(from)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'quality_profile',
			name: profileName,
			stable_key: { key: 'quality_profile_name', value: profileName },
			changed_fields: [`custom_format_score:${customFormatName}:${arrType}`],
			depends_on: [{ entity: 'custom_format', key: 'custom_format_name', value: customFormatName }]
		}),
		desiredState: JSON.stringify({
			custom_format_scores: [{ custom_format_name: customFormatName, arr_type: arrType, from, to }]
		})
	};
}

function upstreamAddCustomFormatScore(
	profileName: string,
	customFormatName: string,
	arrType: 'all' | 'radarr' | 'sonarr',
	score: number
): SeedOperation {
	return {
		sql: `INSERT INTO quality_profile_custom_formats (quality_profile_name, custom_format_name, arr_type, score)
		      VALUES (${sqlValue(profileName)}, ${sqlValue(customFormatName)}, ${sqlValue(
						arrType
					)}, ${sqlValue(score)});`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'quality_profile',
			name: profileName,
			stable_key: { key: 'quality_profile_name', value: profileName },
			changed_fields: [`custom_format_score:${customFormatName}:${arrType}`],
			depends_on: [{ entity: 'custom_format', key: 'custom_format_name', value: customFormatName }]
		}),
		desiredState: JSON.stringify({
			custom_format_scores: [
				{ custom_format_name: customFormatName, arr_type: arrType, from: null, to: score }
			]
		})
	};
}

function upstreamRemoveCustomFormatScore(
	profileName: string,
	customFormatName: string,
	arrType: 'all' | 'radarr' | 'sonarr',
	from: number
): SeedOperation {
	return {
		sql: `DELETE FROM quality_profile_custom_formats
		      WHERE quality_profile_name = ${sqlValue(profileName)}
		        AND custom_format_name = ${sqlValue(customFormatName)}
		        AND arr_type = ${sqlValue(arrType)}
		        AND score = ${sqlValue(from)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'quality_profile',
			name: profileName,
			stable_key: { key: 'quality_profile_name', value: profileName },
			changed_fields: [`custom_format_score:${customFormatName}:${arrType}`],
			depends_on: [{ entity: 'custom_format', key: 'custom_format_name', value: customFormatName }]
		}),
		desiredState: JSON.stringify({
			custom_format_scores: [
				{ custom_format_name: customFormatName, arr_type: arrType, from, to: null }
			]
		})
	};
}

function sqlValue(value: unknown): string {
	if (value === null || value === undefined) return 'NULL';
	if (typeof value === 'number') return String(value);
	if (typeof value === 'boolean') return value ? '1' : '0';
	return `'${String(value).replace(/'/g, "''")}'`;
}

await run();
