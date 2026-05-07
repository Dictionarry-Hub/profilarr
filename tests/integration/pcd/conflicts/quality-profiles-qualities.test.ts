/**
 * PCD conflict tests: quality profile qualities.
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
import { write, type QualityProfileQualityItemInput } from '../harness/write.ts';

const PORT = PORTS.pcd.conflictsQualityProfilesQualities;
const ORIGIN = `http://localhost:${PORT}`;
const STRATEGIES: ConflictStrategy[] = ['ask', 'align', 'override'];
const PROFILE_NAME = 'Qualities Profile';
const QUALITY_A = 'Quality A';
const QUALITY_B = 'Quality B';
const QUALITY_C = 'Quality C';
const QUALITY_D = 'Quality D';
const GROUP_NAME = 'Quality Group';

type LatestHistory = {
	status: string;
	conflict_reason: string | null;
};

type QualityProfileRow = {
	name: string;
	minimum_custom_format_score: number;
};

type QualityItemRow = {
	quality_profile_name: string;
	type: 'quality' | 'group';
	name: string;
	position: number;
	enabled: number;
	upgrade_until: number;
};

type QualityGroupMemberRow = {
	quality_profile_name: string;
	quality_group_name: string;
	quality_name: string;
	position: number;
};

let counter = 0;

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

/**
 * Migrates old 2.5.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     quality_item:quality:Quality A enabled=true
 *     minimum_custom_format_score=0
 *
 * User
 *   POST qualities update changes:
 *     quality_item:quality:Quality A enabled true -> false
 *
 * Upstream
 *   Published base op changes:
 *     minimum_custom_format_score 0 -> 9
 *
 * Expect
 *   - user quality item op applies cleanly for every strategy
 *   - no pending conflicts remain
 *   - final profile has local enabled flag and upstream minimum score
 */
test('quality enabled toggle applies after upstream minimum score change', async () => {
	for (const strategy of STRATEGIES) {
		const baseItems = [
			qualityItem(QUALITY_A, 0, { enabled: true }),
			qualityItem(QUALITY_B, 1, { upgradeUntil: true })
		];
		const ctx = await seededScenario(strategy, 'quality-enabled-upstream-minimum-score', [
			base.qualityProfile({
				name: PROFILE_NAME,
				qualityItems: baseItems
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateQualities(ctx, 1, {
			orderedItems: [
				qualityItem(QUALITY_A, 0, { enabled: false }),
				qualityItem(QUALITY_B, 1, { upgradeUntil: true })
			]
		});

		seedUpstream(
			ctx,
			upstreamProfileScoringUpdate(PROFILE_NAME, {
				minimum_custom_format_score: { from: 0, to: 9 }
			})
		);
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			`quality_item:quality:${QUALITY_A}`
		]);
		assertEquals(op.state, 'published');
		assertLatestHistory(ctx, op, 'applied');
		assertNoPendingConflicts(ctx);

		const profile = assertQualityProfile(ctx, PROFILE_NAME);
		assertEquals(profile.minimum_custom_format_score, 9);
		const quality = assertQualityItem(ctx, PROFILE_NAME, 'quality', QUALITY_A);
		assertEquals(quality.enabled, 0);
		assertEquals(quality.position, 0);
	}
});

/**
 * Migrates old 2.9.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     quality_item:quality:Quality A enabled=true
 *
 * User
 *   POST qualities update changes:
 *     quality_item:quality:Quality A enabled true -> false
 *
 * Upstream
 *   Published base op changes the same row to the same enabled=false value.
 *
 * Expect
 *   - user quality item op auto-aligns/drops for every strategy
 *   - no pending conflicts remain
 *   - final enabled flag is the shared value
 */
test('matching upstream quality enabled toggle auto-aligns user op', async () => {
	for (const strategy of STRATEGIES) {
		const baseItems = [
			qualityItem(QUALITY_A, 0, { enabled: true }),
			qualityItem(QUALITY_B, 1, { upgradeUntil: true })
		];
		const nextItems = [
			qualityItem(QUALITY_A, 0, { enabled: false }),
			qualityItem(QUALITY_B, 1, { upgradeUntil: true })
		];
		const ctx = await seededScenario(strategy, 'quality-enabled-auto-align', [
			base.qualityProfile({
				name: PROFILE_NAME,
				qualityItems: baseItems
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateQualities(ctx, 1, {
			orderedItems: nextItems
		});

		seedUpstream(ctx, upstreamQualityItemsUpdate(PROFILE_NAME, baseItems, nextItems));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			`quality_item:quality:${QUALITY_A}`
		]);
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped', 'aligned');
		assertNoPendingConflicts(ctx);

		const quality = assertQualityItem(ctx, PROFILE_NAME, 'quality', QUALITY_A);
		assertEquals(quality.enabled, 0);
	}
});

/**
 * Migrates old 2.20.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='Qualities Profile'
 *     quality_item:quality:Quality A enabled=true
 *
 * User
 *   POST qualities update changes:
 *     quality_item:quality:Quality A enabled true -> false
 *
 * Upstream
 *   Published base rename changes:
 *     name 'Qualities Profile' -> 'Qualities Profile Upstream'
 *
 * Expect
 *   - qualities op conflicts by strategy
 *   - final name is the upstream name
 *   - final enabled flag is local only for override, otherwise upstream
 */
test('quality enabled toggle after upstream rename resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const baseItems = [
			qualityItem(QUALITY_A, 0, { enabled: true }),
			qualityItem(QUALITY_B, 1, { upgradeUntil: true })
		];
		const ctx = await seededScenario(strategy, 'quality-enabled-upstream-rename', [
			base.qualityProfile({
				name: PROFILE_NAME,
				qualityItems: baseItems
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateQualities(ctx, 1, {
			orderedItems: [
				qualityItem(QUALITY_A, 0, { enabled: false }),
				qualityItem(QUALITY_B, 1, { upgradeUntil: true })
			]
		});

		seedUpstream(ctx, upstreamRename(PROFILE_NAME, 'Qualities Profile Upstream'));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			`quality_item:quality:${QUALITY_A}`
		]);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		assertNoQualityProfile(ctx, PROFILE_NAME);
		const quality = assertQualityItem(ctx, 'Qualities Profile Upstream', 'quality', QUALITY_A);
		assertEquals(quality.enabled, strategy === 'override' ? 0 : 1);
	}
});

/**
 * Migrates old 2.27.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     quality order: Quality A, Quality B, Quality C
 *
 * User
 *   POST qualities update changes order to:
 *     Quality B, Quality A, Quality C
 *
 * Upstream
 *   Published base op changes order to:
 *     Quality B, Quality C, Quality A
 *
 * Expect
 *   - reorder op conflicts by strategy
 *   - final order is local only for override, otherwise upstream
 */
test('quality reorder conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const baseItems = [
			qualityItem(QUALITY_A, 0),
			qualityItem(QUALITY_B, 1),
			qualityItem(QUALITY_C, 2, { upgradeUntil: true })
		];
		const localItems = [
			qualityItem(QUALITY_B, 0),
			qualityItem(QUALITY_A, 1),
			qualityItem(QUALITY_C, 2, { upgradeUntil: true })
		];
		const upstreamItems = [
			qualityItem(QUALITY_B, 0),
			qualityItem(QUALITY_C, 1, { upgradeUntil: true }),
			qualityItem(QUALITY_A, 2)
		];
		const ctx = await seededScenario(strategy, 'quality-reorder-conflict', [
			base.qualityProfile({
				name: PROFILE_NAME,
				qualityItems: baseItems
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateQualities(ctx, 1, {
			orderedItems: localItems
		});

		seedUpstream(ctx, upstreamQualityItemsUpdate(PROFILE_NAME, baseItems, upstreamItems));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			`quality_item:quality:${QUALITY_A}`,
			`quality_item:quality:${QUALITY_B}`
		]);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		assertEquals(
			compiledQualityOrder(ctx, PROFILE_NAME),
			strategy === 'override'
				? [QUALITY_B, QUALITY_A, QUALITY_C]
				: [QUALITY_B, QUALITY_C, QUALITY_A]
		);
	}
});

/**
 * Migrates old 2.28.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     quality order: Quality A, Quality B, Quality C
 *
 * User
 *   POST qualities update creates a group:
 *     Quality Group containing Quality A and Quality B
 *
 * Upstream
 *   Published base op reorders qualities to:
 *     Quality B, Quality C, Quality A
 *
 * Expect
 *   - add-group op conflicts by strategy
 *   - final list keeps the group only for override, otherwise upstream order wins
 */
test('quality group add conflicts with upstream reorder', async () => {
	for (const strategy of STRATEGIES) {
		const baseItems = [
			qualityItem(QUALITY_A, 0),
			qualityItem(QUALITY_B, 1),
			qualityItem(QUALITY_C, 2, { upgradeUntil: true })
		];
		const localItems = [
			qualityGroup(GROUP_NAME, 0, [QUALITY_A, QUALITY_B]),
			qualityItem(QUALITY_C, 1, { upgradeUntil: true })
		];
		const upstreamItems = [
			qualityItem(QUALITY_B, 0),
			qualityItem(QUALITY_C, 1, { upgradeUntil: true }),
			qualityItem(QUALITY_A, 2)
		];
		const ctx = await seededScenario(strategy, 'quality-add-group-upstream-reorder', [
			base.qualityProfile({
				name: PROFILE_NAME,
				qualityItems: baseItems
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateQualities(ctx, 1, {
			orderedItems: localItems
		});

		seedUpstream(ctx, upstreamQualityItemsUpdate(PROFILE_NAME, baseItems, upstreamItems));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			`quality_item:group:${GROUP_NAME}`,
			`quality_item:quality:${QUALITY_A}`,
			`quality_item:quality:${QUALITY_B}`,
			`quality_item:quality:${QUALITY_C}`
		]);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		if (strategy === 'override') {
			assertEquals(compiledQualityOrder(ctx, PROFILE_NAME), [GROUP_NAME, QUALITY_C]);
			assertEquals(compiledGroupMembers(ctx, PROFILE_NAME, GROUP_NAME), [QUALITY_A, QUALITY_B]);
		} else {
			assertEquals(compiledQualityOrder(ctx, PROFILE_NAME), [QUALITY_B, QUALITY_C, QUALITY_A]);
			assertEquals(compiledGroupMembers(ctx, PROFILE_NAME, GROUP_NAME), []);
		}
	}
});

/**
 * Migrates old 2.29.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     quality order: Quality Group, Quality C, Quality D
 *     Quality Group contains Quality A and Quality B
 *
 * User
 *   POST qualities update collapses the group back to individual qualities.
 *
 * Upstream
 *   Published base op reorders the grouped list to:
 *     Quality C, Quality D, Quality Group
 *
 * Expect
 *   - remove-group op conflicts by strategy
 *   - final list drops the group only for override, otherwise upstream grouped order wins
 */
test('quality group remove conflicts with upstream reorder', async () => {
	for (const strategy of STRATEGIES) {
		const baseItems = [
			qualityGroup(GROUP_NAME, 0, [QUALITY_A, QUALITY_B]),
			qualityItem(QUALITY_C, 1),
			qualityItem(QUALITY_D, 2, { upgradeUntil: true })
		];
		const localItems = [
			qualityItem(QUALITY_A, 0),
			qualityItem(QUALITY_B, 1),
			qualityItem(QUALITY_C, 2),
			qualityItem(QUALITY_D, 3, { upgradeUntil: true })
		];
		const upstreamItems = [
			qualityItem(QUALITY_C, 0),
			qualityItem(QUALITY_D, 1, { upgradeUntil: true }),
			qualityGroup(GROUP_NAME, 2, [QUALITY_A, QUALITY_B])
		];
		const ctx = await seededScenario(strategy, 'quality-remove-group-upstream-reorder', [
			base.qualityProfile({
				name: PROFILE_NAME,
				qualityItems: baseItems
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateQualities(ctx, 1, {
			orderedItems: localItems
		});

		seedUpstream(ctx, upstreamQualityItemsUpdate(PROFILE_NAME, baseItems, upstreamItems));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			`quality_item:group:${GROUP_NAME}`,
			`quality_item:quality:${QUALITY_A}`,
			`quality_item:quality:${QUALITY_B}`,
			`quality_item:quality:${QUALITY_C}`,
			`quality_item:quality:${QUALITY_D}`
		]);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		if (strategy === 'override') {
			assertEquals(compiledQualityOrder(ctx, PROFILE_NAME), [
				QUALITY_A,
				QUALITY_B,
				QUALITY_C,
				QUALITY_D
			]);
			assertEquals(compiledGroupMembers(ctx, PROFILE_NAME, GROUP_NAME), []);
		} else {
			assertEquals(compiledQualityOrder(ctx, PROFILE_NAME), [QUALITY_C, QUALITY_D, GROUP_NAME]);
			assertEquals(compiledGroupMembers(ctx, PROFILE_NAME, GROUP_NAME), [QUALITY_A, QUALITY_B]);
		}
	}
});

/**
 * Migrates old 2.30.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     Quality A has upgrade_until=true
 *
 * User
 *   POST qualities update moves upgrade_until to Quality B.
 *
 * Upstream
 *   Published base op moves upgrade_until to Quality C.
 *
 * Expect
 *   - upgrade-until move conflicts by strategy
 *   - current conflict reason is duplicate_key because replay hits the one-upgrade-until index
 *   - final upgrade-until target is local only for override, otherwise upstream
 */
test('quality upgrade-until move conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const baseItems = [
			qualityItem(QUALITY_A, 0, { upgradeUntil: true }),
			qualityItem(QUALITY_B, 1),
			qualityItem(QUALITY_C, 2)
		];
		const localItems = [
			qualityItem(QUALITY_A, 0),
			qualityItem(QUALITY_B, 1, { upgradeUntil: true }),
			qualityItem(QUALITY_C, 2)
		];
		const upstreamItems = [
			qualityItem(QUALITY_A, 0),
			qualityItem(QUALITY_B, 1),
			qualityItem(QUALITY_C, 2, { upgradeUntil: true })
		];
		const ctx = await seededScenario(strategy, 'quality-upgrade-until-conflict', [
			base.qualityProfile({
				name: PROFILE_NAME,
				qualityItems: baseItems
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateQualities(ctx, 1, {
			orderedItems: localItems
		});

		seedUpstream(ctx, upstreamQualityItemsUpdate(PROFILE_NAME, baseItems, upstreamItems));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			`quality_item:quality:${QUALITY_A}`,
			`quality_item:quality:${QUALITY_B}`
		]);
		assertStrategyOutcome(ctx, op, strategy, 'duplicate_key');

		assertEquals(
			compiledUpgradeUntilName(ctx, PROFILE_NAME),
			strategy === 'override' ? QUALITY_B : QUALITY_C
		);
	}
});

/**
 * Migrates old 2.31.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     quality order: Quality A, Quality B, Quality C
 *     Quality A enabled=true
 *
 * User
 *   POST qualities update toggles Quality A enabled true -> false.
 *
 * Upstream
 *   Published base op reorders qualities to:
 *     Quality B, Quality C, Quality A
 *
 * Expect
 *   - enabled toggle conflicts with upstream reorder by strategy
 *   - final list and enabled state are local only for override, otherwise upstream
 */
test('quality enabled toggle conflicts with upstream reorder', async () => {
	for (const strategy of STRATEGIES) {
		const baseItems = [
			qualityItem(QUALITY_A, 0, { enabled: true }),
			qualityItem(QUALITY_B, 1),
			qualityItem(QUALITY_C, 2, { upgradeUntil: true })
		];
		const localItems = [
			qualityItem(QUALITY_A, 0, { enabled: false }),
			qualityItem(QUALITY_B, 1),
			qualityItem(QUALITY_C, 2, { upgradeUntil: true })
		];
		const upstreamItems = [
			qualityItem(QUALITY_B, 0),
			qualityItem(QUALITY_C, 1, { upgradeUntil: true }),
			qualityItem(QUALITY_A, 2, { enabled: true })
		];
		const ctx = await seededScenario(strategy, 'quality-enabled-upstream-reorder', [
			base.qualityProfile({
				name: PROFILE_NAME,
				qualityItems: baseItems
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateQualities(ctx, 1, {
			orderedItems: localItems
		});

		seedUpstream(ctx, upstreamQualityItemsUpdate(PROFILE_NAME, baseItems, upstreamItems));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			`quality_item:quality:${QUALITY_A}`
		]);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		if (strategy === 'override') {
			assertEquals(compiledQualityOrder(ctx, PROFILE_NAME), [QUALITY_A, QUALITY_B, QUALITY_C]);
			assertEquals(assertQualityItem(ctx, PROFILE_NAME, 'quality', QUALITY_A).enabled, 0);
		} else {
			assertEquals(compiledQualityOrder(ctx, PROFILE_NAME), [QUALITY_B, QUALITY_C, QUALITY_A]);
			assertEquals(assertQualityItem(ctx, PROFILE_NAME, 'quality', QUALITY_A).enabled, 1);
		}
	}
});

/**
 * Migrates old 2.47.
 *
 * Context
 *   Base layer seeded with one quality group:
 *     Quality Group members: Quality A, Quality B, Quality C
 *
 * User
 *   POST qualities update reorders group members to:
 *     Quality C, Quality A, Quality B
 *
 * Upstream
 *   Published base op reorders group members to:
 *     Quality B, Quality C, Quality A
 *
 * Expect
 *   - group member reorder conflicts by strategy
 *   - final member order is local only for override, otherwise upstream
 */
test('quality group member reorder conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const baseItems = [
			qualityGroup(GROUP_NAME, 0, [QUALITY_A, QUALITY_B, QUALITY_C]),
			qualityItem(QUALITY_D, 1, { upgradeUntil: true })
		];
		const localItems = [
			qualityGroup(GROUP_NAME, 0, [QUALITY_C, QUALITY_A, QUALITY_B]),
			qualityItem(QUALITY_D, 1, { upgradeUntil: true })
		];
		const upstreamItems = [
			qualityGroup(GROUP_NAME, 0, [QUALITY_B, QUALITY_C, QUALITY_A]),
			qualityItem(QUALITY_D, 1, { upgradeUntil: true })
		];
		const ctx = await seededScenario(strategy, 'quality-group-member-reorder-conflict', [
			base.qualityProfile({
				name: PROFILE_NAME,
				qualityItems: baseItems
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateQualities(ctx, 1, {
			orderedItems: localItems
		});

		seedUpstream(ctx, upstreamQualityItemsUpdate(PROFILE_NAME, baseItems, upstreamItems));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			`quality_item:group:${GROUP_NAME}`
		]);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		assertEquals(
			compiledGroupMembers(ctx, PROFILE_NAME, GROUP_NAME),
			strategy === 'override'
				? [QUALITY_C, QUALITY_A, QUALITY_B]
				: [QUALITY_B, QUALITY_C, QUALITY_A]
		);
	}
});

/**
 * Migrates old 2.48.
 *
 * Context
 *   Base layer seeded with one quality group:
 *     Quality Group members: Quality A, Quality B, Quality C
 *
 * User
 *   POST qualities update reorders group members to:
 *     Quality C, Quality A, Quality B
 *
 * Upstream
 *   Published base op reorders group members to the same order.
 *
 * Expect
 *   - user group member reorder auto-aligns/drops for every strategy
 *   - no pending conflicts remain
 *   - final member order is the shared value
 */
test('matching upstream group member reorder auto-aligns user op', async () => {
	for (const strategy of STRATEGIES) {
		const baseItems = [
			qualityGroup(GROUP_NAME, 0, [QUALITY_A, QUALITY_B, QUALITY_C]),
			qualityItem(QUALITY_D, 1, { upgradeUntil: true })
		];
		const nextItems = [
			qualityGroup(GROUP_NAME, 0, [QUALITY_C, QUALITY_A, QUALITY_B]),
			qualityItem(QUALITY_D, 1, { upgradeUntil: true })
		];
		const ctx = await seededScenario(strategy, 'quality-group-member-reorder-auto-align', [
			base.qualityProfile({
				name: PROFILE_NAME,
				qualityItems: baseItems
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateQualities(ctx, 1, {
			orderedItems: nextItems
		});

		seedUpstream(ctx, upstreamQualityItemsUpdate(PROFILE_NAME, baseItems, nextItems));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			`quality_item:group:${GROUP_NAME}`
		]);
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped', 'aligned');
		assertNoPendingConflicts(ctx);
		assertEquals(compiledGroupMembers(ctx, PROFILE_NAME, GROUP_NAME), [
			QUALITY_C,
			QUALITY_A,
			QUALITY_B
		]);
	}
});

/**
 * Migrates old 2.49.
 *
 * Context
 *   Base layer seeded with one quality group:
 *     Quality Group members: Quality A, Quality B, Quality C
 *     Quality D is available outside the ordered list
 *
 * User
 *   POST qualities update reorders group members to:
 *     Quality C, Quality A, Quality B
 *
 * Upstream
 *   Published base op adds Quality D to the same group.
 *
 * Expect
 *   - group member reorder conflicts with upstream add by strategy
 *   - final member list is local only for override, otherwise upstream
 */
test('quality group member reorder conflicts with upstream member add', async () => {
	for (const strategy of STRATEGIES) {
		const baseItems = [qualityGroup(GROUP_NAME, 0, [QUALITY_A, QUALITY_B, QUALITY_C])];
		const localItems = [qualityGroup(GROUP_NAME, 0, [QUALITY_C, QUALITY_A, QUALITY_B])];
		const upstreamItems = [
			qualityGroup(GROUP_NAME, 0, [QUALITY_A, QUALITY_B, QUALITY_C, QUALITY_D])
		];
		const ctx = await seededScenario(strategy, 'quality-group-member-reorder-upstream-add', [
			base.qualities({ entries: [{ name: QUALITY_D, arrType: 'radarr' }] }),
			base.qualityProfile({
				name: PROFILE_NAME,
				qualityItems: baseItems
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateQualities(ctx, 1, {
			orderedItems: localItems
		});

		seedUpstream(ctx, upstreamQualityItemsUpdate(PROFILE_NAME, baseItems, upstreamItems));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			`quality_item:group:${GROUP_NAME}`
		]);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		assertEquals(
			compiledGroupMembers(ctx, PROFILE_NAME, GROUP_NAME),
			strategy === 'override'
				? [QUALITY_C, QUALITY_A, QUALITY_B]
				: [QUALITY_A, QUALITY_B, QUALITY_C, QUALITY_D]
		);
	}
});

/**
 * Migrates old 2.50.
 *
 * Context
 *   Base layer seeded with one quality group:
 *     Quality Group members: Quality A, Quality B, Quality C
 *     Quality D is available outside the ordered list
 *
 * User
 *   POST qualities update adds Quality D to the group.
 *
 * Upstream
 *   Published base op reorders the original group members to:
 *     Quality C, Quality A, Quality B
 *
 * Expect
 *   - group member add conflicts with upstream reorder by strategy
 *   - final member list is local only for override, otherwise upstream
 */
test('quality group member add conflicts with upstream member reorder', async () => {
	for (const strategy of STRATEGIES) {
		const baseItems = [qualityGroup(GROUP_NAME, 0, [QUALITY_A, QUALITY_B, QUALITY_C])];
		const localItems = [
			qualityGroup(GROUP_NAME, 0, [QUALITY_A, QUALITY_B, QUALITY_C, QUALITY_D])
		];
		const upstreamItems = [qualityGroup(GROUP_NAME, 0, [QUALITY_C, QUALITY_A, QUALITY_B])];
		const ctx = await seededScenario(strategy, 'quality-group-member-add-upstream-reorder', [
			base.qualities({ entries: [{ name: QUALITY_D, arrType: 'radarr' }] }),
			base.qualityProfile({
				name: PROFILE_NAME,
				qualityItems: baseItems
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateQualities(ctx, 1, {
			orderedItems: localItems
		});

		seedUpstream(ctx, upstreamQualityItemsUpdate(PROFILE_NAME, baseItems, upstreamItems));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			`quality_item:group:${GROUP_NAME}`
		]);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		assertEquals(
			compiledGroupMembers(ctx, PROFILE_NAME, GROUP_NAME),
			strategy === 'override'
				? [QUALITY_A, QUALITY_B, QUALITY_C, QUALITY_D]
				: [QUALITY_C, QUALITY_A, QUALITY_B]
		);
	}
});

/**
 * Migrates old 2.51.
 *
 * Context
 *   Base layer seeded with one quality group:
 *     Quality Group members: Quality A, Quality B, Quality C
 *
 * User
 *   POST qualities update collapses the group back to individual qualities.
 *
 * Upstream
 *   Published base op reorders group members to:
 *     Quality C, Quality A, Quality B
 *
 * Expect
 *   - user collapse applies cleanly for every strategy
 *   - no pending conflicts remain
 *   - final list has no group and keeps the individual qualities
 */
test('quality group collapse applies after upstream member reorder', async () => {
	for (const strategy of STRATEGIES) {
		const baseItems = [qualityGroup(GROUP_NAME, 0, [QUALITY_A, QUALITY_B, QUALITY_C])];
		const localItems = [qualityItem(QUALITY_A, 0), qualityItem(QUALITY_B, 1), qualityItem(QUALITY_C, 2)];
		const upstreamItems = [qualityGroup(GROUP_NAME, 0, [QUALITY_C, QUALITY_A, QUALITY_B])];
		const ctx = await seededScenario(strategy, 'quality-group-collapse-upstream-member-reorder', [
			base.qualityProfile({
				name: PROFILE_NAME,
				qualityItems: baseItems
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateQualities(ctx, 1, {
			orderedItems: localItems
		});

		seedUpstream(ctx, upstreamQualityItemsUpdate(PROFILE_NAME, baseItems, upstreamItems));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			`quality_item:group:${GROUP_NAME}`,
			`quality_item:quality:${QUALITY_A}`,
			`quality_item:quality:${QUALITY_B}`,
			`quality_item:quality:${QUALITY_C}`
		]);
		assertEquals(op.state, 'published');
		assertLatestHistory(ctx, op, 'applied');
		assertNoPendingConflicts(ctx);

		assertEquals(compiledQualityOrder(ctx, PROFILE_NAME), [QUALITY_A, QUALITY_B, QUALITY_C]);
		assertEquals(compiledGroupMembers(ctx, PROFILE_NAME, GROUP_NAME), []);
	}
});

/**
 * Migrates old 2.52.
 *
 * Context
 *   Base layer seeded with one quality group:
 *     Quality Group members: Quality A, Quality B
 *     Quality C and Quality D are available outside the ordered list
 *
 * User
 *   POST qualities update adds Quality C to the group.
 *
 * Upstream
 *   Published base op adds Quality D to the same group.
 *
 * Expect
 *   - different group member adds conflict by strategy
 *   - final member list is local only for override, otherwise upstream
 */
test('different quality group member adds conflict by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const baseItems = [qualityGroup(GROUP_NAME, 0, [QUALITY_A, QUALITY_B])];
		const localItems = [qualityGroup(GROUP_NAME, 0, [QUALITY_A, QUALITY_B, QUALITY_C])];
		const upstreamItems = [qualityGroup(GROUP_NAME, 0, [QUALITY_A, QUALITY_B, QUALITY_D])];
		const ctx = await seededScenario(strategy, 'quality-group-both-add-different-members', [
			base.qualities({
				entries: [
					{ name: QUALITY_C, arrType: 'radarr' },
					{ name: QUALITY_D, arrType: 'radarr' }
				]
			}),
			base.qualityProfile({
				name: PROFILE_NAME,
				qualityItems: baseItems
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateQualities(ctx, 1, {
			orderedItems: localItems
		});

		seedUpstream(ctx, upstreamQualityItemsUpdate(PROFILE_NAME, baseItems, upstreamItems));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), [
			`quality_item:group:${GROUP_NAME}`
		]);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		assertEquals(
			compiledGroupMembers(ctx, PROFILE_NAME, GROUP_NAME),
			strategy === 'override'
				? [QUALITY_A, QUALITY_B, QUALITY_C]
				: [QUALITY_A, QUALITY_B, QUALITY_D]
		);
	}
});

async function newScenario(strategy: ConflictStrategy, name: string): Promise<PcdTestContext> {
	counter++;
	return setupPcd({
		port: PORT,
		name: `pcd-conflict-quality-profile-qualities-${counter}-${strategy}-${name}`,
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

function changedFields(op: OpRow): string[] {
	const fields = parseMetadata(op).changed_fields;
	if (!Array.isArray(fields)) return [];
	return fields.filter((field): field is string => typeof field === 'string');
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

function assertQualityProfile(ctx: PcdTestContext, name: string): QualityProfileRow {
	const row = compiledQualityProfileState(ctx).profiles.find((profile) => profile.name === name);
	assertExists(row, `Expected quality profile ${name}`);
	return row;
}

function assertNoQualityProfile(ctx: PcdTestContext, name: string): void {
	const row = compiledQualityProfileState(ctx).profiles.find((profile) => profile.name === name);
	assertEquals(row, undefined, `Expected no quality profile ${name}`);
}

function assertQualityItem(
	ctx: PcdTestContext,
	profileName: string,
	type: 'quality' | 'group',
	name: string
): QualityItemRow {
	const row = compiledQualityProfileState(ctx).qualityItems.find(
		(item) =>
			item.quality_profile_name === profileName && item.type === type && item.name === name
	);
	assertExists(row, `Expected quality item ${type}:${name}`);
	return row;
}

function compiledQualityOrder(ctx: PcdTestContext, profileName: string): string[] {
	return compiledQualityProfileState(ctx)
		.qualityItems.filter((item) => item.quality_profile_name === profileName)
		.sort((a, b) => a.position - b.position)
		.map((item) => item.name);
}

function compiledUpgradeUntilName(ctx: PcdTestContext, profileName: string): string | null {
	return (
		compiledQualityProfileState(ctx).qualityItems.find(
			(item) => item.quality_profile_name === profileName && item.upgrade_until === 1
		)?.name ?? null
	);
}

function compiledGroupMembers(
	ctx: PcdTestContext,
	profileName: string,
	groupName: string
): string[] {
	return compiledQualityProfileState(ctx)
		.groupMembers.filter(
			(member) =>
				member.quality_profile_name === profileName &&
				member.quality_group_name === groupName
		)
		.sort((a, b) => a.position - b.position)
		.map((member) => member.quality_name);
}

function qualityItem(
	name: string,
	position: number,
	overrides: Partial<QualityProfileQualityItemInput> = {}
): QualityProfileQualityItemInput {
	return {
		type: 'quality',
		name,
		position,
		enabled: overrides.enabled ?? true,
		upgradeUntil: overrides.upgradeUntil ?? false,
		members: overrides.members
	};
}

function qualityGroup(
	name: string,
	position: number,
	members: string[],
	overrides: Partial<QualityProfileQualityItemInput> = {}
): QualityProfileQualityItemInput {
	return {
		type: 'group',
		name,
		position,
		enabled: overrides.enabled ?? true,
		upgradeUntil: overrides.upgradeUntil ?? false,
		members: members.map((member) => ({ name: member }))
	};
}

function compiledQualityProfileState(ctx: PcdTestContext): {
	profiles: QualityProfileRow[];
	qualityItems: QualityItemRow[];
	groupMembers: QualityGroupMemberRow[];
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
				        minimum_custom_format_score
				 FROM quality_profiles
				 ORDER BY name`
			)
			.all() as QualityProfileRow[];
		const qualityItems = replay
			.prepare(
				`SELECT quality_profile_name,
				        CASE
				          WHEN quality_group_name IS NULL THEN 'quality'
				          ELSE 'group'
				        END AS type,
				        COALESCE(quality_name, quality_group_name) AS name,
				        position,
				        enabled,
				        upgrade_until
				 FROM quality_profile_qualities
				 ORDER BY quality_profile_name, position, name`
			)
			.all() as QualityItemRow[];
		const groupMembers = replay
			.prepare(
				`SELECT quality_profile_name,
				        quality_group_name,
				        quality_name,
				        position
				 FROM quality_group_members
				 ORDER BY quality_profile_name, quality_group_name, position, quality_name`
			)
			.all() as QualityGroupMemberRow[];

		return { profiles, qualityItems, groupMembers };
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

function upstreamQualityItemsUpdate(
	name: string,
	from: QualityProfileQualityItemInput[],
	to: QualityProfileQualityItemInput[]
): SeedOperation {
	const statements: string[] = [];
	const fromByKey = new Map(from.map((item) => [qualityItemKey(item), item]));
	const changedFields: string[] = [];

	for (const item of to) {
		const current = fromByKey.get(qualityItemKey(item));
		if (!current) continue;
		const membersChanged =
			item.type === 'group' &&
			!stringArraysEqual(memberNames(current.members), memberNames(item.members));
		if (
			current.position === item.position &&
			current.enabled === item.enabled &&
			current.upgradeUntil === item.upgradeUntil &&
			!membersChanged
		) {
			continue;
		}

		changedFields.push(`quality_item:${item.type}:${item.name}`);
		if (item.type === 'quality') {
			statements.push(
				`UPDATE quality_profile_qualities
				 SET position = ${item.position},
				     enabled = ${item.enabled ? 1 : 0},
				     upgrade_until = ${item.upgradeUntil ? 1 : 0}
				 WHERE quality_profile_name = ${sqlValue(name)}
				   AND quality_name = ${sqlValue(item.name)}
				   AND quality_group_name IS NULL;`
			);
		} else {
			statements.push(
				`UPDATE quality_profile_qualities
				 SET position = ${item.position},
				     enabled = ${item.enabled ? 1 : 0},
				     upgrade_until = ${item.upgradeUntil ? 1 : 0}
				 WHERE quality_profile_name = ${sqlValue(name)}
				   AND quality_group_name = ${sqlValue(item.name)}
				   AND quality_name IS NULL;`
			);
			if (membersChanged) {
				const members = memberNames(item.members);
				const memberRows = members
					.map(
						(member, index) =>
							`SELECT ${sqlValue(name)} AS quality_profile_name,
							        ${sqlValue(item.name)} AS quality_group_name,
							        ${sqlValue(member)} AS quality_name,
							        ${index} AS position`
					)
					.join('\nUNION ALL\n');
				statements.push(
					`DELETE FROM quality_group_members
					 WHERE quality_profile_name = ${sqlValue(name)}
					   AND quality_group_name = ${sqlValue(item.name)};`
				);
				statements.push(
					`INSERT INTO quality_group_members
					   (quality_profile_name, quality_group_name, quality_name, position)
					 ${memberRows};`
				);
			}
		}
	}

	return {
		sql: statements.join('\n'),
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'quality_profile',
			name,
			stable_key: { key: 'quality_profile_name', value: name },
			changed_fields: changedFields
		}),
		desiredState: JSON.stringify({
			ordered_items: { from, to }
		})
	};
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

function qualityItemKey(item: QualityProfileQualityItemInput): string {
	return `${item.type}:${item.name}`;
}

function memberNames(
	members: QualityProfileQualityItemInput['members'] | undefined
): string[] {
	return (members ?? []).map((member) => member.name);
}

function stringArraysEqual(a: string[], b: string[]): boolean {
	return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sqlValue(value: unknown): string {
	if (value === null || value === undefined) return 'NULL';
	if (typeof value === 'number') return String(value);
	if (typeof value === 'boolean') return value ? '1' : '0';
	return `'${String(value).replace(/'/g, "''")}'`;
}

await run();
