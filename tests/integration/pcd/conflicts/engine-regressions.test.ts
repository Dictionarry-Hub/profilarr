/**
 * PCD conflict tests: engine regressions.
 */

import { assert, assertEquals, assertExists } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { openDb } from '$test-harness/db.ts';
import { run, setup, teardown, test } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import {
	compilePcd,
	insertOp,
	setupPcd,
	type ConflictStrategy,
	type OpRow,
	type PcdTestContext
} from '../harness/pcd.ts';

const PORT = PORTS.pcd.conflictsEngineRegressions;
const ORIGIN = `http://localhost:${PORT}`;
const STRATEGIES: ConflictStrategy[] = ['ask', 'align', 'override'];

type LatestHistory = {
	status: string;
	conflict_reason: string | null;
};

let counter = 0;

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

teardown(async () => {
	await stopServer(PORT);
});

/**
 * Migrates old sequential-edits.
 *
 * Context
 *   Base creates a regex with pattern '\boriginal\b'.
 *
 * User
 *   Op 1 changes pattern '\boriginal\b' -> '\bfirst\b'.
 *   Op 2 changes pattern '\bfirst\b' -> '\bsecond\b'.
 *
 * Expect
 *   - both ops apply for every strategy
 *   - no pending conflicts remain
 */
test('sequential user edits keep the local chain intact', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await newScenario(strategy, 'sequential-edits');
		const { firstOpId, secondOpId } = seedSequentialRegex(ctx, 'Seq Regex', {
			includeUpstreamChange: false
		});
		await compilePcd(ctx);

		assertNoPendingConflicts(ctx);
		assertEquals(opById(ctx, firstOpId).state, 'published');
		assertEquals(opById(ctx, secondOpId).state, 'published');
		assertLatestHistory(ctx, firstOpId, 'applied');
		assertLatestHistory(ctx, secondOpId, 'applied');
	}
});

/**
 * Migrates old upstream-change.
 *
 * Context
 *   Base creates a regex with pattern '\boriginal\b'.
 *   Upstream changes pattern '\boriginal\b' -> '\bupstream\b'.
 *
 * User
 *   Op 1 still expects '\boriginal\b' -> '\bfirst\b'.
 *   Op 2 expects '\bfirst\b' -> '\bsecond\b'.
 *
 * Expect
 *   - ask leaves both ops conflicted_pending
 *   - align drops both ops
 *   - override drops or supersedes both originals and creates a replacement
 */
test('upstream invalidates a sequential user edit chain by strategy', async () => {
	for (const strategy of STRATEGIES) {
		const ctx = await newScenario(strategy, 'upstream-change');
		const { firstOpId, secondOpId } = seedSequentialRegex(ctx, 'Upstream Regex', {
			includeUpstreamChange: true
		});
		await compilePcd(ctx);

		if (strategy === 'ask') {
			assertEquals(opById(ctx, firstOpId).state, 'published');
			assertEquals(opById(ctx, secondOpId).state, 'published');
			assertLatestHistory(ctx, firstOpId, 'conflicted_pending', 'guard_mismatch');
			assertLatestHistory(ctx, secondOpId, 'conflicted_pending', 'guard_mismatch');
			continue;
		}

		if (strategy === 'align') {
			assertEquals(opById(ctx, firstOpId).state, 'dropped');
			assertEquals(opById(ctx, secondOpId).state, 'dropped');
			assertNoPendingConflicts(ctx);
			continue;
		}

		const firstState = opById(ctx, firstOpId).state;
		const secondState = opById(ctx, secondOpId).state;
		assert(
			['dropped', 'superseded'].includes(firstState),
			`Unexpected first op state ${firstState}`
		);
		assert(
			['dropped', 'superseded'].includes(secondState),
			`Unexpected second op state ${secondState}`
		);
		assert(
			publishedUserOps(ctx).some((op) => op.id !== firstOpId && op.id !== secondOpId),
			'Expected override to create at least one replacement user op'
		);
		assertNoPendingConflicts(ctx);
	}
});

async function newScenario(strategy: ConflictStrategy, name: string): Promise<PcdTestContext> {
	counter++;
	return setupPcd({
		port: PORT,
		name: `pcd-conflict-engine-regression-${counter}-${strategy}-${name}`,
		conflictStrategy: strategy
	});
}

function seedSequentialRegex(
	ctx: PcdTestContext,
	name: string,
	options: { includeUpstreamChange: boolean }
): { firstOpId: number; secondOpId: number } {
	insertOp(ctx, {
		origin: 'base',
		state: 'published',
		sequence: 1,
		sql: `INSERT INTO regular_expressions (name, pattern, description)
		      VALUES (${sqlValue(name)}, '\\boriginal\\b', 'Original');`
	});

	if (options.includeUpstreamChange) {
		insertOp(ctx, {
			origin: 'base',
			state: 'published',
			sequence: 2,
			source: 'repo',
			sql: `UPDATE regular_expressions
			      SET pattern = '\\bupstream\\b'
			      WHERE name = ${sqlValue(name)}
			        AND pattern = '\\boriginal\\b';`
		});
	}

	const firstOpId = insertOp(ctx, {
		origin: 'user',
		state: 'published',
		sequence: 100,
		sql: `UPDATE regular_expressions
		      SET pattern = '\\bfirst\\b'
		      WHERE name = ${sqlValue(name)}
		        AND pattern = '\\boriginal\\b';`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'regular_expression',
			name,
			stable_key: { key: 'regular_expression_name', value: name },
			changed_fields: ['pattern']
		}),
		desiredState: JSON.stringify({
			pattern: { from: '\\boriginal\\b', to: '\\bfirst\\b' }
		})
	});

	const secondOpId = insertOp(ctx, {
		origin: 'user',
		state: 'published',
		sequence: 101,
		sql: `UPDATE regular_expressions
		      SET pattern = '\\bsecond\\b'
		      WHERE name = ${sqlValue(name)}
		        AND pattern = '\\bfirst\\b';`,
		metadata: JSON.stringify({
			operation: 'update',
			entity: 'regular_expression',
			name,
			stable_key: { key: 'regular_expression_name', value: name },
			changed_fields: ['pattern']
		}),
		desiredState: JSON.stringify({
			pattern: { from: '\\bfirst\\b', to: '\\bsecond\\b' }
		})
	});

	return { firstOpId, secondOpId };
}

function opById(ctx: PcdTestContext, opId: number): OpRow {
	const db = openDb(ctx.dbPath);
	try {
		const op = db
			.prepare('SELECT * FROM pcd_ops WHERE database_id = ? AND id = ?')
			.get(ctx.dbId, opId) as OpRow | undefined;
		assertExists(op, `Expected op ${opId}`);
		return op;
	} finally {
		db.close();
	}
}

function publishedUserOps(ctx: PcdTestContext): OpRow[] {
	const db = openDb(ctx.dbPath);
	try {
		return db
			.prepare(
				`SELECT *
				 FROM pcd_ops
				 WHERE database_id = ?
				   AND origin = 'user'
				   AND state = 'published'
				 ORDER BY id`
			)
			.all(ctx.dbId) as OpRow[];
	} finally {
		db.close();
	}
}

function assertLatestHistory(
	ctx: PcdTestContext,
	opId: number,
	status: string,
	reason?: string
): void {
	const history = latestHistory(ctx, opId);
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

function sqlValue(value: string): string {
	return `'${value.replace(/'/g, "''")}'`;
}

await run();
