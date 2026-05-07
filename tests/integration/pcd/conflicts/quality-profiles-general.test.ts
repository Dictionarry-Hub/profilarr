/**
 * PCD conflict tests: quality profile general fields.
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

const PORT = PORTS.pcd.conflictsQualityProfilesGeneral;
const ORIGIN = `http://localhost:${PORT}`;
const STRATEGIES: ConflictStrategy[] = ['ask', 'align', 'override'];
const PROFILE_NAME = 'General Profile';

type LatestHistory = {
	status: string;
	conflict_reason: string | null;
};

type QualityProfileRow = {
	name: string;
	description: string | null;
};

type QualityProfileTagRow = {
	quality_profile_name: string;
	tag_name: string;
};

type QualityProfileLanguageRow = {
	quality_profile_name: string;
	language_name: string;
};

let counter = 0;

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

/**
 * Migrates old 2.1.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='General Profile', description='Original'
 *
 * User
 *   POST general update changes:
 *     tags = ['LocalTag']
 *
 * Upstream
 *   Published base op changes:
 *     description 'Original' -> 'Upstream description'
 *
 * Expect
 *   - user tags op applies cleanly for every strategy
 *   - no pending conflicts remain
 *   - final quality profile has the local tag and upstream description
 */
test('tags-only update applies after upstream description change', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'tags-upstream-description', [
			base.qualityProfile({
				name: PROFILE_NAME,
				description: 'Original'
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateGeneral(ctx, 1, {
			name: PROFILE_NAME,
			description: 'Original',
			tags: ['LocalTag']
		});

		seedUpstream(
			ctx,
			upstreamUpdate(PROFILE_NAME, {
				description: { from: 'Original', to: 'Upstream description' }
			})
		);
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['tags']);
		assertEquals(op.state, 'published');
		assertLatestHistory(ctx, op, 'applied');
		assertNoPendingConflicts(ctx);

		const row = assertQualityProfile(ctx, PROFILE_NAME);
		assertEquals(row.description, 'Upstream description');
		assertEquals(compiledQualityProfileTags(ctx, PROFILE_NAME), ['LocalTag']);
	}
});

/**
 * Migrates old 2.2.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='General Profile', description='Original'
 *
 * User
 *   POST general update changes:
 *     name = 'General Profile Local'
 *
 * Upstream
 *   Published base op changes:
 *     description 'Original' -> 'Upstream description'
 *
 * Expect
 *   - user rename op applies cleanly for every strategy
 *   - no pending conflicts remain
 *   - final quality profile has the local name and upstream description
 */
test('local rename applies after upstream description change', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'rename-upstream-description', [
			base.qualityProfile({
				name: PROFILE_NAME,
				description: 'Original'
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateGeneral(ctx, 1, {
			name: 'General Profile Local',
			description: 'Original'
		});

		seedUpstream(
			ctx,
			upstreamUpdate(PROFILE_NAME, {
				description: { from: 'Original', to: 'Upstream description' }
			})
		);
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['name']);
		assertEquals(op.state, 'published');
		assertLatestHistory(ctx, op, 'applied');
		assertNoPendingConflicts(ctx);

		const row = assertQualityProfile(ctx, 'General Profile Local');
		assertEquals(row.description, 'Upstream description');
		assertNoQualityProfile(ctx, PROFILE_NAME);
	}
});

/**
 * Migrates old 2.3.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='General Profile'
 *
 * User
 *   POST general update changes:
 *     description = 'Local description'
 *
 * Upstream
 *   Published base op changes:
 *     tags add ['UpstreamTag']
 *
 * Expect
 *   - user description op applies cleanly for every strategy
 *   - no pending conflicts remain
 *   - final quality profile has the local description and upstream tag
 */
test('description update applies after upstream adds a tag', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'description-upstream-tags', [
			base.qualityProfile({
				name: PROFILE_NAME
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateGeneral(ctx, 1, {
			name: PROFILE_NAME,
			description: 'Local description'
		});

		seedUpstream(ctx, upstreamAddTags(PROFILE_NAME, ['UpstreamTag']));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['description']);
		assertEquals(op.state, 'published');
		assertLatestHistory(ctx, op, 'applied');
		assertNoPendingConflicts(ctx);

		const row = assertQualityProfile(ctx, PROFILE_NAME);
		assertEquals(row.description, 'Local description');
		assertEquals(compiledQualityProfileTags(ctx, PROFILE_NAME), ['UpstreamTag']);
	}
});

/**
 * Migrates old 2.6.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='General Profile', description='Original'
 *
 * User
 *   POST general update changes:
 *     description = 'Shared description'
 *
 * Upstream
 *   Published base op changes:
 *     description 'Original' -> 'Shared description'
 *
 * Expect
 *   - user description op auto-aligns/drops for every strategy
 *   - no pending conflicts remain
 *   - final description is the shared value
 */
test('matching upstream description value auto-aligns user op', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'description-auto-align', [
			base.qualityProfile({
				name: PROFILE_NAME,
				description: 'Original'
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateGeneral(ctx, 1, {
			name: PROFILE_NAME,
			description: 'Shared description'
		});

		seedUpstream(
			ctx,
			upstreamUpdate(PROFILE_NAME, {
				description: { from: 'Original', to: 'Shared description' }
			})
		);
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['description']);
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped', 'aligned');
		assertNoPendingConflicts(ctx);

		const row = assertQualityProfile(ctx, PROFILE_NAME);
		assertEquals(row.description, 'Shared description');
	}
});

/**
 * Migrates old 2.7.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='General Profile'
 *
 * User
 *   POST delete quality profile.
 *
 * Upstream
 *   Published base delete removes the same row.
 *
 * Expect
 *   - user delete auto-aligns/drops for every strategy
 *   - no pending conflicts remain
 *   - final quality profile is absent
 */
test('delete missing target via upstream delete auto-aligns', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'delete-both', [
			base.qualityProfile({
				name: PROFILE_NAME
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.remove(ctx, 1);

		seedUpstream(ctx, upstreamDelete(PROFILE_NAME));
		await compilePcd(ctx);

		const op = firstOpForOperation(opsSince(ctx, checkpoint), 'delete');
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped', 'aligned');
		assertNoPendingConflicts(ctx);
		assertNoQualityProfile(ctx, PROFILE_NAME);
	}
});

/**
 * Migrates old 2.8 and 2.10.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='General Profile'
 *
 * User
 *   POST delete quality profile.
 *
 * Upstream
 *   Published base rename changes:
 *     name 'General Profile' -> 'General Profile Upstream'
 *
 * Expect
 *   - user delete auto-aligns/drops for every strategy
 *   - no pending conflicts remain
 *   - final quality profile keeps the upstream name
 */
test('delete missing target via upstream rename auto-aligns', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'delete-renamed', [
			base.qualityProfile({
				name: PROFILE_NAME
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.remove(ctx, 1);

		seedUpstream(ctx, upstreamRename(PROFILE_NAME, 'General Profile Upstream'));
		await compilePcd(ctx);

		const op = firstOpForOperation(opsSince(ctx, checkpoint), 'delete');
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped', 'aligned');
		assertNoPendingConflicts(ctx);
		assertQualityProfile(ctx, 'General Profile Upstream');
		assertNoQualityProfile(ctx, PROFILE_NAME);
	}
});

/**
 * Migrates old 2.17.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='General Profile'
 *
 * User
 *   POST general update changes:
 *     name = 'General Profile Local'
 *
 * Upstream
 *   Published base rename changes:
 *     name 'General Profile' -> 'General Profile Upstream'
 *
 * Expect
 *   - rename op conflicts by strategy
 *   - final name is user value only for override, otherwise upstream value
 */
test('rename conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'rename-conflict', [
			base.qualityProfile({
				name: PROFILE_NAME
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateGeneral(ctx, 1, {
			name: 'General Profile Local'
		});

		seedUpstream(ctx, upstreamRename(PROFILE_NAME, 'General Profile Upstream'));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['name']);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		if (strategy === 'override') {
			assertQualityProfile(ctx, 'General Profile Local');
			assertNoQualityProfile(ctx, 'General Profile Upstream');
		} else {
			assertQualityProfile(ctx, 'General Profile Upstream');
			assertNoQualityProfile(ctx, 'General Profile Local');
		}
	}
});

/**
 * Migrates old 2.18.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='General Profile', description='Original'
 *
 * User
 *   POST general update changes:
 *     description = 'Local description'
 *
 * Upstream
 *   Published base rename changes:
 *     name 'General Profile' -> 'General Profile Upstream'
 *
 * Expect
 *   - description op conflicts by strategy
 *   - final name is the upstream name
 *   - final description is local only for override, otherwise upstream
 */
test('description update after upstream rename resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'description-upstream-rename', [
			base.qualityProfile({
				name: PROFILE_NAME,
				description: 'Original'
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateGeneral(ctx, 1, {
			name: PROFILE_NAME,
			description: 'Local description'
		});

		seedUpstream(ctx, upstreamRename(PROFILE_NAME, 'General Profile Upstream'));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['description']);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		const row = assertQualityProfile(ctx, 'General Profile Upstream');
		assertEquals(row.description, strategy === 'override' ? 'Local description' : 'Original');
		assertNoQualityProfile(ctx, PROFILE_NAME);
	}
});

/**
 * Migrates old 2.21.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='General Profile', description='Original'
 *
 * User
 *   POST general update changes:
 *     name = 'General Profile Local'
 *     description = 'Local description'
 *
 * Upstream
 *   Published base op changes:
 *     description 'Original' -> 'Upstream description'
 *
 * Expect
 *   - rename op applies cleanly for every strategy
 *   - description op conflicts by strategy
 *   - final name keeps the local rename
 *   - final description is local only for override, otherwise upstream
 */
test('rename survives when same-save description conflicts', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'rename-description-upstream-description', [
			base.qualityProfile({
				name: PROFILE_NAME,
				description: 'Original'
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateGeneral(ctx, 1, {
			name: 'General Profile Local',
			description: 'Local description'
		});

		seedUpstream(
			ctx,
			upstreamUpdate(PROFILE_NAME, {
				description: { from: 'Original', to: 'Upstream description' }
			})
		);
		await compilePcd(ctx);

		const ops = opsSince(ctx, checkpoint);
		const renameOp = firstOpForChangedFields(ops, ['name']);
		assertEquals(renameOp.state, 'published');
		assertLatestHistory(ctx, renameOp, 'applied');

		const descriptionOp = firstOpForChangedFields(ops, ['description']);
		assertStrategyOutcome(ctx, descriptionOp, strategy, 'guard_mismatch');

		const row = assertQualityProfile(ctx, 'General Profile Local');
		assertEquals(
			row.description,
			strategy === 'override' ? 'Local description' : 'Upstream description'
		);
		assertNoQualityProfile(ctx, PROFILE_NAME);
	}
});

/**
 * Migrates old 2.23.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='General Profile', description='Original'
 *
 * User
 *   POST general update changes:
 *     description = 'Local description'
 *
 * Upstream
 *   Published base op changes:
 *     description 'Original' -> 'Upstream description'
 *
 * Expect
 *   - description op conflicts by strategy
 *   - final description is local only for override, otherwise upstream
 */
test('description conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'description-conflict', [
			base.qualityProfile({
				name: PROFILE_NAME,
				description: 'Original'
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateGeneral(ctx, 1, {
			name: PROFILE_NAME,
			description: 'Local description'
		});

		seedUpstream(
			ctx,
			upstreamUpdate(PROFILE_NAME, {
				description: { from: 'Original', to: 'Upstream description' }
			})
		);
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['description']);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		const row = assertQualityProfile(ctx, PROFILE_NAME);
		assertEquals(
			row.description,
			strategy === 'override' ? 'Local description' : 'Upstream description'
		);
	}
});

/**
 * Migrates old 2.24.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='General Profile'
 *
 * User
 *   POST general update changes:
 *     language = 'French'
 *
 * Upstream
 *   Published base op changes:
 *     language null -> 'German'
 *
 * Expect
 *   - language op conflicts by strategy
 *   - final language is local only for override, otherwise upstream
 */
test('language conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'language-conflict', [
			base.languages(['French', 'German']),
			base.qualityProfile({
				name: PROFILE_NAME
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateGeneral(ctx, 1, {
			name: PROFILE_NAME,
			language: 'French'
		});

		seedUpstream(ctx, upstreamSetLanguage(PROFILE_NAME, 'German'));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['language']);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		assertEquals(
			compiledQualityProfileLanguage(ctx, PROFILE_NAME),
			strategy === 'override' ? 'French' : 'German'
		);
	}
});

/**
 * Migrates old 2.25.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='General Profile'
 *
 * User
 *   POST general update changes:
 *     tags = ['LocalTag']
 *
 * Upstream
 *   Published base op changes:
 *     tags add ['UpstreamTag']
 *
 * Expect
 *   - user tags op applies cleanly for every strategy
 *   - no pending conflicts remain
 *   - final tags contain both tags
 */
test('different tag additions merge without conflict', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'tags-merge', [
			base.qualityProfile({
				name: PROFILE_NAME
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateGeneral(ctx, 1, {
			name: PROFILE_NAME,
			tags: ['LocalTag']
		});

		seedUpstream(ctx, upstreamAddTags(PROFILE_NAME, ['UpstreamTag']));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['tags']);
		assertEquals(op.state, 'published');
		assertLatestHistory(ctx, op, 'applied');
		assertNoPendingConflicts(ctx);
		assertEquals(compiledQualityProfileTags(ctx, PROFILE_NAME), ['LocalTag', 'UpstreamTag']);
	}
});

/**
 * Migrates old 2.26.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='General Profile', description='Original'
 *
 * User
 *   POST general update changes:
 *     description = 'Local description'
 *     tags = ['LocalTag']
 *
 * Upstream
 *   Published base op changes:
 *     description 'Original' -> 'Upstream description'
 *
 * Expect
 *   - tags op applies cleanly for every strategy
 *   - description op conflicts by strategy
 *   - final tags keep the local tag
 *   - final description is local only for override, otherwise upstream
 */
test('tag update survives when same-save description conflicts', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'description-tags-upstream-description', [
			base.qualityProfile({
				name: PROFILE_NAME,
				description: 'Original'
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateGeneral(ctx, 1, {
			name: PROFILE_NAME,
			description: 'Local description',
			tags: ['LocalTag']
		});

		seedUpstream(
			ctx,
			upstreamUpdate(PROFILE_NAME, {
				description: { from: 'Original', to: 'Upstream description' }
			})
		);
		await compilePcd(ctx);

		const ops = opsSince(ctx, checkpoint);
		const tagsOp = firstOpForChangedFields(ops, ['tags']);
		assertEquals(tagsOp.state, 'published');
		assertLatestHistory(ctx, tagsOp, 'applied');

		const descriptionOp = firstOpForChangedFields(ops, ['description']);
		assertStrategyOutcome(ctx, descriptionOp, strategy, 'guard_mismatch');

		const row = assertQualityProfile(ctx, PROFILE_NAME);
		assertEquals(
			row.description,
			strategy === 'override' ? 'Local description' : 'Upstream description'
		);
		assertEquals(compiledQualityProfileTags(ctx, PROFILE_NAME), ['LocalTag']);
	}
});

/**
 * Migrates old 2.40.
 *
 * Context
 *   Empty PCD.
 *
 * User
 *   POST create quality profile:
 *     name='Create Duplicate', description='Local create description'
 *
 * Upstream
 *   Published base create:
 *     name='Create Duplicate', description='Upstream create description'
 *
 * Expect
 *   - user create op conflicts by strategy
 *   - final description is local only for override, otherwise upstream
 */
test('create duplicate conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await newScenario(strategy, 'create-duplicate');
		await compilePcd(ctx);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.create(ctx, {
			name: 'Create Duplicate',
			description: 'Local create description'
		});

		seedUpstream(
			ctx,
			base.qualityProfile({
				name: 'Create Duplicate',
				description: 'Upstream create description'
			})
		);
		await compilePcd(ctx);

		const ops = opsSince(ctx, checkpoint);
		const op = firstOpForOperation(ops, 'create');
		assertStrategyOutcome(ctx, op, strategy, 'duplicate_key');

		const row = assertQualityProfile(ctx, 'Create Duplicate');
		assertEquals(
			row.description,
			strategy === 'override' ? 'Local create description' : 'Upstream create description'
		);
	}
});

/**
 * Migrates old 2.41.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='Update Deleted', description='Seed description'
 *
 * User
 *   POST general update changes:
 *     description = 'Local deleted description'
 *
 * Upstream
 *   Published base delete removes the row.
 *
 * Expect
 *   - description op conflicts by strategy
 *   - override recreates the quality profile with the local description
 *   - ask/align leave the quality profile deleted
 */
test('local update conflicts when upstream deletes row', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'update-upstream-deleted', [
			base.qualityProfile({
				name: 'Update Deleted',
				description: 'Seed description'
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.updateGeneral(ctx, 1, {
			name: 'Update Deleted',
			description: 'Local deleted description'
		});

		seedUpstream(ctx, upstreamDelete('Update Deleted'));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['description']);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		if (strategy === 'override') {
			const row = assertQualityProfile(ctx, 'Update Deleted');
			assertEquals(row.description, 'Local deleted description');
		} else {
			assertNoQualityProfile(ctx, 'Update Deleted');
		}
	}
});

/**
 * Migrates old 2.43.
 *
 * Context
 *   Base layer seeded with one quality profile:
 *     name='General Profile', description='Original'
 *
 * User
 *   POST delete quality profile.
 *
 * Upstream
 *   Published base op changes:
 *     description 'Original' -> 'Upstream description'
 *
 * Expect
 *   - user delete op applies cleanly for every strategy
 *   - no pending conflicts remain
 *   - final quality profile is absent
 */
test('delete applies after upstream description change', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'delete-upstream-description', [
			base.qualityProfile({
				name: PROFILE_NAME,
				description: 'Original'
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.qualityProfile.remove(ctx, 1);

		seedUpstream(
			ctx,
			upstreamUpdate(PROFILE_NAME, {
				description: { from: 'Original', to: 'Upstream description' }
			})
		);
		await compilePcd(ctx);

		const op = firstOpForOperation(opsSince(ctx, checkpoint), 'delete');
		assertEquals(op.state, 'published');
		assertLatestHistory(ctx, op, 'applied');
		assertNoPendingConflicts(ctx);
		assertNoQualityProfile(ctx, PROFILE_NAME);
	}
});

async function newScenario(strategy: ConflictStrategy, name: string): Promise<PcdTestContext> {
	counter++;
	return setupPcd({
		port: PORT,
		name: `pcd-conflict-quality-profile-general-${counter}-${strategy}-${name}`,
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

function assertQualityProfile(ctx: PcdTestContext, name: string): QualityProfileRow {
	const row = compiledQualityProfiles(ctx).find((profile) => profile.name === name);
	assertExists(row, `Expected quality profile ${name}`);
	return row;
}

function assertNoQualityProfile(ctx: PcdTestContext, name: string): void {
	const row = compiledQualityProfiles(ctx).find((profile) => profile.name === name);
	assertEquals(row, undefined, `Expected no quality profile ${name}`);
}

function compiledQualityProfiles(ctx: PcdTestContext): QualityProfileRow[] {
	return compiledQualityProfileState(ctx).profiles;
}

function compiledQualityProfileTags(ctx: PcdTestContext, name: string): string[] {
	return compiledQualityProfileState(ctx)
		.tags.filter((tag) => tag.quality_profile_name === name)
		.map((tag) => tag.tag_name);
}

function compiledQualityProfileLanguage(ctx: PcdTestContext, name: string): string | null {
	return (
		compiledQualityProfileState(ctx).languages.find(
			(language) => language.quality_profile_name === name
		)?.language_name ?? null
	);
}

function compiledQualityProfileState(ctx: PcdTestContext): {
	profiles: QualityProfileRow[];
	tags: QualityProfileTagRow[];
	languages: QualityProfileLanguageRow[];
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
				`SELECT name, description
				 FROM quality_profiles
				 ORDER BY name`
			)
			.all() as QualityProfileRow[];
		const tags = replay
			.prepare(
				`SELECT quality_profile_name, tag_name
				 FROM quality_profile_tags
				 ORDER BY quality_profile_name, tag_name`
			)
			.all() as QualityProfileTagRow[];
		const languages = replay
			.prepare(
				`SELECT quality_profile_name, language_name
				 FROM quality_profile_languages
				 ORDER BY quality_profile_name, language_name`
			)
			.all() as QualityProfileLanguageRow[];

		return { profiles, tags, languages };
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

function upstreamUpdate(
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

function upstreamAddTags(name: string, tags: string[]): SeedOperation {
	const tagSql = tags.map((tag) =>
		[
			`INSERT INTO tags (name) VALUES (${sqlValue(tag)}) ON CONFLICT(name) DO NOTHING;`,
			`INSERT INTO quality_profile_tags (quality_profile_name, tag_name) VALUES (${sqlValue(
				name
			)}, ${sqlValue(tag)});`
		].join('\n')
	);
	return {
		sql: tagSql.join('\n'),
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'quality_profile',
			name,
			stable_key: { key: 'quality_profile_name', value: name },
			changed_fields: ['tags']
		}),
		desiredState: JSON.stringify({ tags: { add: tags, remove: [] } })
	};
}

function upstreamSetLanguage(name: string, language: string): SeedOperation {
	return {
		sql: [
			`DELETE FROM quality_profile_languages WHERE quality_profile_name = ${sqlValue(name)};`,
			`INSERT INTO languages (name) VALUES (${sqlValue(language)}) ON CONFLICT(name) DO NOTHING;`,
			`INSERT INTO quality_profile_languages (quality_profile_name, language_name, type) VALUES (${sqlValue(
				name
			)}, ${sqlValue(language)}, 'simple');`
		].join('\n'),
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'quality_profile',
			name,
			stable_key: { key: 'quality_profile_name', value: name },
			changed_fields: ['language']
		}),
		desiredState: JSON.stringify({ language: { from: null, to: language } })
	};
}

function upstreamDelete(name: string): SeedOperation {
	return {
		sql: `DELETE FROM quality_profiles WHERE name = ${sqlValue(name)};`,
		metadata: JSON.stringify({
			operation: 'delete',
			entity: 'quality_profile',
			name,
			stable_key: { key: 'quality_profile_name', value: name },
			changed_fields: ['deleted']
		}),
		desiredState: JSON.stringify({ deleted: true, name })
	};
}

function sqlValue(value: unknown): string {
	if (value === null || value === undefined) return 'NULL';
	if (typeof value === 'number') return String(value);
	if (typeof value === 'boolean') return value ? '1' : '0';
	return `'${String(value).replace(/'/g, "''")}'`;
}

await run();
