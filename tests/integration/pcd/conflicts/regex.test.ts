/**
 * PCD conflict tests: regular expressions.
 */

import { assert, assertEquals, assertExists } from '@std/assert';
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

const PORT = PORTS.pcd.conflictsRegex;
const ORIGIN = `http://localhost:${PORT}`;
const STRATEGIES: ConflictStrategy[] = ['ask', 'align', 'override'];

type LatestHistory = {
	status: string;
	conflict_reason: string | null;
};

type RegexRow = {
	name: string;
	pattern: string;
	description: string | null;
	regex101_id: string | null;
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
 *   Base layer seeded with one regex via base.regex():
 *     name='Split Conflict', pattern='\bsplit\b', description='Original'
 *
 * User
 *   POST update changes:
 *     pattern     = '\buser\b'
 *     description = 'User edit'
 *
 * Upstream
 *   Published base op changes:
 *     pattern '\bsplit\b' -> '\bupstream\b'
 *
 * Expect
 *   - pattern op is conflicted_pending / dropped / superseded by strategy
 *   - description op applies cleanly for every strategy (no conflict)
 *   - final pattern is '\buser\b' only for override, otherwise '\bupstream\b'
 *   - final description is 'User edit' for every strategy
 */
test('split scalar conflicts resolve per field by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'split-scalar', [
			base.regex({
				name: 'Split Conflict',
				pattern: '\\bsplit\\b',
				description: 'Original'
			})
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.regex.update(ctx, 1, {
			name: 'Split Conflict',
			pattern: '\\buser\\b',
			description: 'User edit'
		});

		seedUpstream(
			ctx,
			upstreamUpdate('Split Conflict', {
				pattern: { from: '\\bsplit\\b', to: '\\bupstream\\b' }
			})
		);
		await compilePcd(ctx);

		const ops = userOpsSince(ctx, checkpoint);
		const patternOp = firstOpForChangedFields(ops, ['pattern']);
		const descriptionOp = firstOpForChangedFields(ops, ['description']);

		assertStrategyOutcome(ctx, patternOp, strategy, 'guard_mismatch');
		assertLatestHistory(ctx, descriptionOp, 'applied');

		const row = assertRegex(ctx, 'Split Conflict');
		assertEquals(row.pattern, strategy === 'override' ? '\\buser\\b' : '\\bupstream\\b');
		assertEquals(row.description, 'User edit');
	}
});

/**
 * Context
 *   Base layer seeded with one regex via base.regex():
 *     name='Old Regex', pattern='\bold\b'
 *
 * User
 *   POST update changes:
 *     name = 'User Regex'
 *
 * Upstream
 *   Published base rename changes:
 *     name 'Old Regex' -> 'Upstream Regex'
 *
 * Expect
 *   - rename op is conflicted_pending / dropped / superseded by strategy
 *   - override final row is named 'User Regex'
 *   - otherwise final row is named 'Upstream Regex'
 */
test('rename conflict follows upstream rename by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'rename', [
			base.regex({ name: 'Old Regex', pattern: '\\bold\\b' })
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.regex.update(ctx, 1, {
			name: 'User Regex',
			pattern: '\\bold\\b'
		});

		seedUpstream(ctx, upstreamRename('Old Regex', 'Upstream Regex'));
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['name']);
		assertStrategyOutcome(ctx, op, strategy, 'guard_mismatch');

		if (strategy === 'override') {
			assertRegex(ctx, 'User Regex');
			assertNoRegex(ctx, 'Upstream Regex');
		} else {
			assertRegex(ctx, 'Upstream Regex');
			assertNoRegex(ctx, 'User Regex');
		}
	}
});

/**
 * Context
 *   Empty PCD.
 *
 * User
 *   POST create regex:
 *     name='Create Conflict', pattern='\buser\b'
 *
 * Upstream
 *   Published base create:
 *     name='Create Conflict', pattern='\bupstream\b'
 *
 * Expect
 *   - user create op is conflicted_pending / dropped / superseded by strategy
 *   - final pattern is '\buser\b' only for override, otherwise '\bupstream\b'
 */
test('create duplicate conflict resolves by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await newScenario(strategy, 'create-duplicate');
		await compilePcd(ctx);
		const checkpoint = opCheckpoint(ctx);

		await write.regex.create(ctx, {
			name: 'Create Conflict',
			pattern: '\\buser\\b'
		});

		seedUpstream(ctx, base.regex({ name: 'Create Conflict', pattern: '\\bupstream\\b' }));
		await compilePcd(ctx);

		const op = firstOpForOperation(opsSince(ctx, checkpoint), 'create');
		assertStrategyOutcome(ctx, op, strategy, 'duplicate_key');

		const row = assertRegex(ctx, 'Create Conflict');
		assertEquals(row.pattern, strategy === 'override' ? '\\buser\\b' : '\\bupstream\\b');
	}
});

/**
 * Context
 *   Base layer seeded with one regex via base.regex():
 *     name='Already Deleted', pattern='\bgone\b'
 *
 * User
 *   POST delete the regex.
 *
 * Upstream
 *   Published base delete removes the same row.
 *
 * Expect
 *   - all strategies: user delete auto-aligns/drops because the target is gone
 *   - final row is absent
 */
test('delete missing target via upstream delete auto-aligns', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'delete-missing-target', [
			base.regex({ name: 'Already Deleted', pattern: '\\bgone\\b' })
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.regex.remove(ctx, 1);

		seedUpstream(ctx, upstreamDelete('Already Deleted'));
		await compilePcd(ctx);

		const op = firstOpForOperation(opsSince(ctx, checkpoint), 'delete');
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped', 'aligned');
		assertNoRegex(ctx, 'Already Deleted');
	}
});

/**
 * Context
 *   Base layer seeded with one regex via base.regex():
 *     name='Renamed Away', pattern='\brenamed\b'
 *
 * User
 *   POST delete the regex.
 *
 * Upstream
 *   Published base rename moves the row to 'Now Different'.
 *
 * Expect
 *   - the user delete now finds zero rows (its name guard misses the renamed
 *     row); conflict reason is missing_target because deleteTargetExists
 *     looks up by the original name
 *   - all strategies auto-align/drop the user delete
 *   - final cache contains 'Now Different' (the renamed row), not 'Renamed Away'
 */
test('delete missing target via upstream rename auto-aligns', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'delete-rename-missing', [
			base.regex({ name: 'Renamed Away', pattern: '\\brenamed\\b' })
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.regex.remove(ctx, 1);

		seedUpstream(ctx, upstreamRename('Renamed Away', 'Now Different'));
		await compilePcd(ctx);

		const op = firstOpForOperation(opsSince(ctx, checkpoint), 'delete');
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped', 'aligned');
		assertRegex(ctx, 'Now Different');
		assertNoRegex(ctx, 'Renamed Away');
	}
});

/**
 * Context
 *   Base layer seeded with one regex via base.regex():
 *     name='Convergent', pattern='\bold\b'
 *
 * User
 *   POST update changes:
 *     pattern '\bold\b' -> '\bsame\b'
 *
 * Upstream
 *   Published base op changes:
 *     pattern '\bold\b' -> '\bsame\b'   (same target value)
 *
 * Expect (verifies the defaultFieldGuard auto-align rule)
 *   - user pattern op auto-aligns regardless of strategy: state='dropped',
 *     history.status='dropped', conflict_reason='aligned'.
 *   - final pattern is '\bsame\b' (both sides wanted the same end state, so
 *     there is nothing to actually conflict over).
 */
test('matching upstream value auto-aligns user op', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'auto-align-convergent', [
			base.regex({ name: 'Convergent', pattern: '\\bold\\b' })
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.regex.update(ctx, 1, {
			name: 'Convergent',
			pattern: '\\bsame\\b'
		});

		seedUpstream(
			ctx,
			upstreamUpdate('Convergent', {
				pattern: { from: '\\bold\\b', to: '\\bsame\\b' }
			})
		);
		await compilePcd(ctx);

		const op = firstOpForChangedFields(opsSince(ctx, checkpoint), ['pattern']);
		assertEquals(op.state, 'dropped');
		assertLatestHistory(ctx, op, 'dropped', 'aligned');

		const row = assertRegex(ctx, 'Convergent');
		assertEquals(row.pattern, '\\bsame\\b');
	}
});

/**
 * Context
 *   Base layer seeded with one regex via base.regex():
 *     name='Pattern Change', pattern='\boriginal\b'
 *
 * User
 *   POST delete the regex.
 *
 * Upstream
 *   Published base op changes pattern '\boriginal\b' -> '\bnew\b' on the same
 *   row (row stays named 'Pattern Change').
 *
 * Expect (verifies the name-only delete guard)
 *   - user delete op stays state='published' and history.status='applied' for
 *     every strategy (no conflict). The delete only guards by name, which
 *     still matches after upstream changed the pattern.
 *   - final row is absent.
 */
test('delete applies cleanly after upstream pattern change', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await seededScenario(strategy, 'delete-after-pattern-change', [
			base.regex({ name: 'Pattern Change', pattern: '\\boriginal\\b' })
		]);
		const checkpoint = opCheckpoint(ctx);

		await write.regex.remove(ctx, 1);

		seedUpstream(
			ctx,
			upstreamUpdate('Pattern Change', {
				pattern: { from: '\\boriginal\\b', to: '\\bnew\\b' }
			})
		);
		await compilePcd(ctx);

		const op = firstOpForOperation(opsSince(ctx, checkpoint), 'delete');
		assertEquals(op.state, 'published');
		assertLatestHistory(ctx, op, 'applied');
		assertNoRegex(ctx, 'Pattern Change');
	}
});

async function newScenario(strategy: ConflictStrategy, name: string): Promise<PcdTestContext> {
	counter++;
	return setupPcd({
		port: PORT,
		name: `pcd-conflict-regex-${counter}-${strategy}-${name}`,
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

function userOpsSince(ctx: PcdTestContext, checkpoint: number): OpRow[] {
	return opsSince(ctx, checkpoint);
}

function firstOpForOperation(ops: OpRow[], operation: string): OpRow {
	const op = ops.find((candidate) => parseMetadata(candidate).operation === operation);
	assertExists(op, `Expected a user ${operation} op`);
	return op;
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
	assert(op.superseded_by_op_id !== null, 'Expected override to link a replacement op');
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

function assertRegex(ctx: PcdTestContext, name: string): RegexRow {
	const row = compiledRegexes(ctx).find((regex) => regex.name === name);
	assertExists(row, `Expected regex ${name}`);
	return row;
}

function assertNoRegex(ctx: PcdTestContext, name: string): void {
	const row = compiledRegexes(ctx).find((regex) => regex.name === name);
	assertEquals(row, undefined);
}

function compiledRegexes(ctx: PcdTestContext): RegexRow[] {
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

		return replay
			.prepare(
				`SELECT name, pattern, description, regex101_id
				 FROM regular_expressions
				 ORDER BY name`
			)
			.all() as RegexRow[];
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
		sql: `UPDATE regular_expressions SET ${setSql} WHERE name = ${sqlValue(name)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'regular_expression',
			name,
			stable_key: { key: 'regular_expression_name', value: name },
			changed_fields: fields
		}),
		desiredState: JSON.stringify(changes)
	};
}

function upstreamRename(from: string, to: string): SeedOperation {
	return {
		sql: `UPDATE regular_expressions SET name = ${sqlValue(to)} WHERE name = ${sqlValue(from)};`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'regular_expression',
			name: to,
			previousName: from,
			stable_key: { key: 'regular_expression_name', value: from },
			changed_fields: ['name']
		}),
		desiredState: JSON.stringify({ name: { from, to } })
	};
}

function upstreamDelete(name: string): SeedOperation {
	return {
		sql: `DELETE FROM regular_expressions WHERE name = ${sqlValue(name)};`,
		metadata: JSON.stringify({
			operation: 'delete',
			entity: 'regular_expression',
			name,
			stable_key: { key: 'regular_expression_name', value: name },
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
