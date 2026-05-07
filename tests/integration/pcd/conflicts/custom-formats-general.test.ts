/**
 * PCD conflict tests: custom format general fields.
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

const PORT = PORTS.pcd.conflictsCustomFormatsGeneral;
const ORIGIN = `http://localhost:${PORT}`;
const STRATEGIES: ConflictStrategy[] = ['ask', 'align', 'override'];

type LatestHistory = {
	status: string;
	conflict_reason: string | null;
};

type CustomFormatRow = {
	name: string;
	description: string | null;
	include_in_rename: number;
};

type CustomFormatTagRow = {
	custom_format_name: string;
	tag_name: string;
};

let counter = 0;

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

/**
 * Context
 *   Base layer seeded with one custom format via base.customFormat():
 *     name='Include Auto Align', includeInRename=false
 *
 * User
 *   POST update changes:
 *     includeInRename = true
 *
 * Upstream
 *   Published base op changes:
 *     include_in_rename false -> true
 *
 * Expect
 *   - user include_in_rename op auto-aligns/drops for every strategy
 *   - no pending conflicts remain
 *   - final include_in_rename is true
 */
test('matching upstream include_in_rename value auto-aligns user op', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'include-auto-align', [
			base.customFormat({
				name: 'Include Auto Align',
				includeInRename: false
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.update(ctx, 1, {
			name: 'Include Auto Align',
			includeInRename: true
		});

		seedUpstream(
			ctx,
			upstreamUpdate('Include Auto Align', {
				include_in_rename: { from: false, to: true }
			})
		);
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['include_in_rename']);
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped', 'aligned');
		assertNoPendingConflicts(ctx);

		const row = assertCustomFormat(ctx, 'Include Auto Align');
		assertEquals(row.include_in_rename, 1);
	}
});

/**
 * Context
 *   Base layer seeded with one custom format via base.customFormat():
 *     name='Old Custom Format'
 *
 * User
 *   POST update changes:
 *     name = 'User Custom Format'
 *
 * Upstream
 *   Published base rename changes:
 *     name 'Old Custom Format' -> 'Upstream Custom Format'
 *
 * Expect
 *   - rename op conflicts by strategy
 *   - final name is user value only for override, otherwise upstream value
 */
test('rename conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'rename-conflict', [
			base.customFormat({
				name: 'Old Custom Format'
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.update(ctx, 1, {
			name: 'User Custom Format'
		});

		seedUpstream(ctx, upstreamRename('Old Custom Format', 'Upstream Custom Format'));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['name']);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		if (strategy === 'override') {
			assertCustomFormat(ctx, 'User Custom Format');
			assertNoCustomFormat(ctx, 'Upstream Custom Format');
		} else {
			assertCustomFormat(ctx, 'Upstream Custom Format');
			assertNoCustomFormat(ctx, 'User Custom Format');
		}
	}
});

/**
 * Context
 *   Base layer seeded with one custom format via base.customFormat():
 *     name='Rename Clean', description='Original'
 *
 * User
 *   POST update changes:
 *     name = 'Rename Clean User'
 *
 * Upstream
 *   Published base op changes:
 *     description 'Original' -> 'Upstream description'
 *
 * Expect
 *   - user rename applies cleanly for every strategy
 *   - no pending conflicts remain
 *   - final custom format has the user name and upstream description
 */
test('local rename applies after upstream description change', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'rename-upstream-description', [
			base.customFormat({
				name: 'Rename Clean',
				description: 'Original'
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.update(ctx, 1, {
			name: 'Rename Clean User',
			description: 'Original'
		});

		seedUpstream(
			ctx,
			upstreamUpdate('Rename Clean', {
				description: { from: 'Original', to: 'Upstream description' }
			})
		);
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['name']);
		assertEquals(op.state, 'published');
		assertLatestHistory(ctx, op, 'applied');
		assertNoPendingConflicts(ctx);

		const row = assertCustomFormat(ctx, 'Rename Clean User');
		assertEquals(row.description, 'Upstream description');
		assertNoCustomFormat(ctx, 'Rename Clean');
	}
});

/**
 * Context
 *   Base layer seeded with one custom format via base.customFormat():
 *     name='Description Conflict', description='Original'
 *
 * User
 *   POST update changes:
 *     description = 'Local description edit'
 *
 * Upstream
 *   Published base op changes:
 *     description 'Original' -> 'Dev description edit'
 *
 * Expect
 *   - description op conflicts by strategy
 *   - final description is local only for override, otherwise upstream
 */
test('description conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'description-conflict', [
			base.customFormat({
				name: 'Description Conflict',
				description: 'Original'
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.update(ctx, 1, {
			name: 'Description Conflict',
			description: 'Local description edit'
		});

		seedUpstream(
			ctx,
			upstreamUpdate('Description Conflict', {
				description: { from: 'Original', to: 'Dev description edit' }
			})
		);
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['description']);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		const row = assertCustomFormat(ctx, 'Description Conflict');
		assertEquals(
			row.description,
			strategy === 'override' ? 'Local description edit' : 'Dev description edit'
		);
	}
});

/**
 * Context
 *   Base layer seeded with one custom format via base.customFormat():
 *     name='Description Renamed', description='Original'
 *
 * User
 *   POST update changes:
 *     description = 'Local description edit'
 *
 * Upstream
 *   Published base rename changes:
 *     name 'Description Renamed' -> 'Description Renamed Upstream'
 *
 * Expect
 *   - description op conflicts by strategy
 *   - final row keeps the upstream name
 *   - final description is local only for override, otherwise original
 */
test('description conflict follows upstream rename by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'description-upstream-rename', [
			base.customFormat({
				name: 'Description Renamed',
				description: 'Original'
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.update(ctx, 1, {
			name: 'Description Renamed',
			description: 'Local description edit'
		});

		seedUpstream(ctx, upstreamRename('Description Renamed', 'Description Renamed Upstream'));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['description']);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		const row = assertCustomFormat(ctx, 'Description Renamed Upstream');
		assertEquals(row.description, strategy === 'override' ? 'Local description edit' : 'Original');
		assertNoCustomFormat(ctx, 'Description Renamed');
	}
});

/**
 * Context
 *   Empty PCD.
 *
 * User
 *   POST create custom format:
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

		await write.customFormat.create(ctx, {
			name: 'Create Duplicate',
			description: 'Local create description'
		});

		seedUpstream(
			ctx,
			base.customFormat({
				name: 'Create Duplicate',
				description: 'Upstream create description'
			})
		);
		await compilePcd(ctx);

		const ops = opsSince(ctx, checkpoint);
		const op = firstOpForOperation(ops, 'create');
		if (strategy === 'override') {
			assertEquals(op.state, 'dropped');
			assertLatestHistory(ctx, op, 'dropped');
			const descriptionOp = firstOpForChangedFields(ops, ['description']);
			assertStrategyOutcome(ctx, descriptionOp, strategy, 'guard_mismatch');
		} else {
			assertStrategyOutcome(ctx, op, strategy, 'duplicate_key');
		}

		const row = assertCustomFormat(ctx, 'Create Duplicate');
		assertEquals(
			row.description,
			strategy === 'override' ? 'Local create description' : 'Upstream create description'
		);
	}
});

/**
 * Context
 *   Base layer seeded with one custom format via base.customFormat():
 *     name='Tags No Conflict', description=''
 *
 * User
 *   POST update changes:
 *     tags = ['LocalTag']
 *
 * Upstream
 *   Published base op changes:
 *     description '' -> 'Upstream description edit'
 *
 * Expect
 *   - user tags op applies cleanly for every strategy
 *   - no pending conflicts remain
 *   - final custom format has the local tag and upstream description
 */
test('tags-only update applies after upstream description change', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'tags-no-conflict', [
			base.customFormat({
				name: 'Tags No Conflict',
				description: ''
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.update(ctx, 1, {
			name: 'Tags No Conflict',
			tags: ['LocalTag']
		});

		seedUpstream(
			ctx,
			upstreamUpdate('Tags No Conflict', {
				description: { from: '', to: 'Upstream description edit' }
			})
		);
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['tags']);
		assertEquals(op.state, 'published');
		assertLatestHistory(ctx, op, 'applied');
		assertNoPendingConflicts(ctx);

		const row = assertCustomFormat(ctx, 'Tags No Conflict');
		assertEquals(row.description, 'Upstream description edit');
		assertEquals(compiledCustomFormatTags(ctx, 'Tags No Conflict'), ['LocalTag']);
	}
});

/**
 * Context
 *   Base layer seeded with one custom format via base.customFormat():
 *     name='Tags Diverge', tags=['RemoveTag', 'KeepTag']
 *
 * User
 *   POST update changes:
 *     tags = ['KeepTag']
 *
 * Upstream
 *   Published base op changes:
 *     tags add ['DevTag']
 *
 * Expect
 *   - user tags op applies cleanly for every strategy
 *   - no pending conflicts remain
 *   - final tags are ['DevTag', 'KeepTag']
 */
test('tag removal applies after upstream adds a different tag', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'tags-diverge', [
			base.customFormat({
				name: 'Tags Diverge',
				tags: ['RemoveTag', 'KeepTag']
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.update(ctx, 1, {
			name: 'Tags Diverge',
			tags: ['KeepTag']
		});

		seedUpstream(ctx, upstreamAddTags('Tags Diverge', ['DevTag']));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['tags']);
		assertEquals(op.state, 'published');
		assertLatestHistory(ctx, op, 'applied');
		assertNoPendingConflicts(ctx);
		assertEquals(compiledCustomFormatTags(ctx, 'Tags Diverge'), ['DevTag', 'KeepTag']);
	}
});

/**
 * Context
 *   Base layer seeded with one custom format via base.customFormat():
 *     name='General Multi', description='Original', includeInRename=false
 *
 * User
 *   POST update changes:
 *     description = 'Local multi description'
 *
 * Upstream
 *   Published base ops change:
 *     description 'Original' -> 'Upstream multi description'
 *     include_in_rename false -> true
 *     tags add ['UpstreamMultiTag']
 *
 * Expect
 *   - description op conflicts by strategy
 *   - final description is local only for override, otherwise upstream
 *   - include_in_rename and tags come from upstream for every strategy
 */
test('description conflict preserves upstream include and tags by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'description-include-tags-conflict', [
			base.customFormat({
				name: 'General Multi',
				description: 'Original',
				includeInRename: false
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.update(ctx, 1, {
			name: 'General Multi',
			description: 'Local multi description'
		});

		seedUpstream(
			ctx,
			upstreamUpdate('General Multi', {
				description: { from: 'Original', to: 'Upstream multi description' },
				include_in_rename: { from: false, to: true }
			})
		);
		seedUpstream(ctx, upstreamAddTags('General Multi', ['UpstreamMultiTag']));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['description']);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		const row = assertCustomFormat(ctx, 'General Multi');
		assertEquals(
			row.description,
			strategy === 'override' ? 'Local multi description' : 'Upstream multi description'
		);
		assertEquals(row.include_in_rename, 1);
		assertEquals(compiledCustomFormatTags(ctx, 'General Multi'), ['UpstreamMultiTag']);
	}
});

/**
 * Context
 *   Base layer seeded with one custom format via base.customFormat():
 *     name='Delete Renamed'
 *
 * User
 *   POST delete custom format.
 *
 * Upstream
 *   Published base rename changes:
 *     name 'Delete Renamed' -> 'Delete Renamed Upstream'
 *
 * Expect
 *   - user delete auto-aligns/drops for every strategy
 *   - no pending conflicts remain
 *   - final custom format exists with upstream name
 */
test('delete missing target via upstream rename auto-aligns', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'delete-renamed', [
			base.customFormat({
				name: 'Delete Renamed'
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.remove(ctx, 1);

		seedUpstream(ctx, upstreamRename('Delete Renamed', 'Delete Renamed Upstream'));
		await compilePcd(ctx);

		const op = firstOpForOperation(opsSince(ctx, checkpoint), 'delete');
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped', 'aligned');
		assertNoPendingConflicts(ctx);
		assertCustomFormat(ctx, 'Delete Renamed Upstream');
		assertNoCustomFormat(ctx, 'Delete Renamed');
	}
});

/**
 * Context
 *   Base layer seeded with one custom format via base.customFormat():
 *     name='Delete Both'
 *
 * User
 *   POST delete custom format.
 *
 * Upstream
 *   Published base delete removes the same row.
 *
 * Expect
 *   - user delete auto-aligns/drops for every strategy
 *   - no pending conflicts remain
 *   - final custom format is absent
 */
test('delete missing target via upstream delete auto-aligns', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'delete-both', [
			base.customFormat({
				name: 'Delete Both'
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.remove(ctx, 1);

		seedUpstream(ctx, upstreamDelete('Delete Both'));
		await compilePcd(ctx);

		const op = firstOpForOperation(opsSince(ctx, checkpoint), 'delete');
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped', 'aligned');
		assertNoPendingConflicts(ctx);
		assertNoCustomFormat(ctx, 'Delete Both');
	}
});

/**
 * Context
 *   Base layer seeded with one custom format via base.customFormat():
 *     name='Update Deleted', description='Seed description'
 *
 * User
 *   POST update changes:
 *     description = 'Local deleted description'
 *
 * Upstream
 *   Published base delete removes the row.
 *
 * Expect
 *   - description op conflicts by strategy
 *   - override recreates the custom format with the local description
 *   - ask/align leave the custom format deleted
 */
test('local update conflicts when upstream deletes row', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'update-upstream-deleted', [
			base.customFormat({
				name: 'Update Deleted',
				description: 'Seed description'
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.update(ctx, 1, {
			name: 'Update Deleted',
			description: 'Local deleted description'
		});

		seedUpstream(ctx, upstreamDelete('Update Deleted'));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['description']);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		if (strategy === 'override') {
			const row = assertCustomFormat(ctx, 'Update Deleted');
			assertEquals(row.description, 'Local deleted description');
		} else {
			assertNoCustomFormat(ctx, 'Update Deleted');
		}
	}
});

/**
 * Context
 *   Base layer seeded with one custom format via base.customFormat():
 *     name='Rename Description', description='Original'
 *
 * User
 *   POST update changes in one save:
 *     name = 'Rename Description User'
 *     description = 'Local rename description'
 *
 * Upstream
 *   Published base op changes:
 *     description 'Original' -> 'Upstream rename description'
 *
 * Expect
 *   - description op conflicts by strategy
 *   - rename op applies cleanly for every strategy
 *   - override keeps user name and local description
 *   - ask/align keep user name and upstream description
 */
test('local rename and description conflict with upstream description by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'rename-description-upstream-description', [
			base.customFormat({
				name: 'Rename Description',
				description: 'Original'
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.customFormat.update(ctx, 1, {
			name: 'Rename Description User',
			description: 'Local rename description'
		});

		seedUpstream(
			ctx,
			upstreamUpdate('Rename Description', {
				description: { from: 'Original', to: 'Upstream rename description' }
			})
		);
		await compilePcd(ctx);

		const ops = opsSince(ctx, checkpoint);
		const descriptionOp = firstOpForChangedFields(ops, ['description']);
		const renameOp = firstOpForChangedFields(ops, ['name']);
		assertStrategyOutcome(ctx, descriptionOp, strategy, 'guard_mismatch');
		assertEquals(renameOp.state, 'published');
		assertLatestHistory(ctx, renameOp, 'applied');

		const row = assertCustomFormat(ctx, 'Rename Description User');
		assertEquals(
			row.description,
			strategy === 'override' ? 'Local rename description' : 'Upstream rename description'
		);
		assertNoCustomFormat(ctx, 'Rename Description');
	}
});

async function newScenario(strategy: ConflictStrategy, name: string): Promise<PcdTestContext> {
	counter++;
	return setupPcd({
		port: PORT,
		name: `pcd-conflict-custom-format-general-${counter}-${strategy}-${name}`,
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
	assertExists(op, `Expected a user ${operation} op`);
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

function assertCustomFormat(ctx: PcdTestContext, name: string): CustomFormatRow {
	const row = compiledCustomFormats(ctx).find((format) => format.name === name);
	assertExists(row, `Expected custom format ${name}`);
	return row;
}

function assertNoCustomFormat(ctx: PcdTestContext, name: string): void {
	const row = compiledCustomFormats(ctx).find((format) => format.name === name);
	assertEquals(row, undefined);
}

function compiledCustomFormats(ctx: PcdTestContext): CustomFormatRow[] {
	return compiledCustomFormatState(ctx).formats;
}

function compiledCustomFormatTags(ctx: PcdTestContext, name: string): string[] {
	return compiledCustomFormatState(ctx)
		.tags.filter((tag) => tag.custom_format_name === name)
		.map((tag) => tag.tag_name);
}

function compiledCustomFormatState(ctx: PcdTestContext): {
	formats: CustomFormatRow[];
	tags: CustomFormatTagRow[];
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

		const formats = replay
			.prepare(
				`SELECT name, description, include_in_rename
				 FROM custom_formats
				 ORDER BY name`
			)
			.all() as CustomFormatRow[];
		const tags = replay
			.prepare(
				`SELECT custom_format_name, tag_name
				 FROM custom_format_tags
				 ORDER BY custom_format_name, tag_name`
			)
			.all() as CustomFormatTagRow[];

		return { formats, tags };
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
		sql: `UPDATE custom_formats SET ${setSql} WHERE name = ${sqlValue(name)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'custom_format',
			name,
			stable_key: { key: 'custom_format_name', value: name },
			changed_fields: fields
		}),
		desiredState: JSON.stringify(changes)
	};
}

function upstreamRename(from: string, to: string): SeedOperation {
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

function upstreamDelete(name: string): SeedOperation {
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

function upstreamAddTags(name: string, tags: string[]): SeedOperation {
	const tagSql = tags.map((tag) =>
		[
			`INSERT INTO tags (name) VALUES (${sqlValue(tag)}) ON CONFLICT(name) DO NOTHING;`,
			`INSERT INTO custom_format_tags (custom_format_name, tag_name) VALUES (${sqlValue(
				name
			)}, ${sqlValue(tag)});`
		].join('\n')
	);
	return {
		sql: tagSql.join('\n'),
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'custom_format',
			name,
			stable_key: { key: 'custom_format_name', value: name },
			changed_fields: ['tags']
		}),
		desiredState: JSON.stringify({ tags: { add: tags, remove: [] } })
	};
}

function sqlValue(value: unknown): string {
	if (value === null || value === undefined) return 'NULL';
	if (typeof value === 'number') return String(value);
	if (typeof value === 'boolean') return value ? '1' : '0';
	return `'${String(value).replace(/'/g, "''")}'`;
}

await run();
